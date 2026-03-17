import { readFile } from "fs/promises";
import path from "path";
import { getStudentsForRole, getCoursesForRole, getDepartmentsForRole } from "@/lib/role";
import type { User } from "@/lib/role";
import { getLatestInterventionStatusMap } from "@/data/intervention-store";
import { getWellbeingChartDataForStudents } from "@/lib/db/wellbeing";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";
import { pool } from "@/lib/db";
import { fetchMonitoringEntries, mapMonitoringToStudents, getMonitoringStudentsBySapId } from "@/lib/sap-monitoring";

const ENROLLMENT_DATA_FILE = "enrollment_data.json";

/** Minimal shape of one record from public/enrollment_data.json (one row per course enrollment; same student can appear multiple times). */
type EnrollmentRecord = {
  DeptCode: string;
  DeptName: string;
  DeptId: string;
  SapNo: string;
  FacId?: string;
  DegreeCode?: string;
  DegreeTitle?: string;
  CrCode?: string;
  CrTitle?: string;
  /** Instructor/teacher display name. */
  Teacher?: string | null;
  /** Unique employee number of the teacher (Pernr). */
  Pernr?: string;
  Name?: string;
};

/** Map faculty_id (e.g. FAC_ENG) to enrollment_data.json FacId (e.g. 50000172). */
const FACULTY_ID_TO_ENROLLMENT_FAC_ID: Record<string, string> = {
  FAC_ENG: "50000172",
  FAC_MGT: "50000172",
};

async function readEnrollmentFile(): Promise<EnrollmentRecord[]> {
  const dataPath = path.join(process.cwd(), "public", ENROLLMENT_DATA_FILE);
  const raw = await readFile(dataPath, "utf-8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? (data as EnrollmentRecord[]) : [];
}

function defaultStudent(sapId: string, name: string, departmentId: string, facultyId: string, courseId: string): Student {
  return {
    sap_id: sapId,
    name: name || sapId,
    course_id: courseId || "—",
    department_id: departmentId || "—",
    faculty_id: facultyId || "—",
    attendance: {
      total_classes_held: 0,
      classes_attended: 0,
      attendance_percentage: 0,
      class_average_attendance: 0,
      deviation_from_class_avg: 0,
      total_students_in_class: 0,
      alert_level: null,
    },
    gpa: {
      history: [],
      current: 0,
      previous: 0,
      change: 0,
      trend: "stable",
      class_average_gpa_current: 0,
      class_average_gpa_previous: 0,
      total_students_in_class: 0,
      alert_level: null,
    },
    overall_alert: "none",
  };
}

function buildStudentsFromEnrollment(records: EnrollmentRecord[]): Student[] {
  const bySap = new Map<string, EnrollmentRecord>();
  for (const r of records) {
    const sap = String(r.SapNo ?? "").trim();
    if (!sap) continue;
    if (!bySap.has(sap)) bySap.set(sap, r);
  }
  return Array.from(bySap.entries()).map(([sapId, r]) =>
    defaultStudent(
      sapId,
      (r.Name ?? "").trim(),
      r.DeptId ?? "",
      r.FacId ?? "",
      (r.CrCode ?? "").trim() || "—"
    )
  );
}

function buildDepartmentsFromEnrollment(records: EnrollmentRecord[]): Department[] {
  const byId = new Map<string, Department>();
  for (const r of records) {
    const id = r.DeptId ?? r.DeptCode ?? "";
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id, name: (r.DeptName ?? id).trim(), faculty_id: r.FacId ?? "" });
  }
  return Array.from(byId.values());
}

function buildCoursesFromEnrollment(records: EnrollmentRecord[]): Course[] {
  const byId = new Map<string, Course>();
  for (const r of records) {
    const id = (r.CrCode ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: (r.CrTitle ?? id).trim(),
        department_id: r.DeptId ?? "",
        faculty_id: r.FacId ?? "",
        total_classes_held: 0,
        credit_hours: 0,
        semester: "",
      });
    }
  }
  return Array.from(byId.values());
}

function buildFacultiesFromEnrollment(records: EnrollmentRecord[]): Faculty[] {
  const byId = new Map<string, Faculty>();
  for (const r of records) {
    const id = (r.FacId ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { id, name: `Faculty ${id}` });
  }
  return Array.from(byId.values());
}

async function getTeachersFromDbAndEnrollment(records: EnrollmentRecord[]): Promise<AppUser[]> {
  if (!pool) return [];
  const res = await pool.query<{ id: string; pernr: string; name: string; faculty_id: string | null }>(
    `SELECT id, pernr, name, faculty_id FROM staff WHERE role = 'instructor'`
  );
  const pernrToCourseIds = new Map<string, string[]>();
  const pernrToDeptId = new Map<string, string>();
  for (const r of records) {
    const pernr = (r.Pernr ?? "").trim();
    const cr = (r.CrCode ?? "").trim();
    if (!pernr) continue;
    if (!pernrToDeptId.has(pernr)) pernrToDeptId.set(pernr, r.DeptId ?? "");
    if (cr) {
      if (!pernrToCourseIds.has(pernr)) pernrToCourseIds.set(pernr, []);
      const arr = pernrToCourseIds.get(pernr)!;
      if (!arr.includes(cr)) arr.push(cr);
    }
  }
  return res.rows.map((row: { id: string; pernr: string; name: string; faculty_id: string | null }) => ({
    id: row.id,
    img: null,
    sap_id: row.pernr,
    name: row.name,
    email: "",
    role: "teacher" as const,
    faculty_id: row.faculty_id,
    department_id: pernrToDeptId.get(row.pernr) ?? null,
    department_ids: null,
    course_ids: pernrToCourseIds.get(row.pernr) ?? [],
  }));
}

/** Extract program prefix from course ID (e.g. "CS101" -> "CS") */
export function getProgramFromCourse(courseId: string): string {
  const match = courseId.match(/^([A-Z]+)/);
  return match ? match[1] : courseId.substring(0, 2);
}

export type MasterFilterParams = {
  department_ids?: string[];
  programs?: string[];
  instructor_ids?: string[];
  course_ids?: string[];
};

/** GPA / Attendance filter: all | red (critical) | yellow (warning) | good (no alert) */
export type AlertDimensionFilter = "all" | "red" | "yellow" | "good";

function levelMatchesFilters(
  level: "critical" | "warning" | null,
  filters: AlertDimensionFilter[] | undefined
): boolean {
  if (!filters?.length) return true;
  const allowed = new Set<string | null>();
  for (const f of filters) {
    if (f === "red") allowed.add("critical");
    else if (f === "yellow") allowed.add("warning");
    else if (f === "good") allowed.add(null);
  }
  return allowed.has(level);
}

function applyGpaAttendanceFilter(
  students: Student[],
  gpaFilters: AlertDimensionFilter[] | undefined,
  attendanceFilters: AlertDimensionFilter[] | undefined
): Student[] {
  let out = students;
  if (gpaFilters?.length) {
    out = out.filter((s) => levelMatchesFilters(s.gpa.alert_level, gpaFilters));
  }
  if (attendanceFilters?.length) {
    out = out.filter((s) =>
      levelMatchesFilters(s.attendance.alert_level, attendanceFilters)
    );
  }
  return out;
}

export type MasterFilterOptions = {
  departments: { value: string; label: string }[];
  programs: { value: string; label: string }[];
  instructors: { value: string; label: string }[];
  courses: { value: string; label: string }[];
};

export type GpaHistoryEntry = {
  semester: string;
  gpa: number;
  credit_hours: number;
};

export type Student = {
  sap_id: string;
  name: string;
  course_id: string;
  department_id: string;
  faculty_id: string;
  /** Optional labels sourced from live SAP data. */
  department_name?: string;
  course_name?: string;
  instructor_name?: string;
  attendance: {
    total_classes_held: number;
    classes_attended: number;
    attendance_percentage: number;
    class_average_attendance: number;
    deviation_from_class_avg: number;
    total_students_in_class?: number;
    alert_level: "critical" | "warning" | null;
  };
  gpa: {
    history: GpaHistoryEntry[];
    current: number;
    previous: number;
    change: number;
    trend: "up" | "down" | "stable";
    class_average_gpa_current: number;
    class_average_gpa_previous: number;
    total_students_in_class?: number;
    alert_level: "critical" | "warning" | null;
  };
  overall_alert: "critical" | "warning" | "none";
};

export type Faculty = { id: string; name: string };
export type Department = { id: string; name: string; faculty_id: string };
export type Course = {
  id: string;
  name: string;
  department_id: string;
  faculty_id: string;
  total_classes_held: number;
  credit_hours: number;
  semester: string;
};

export type AppUser = {
  id: string;
  img: string | null;
  sap_id: string;
  name: string;
  email: string;
  password?: string;
  role: "dean" | "hod" | "teacher";
  faculty_id: string | null;
  department_id: string | null;
  department_ids: string[] | null;
  course_ids: string[] | null;
};

type DataJson = {
  metadata: {
    thresholds: {
      attendance: { warning_percentage: number; critical_percentage: number };
      gpa: { warning_drop: number; critical_drop: number };
    };
  };
  faculties: Faculty[];
  departments: Department[];
  courses: Course[];
  users: AppUser[];
  students: Student[];
};

const ALERT_FILTERS = ["all", "early_alert", "gpa", "attendance", "yellow_gpa", "red_gpa", "yellow_attendance", "red_attendance"] as const;
export type AlertFilter = (typeof ALERT_FILTERS)[number];

function isValidAlertFilter(value: string): value is AlertFilter {
  return ALERT_FILTERS.includes(value as AlertFilter);
}

export const THRESHOLDS = {
  attendance: { warning: 40, critical: 20 },
  /** GPA: drop >= 1.0 → red (critical), drop >= 0.5 and < 1.0 → yellow (warning) */
  gpa: { warning_drop: 0.5, critical_drop: 1.0 },
} as const;

const VALID_ROLES = ["dean", "hod", "teacher"] as const;

export async function getOverviewData(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[]
) {
  const data = await getDataFromEnrollment();
  const { students: allStudents } = data;
  const hasValidUser =
    user && VALID_ROLES.includes(user.role as (typeof VALID_ROLES)[number]);
  let students = hasValidUser
    ? (getStudentsForRole(user as User, allStudents) as Student[])
    : allStudents;
  students = applyMasterFilter(students, masterFilter, data);
  students = applyGpaAttendanceFilter(students, gpaFilters, attendanceFilters);

  let yellowGpa = 0;
  let redGpa = 0;
  let yellowAttendance = 0;
  let redAttendance = 0;

  for (const s of students) {
    if (s.gpa.alert_level === "critical") redGpa += 1;
    if (s.gpa.alert_level === "warning") yellowGpa += 1;
    if (s.attendance.alert_level === "critical") redAttendance += 1;
    if (s.attendance.alert_level === "warning") yellowAttendance += 1;
  }

  const earlyAlertCount = students.filter(
    (s) => s.overall_alert === "critical" || s.overall_alert === "warning"
  ).length;

  // For faculty (dean) views, define total students as:
  // sum of the student counts of every department under that faculty,
  // based on enrollment_data.json (unique students per department).
  let totalStudents = students.length;
  if (user?.role === "dean" && user.faculty_id) {
    try {
      const deptStats = await getDepartmentStatsFromEnrollment(user.faculty_id);
      if (deptStats.length) {
        totalStudents = deptStats.reduce((sum, d) => sum + d.total, 0);
      }
    } catch {
      totalStudents = students.length;
    }
  }

  return {
    totalStudents,
    earlyAlertCount,
    yellowGpa: { value: yellowGpa },
    redGpa: { value: redGpa },
    yellowAttendance: { value: yellowAttendance },
    redAttendance: { value: redAttendance },
  };
}


function applyGpaAlertThreshold(student: Student): void {
  const drop = Math.abs(Math.min(0, student.gpa.change));
  if (drop >= THRESHOLDS.gpa.critical_drop) {
    student.gpa.alert_level = "critical";
  } else if (drop >= THRESHOLDS.gpa.warning_drop) {
    student.gpa.alert_level = "warning";
  } else {
    student.gpa.alert_level = null;
  }
  const g = student.gpa.alert_level;
  const a = student.attendance.alert_level;
  student.overall_alert =
    g === "critical" || a === "critical"
      ? "critical"
      : g === "warning" || a === "warning"
        ? "warning"
        : "none";
}

async function getDataFromEnrollment(): Promise<DataJson> {
  const records = await readEnrollmentFile();
  const students = buildStudentsFromEnrollment(records);
  const departments = buildDepartmentsFromEnrollment(records);
  const courses = buildCoursesFromEnrollment(records);
  let faculties = buildFacultiesFromEnrollment(records);
  const users = await getTeachersFromDbAndEnrollment(records);

  // Use faculty names from the database for the session user (e.g. dean header).
  if (pool) {
    try {
      const res = await pool.query<{ id: string; name: string }>(
        "SELECT id, name FROM faculties"
      );
      if (res.rows.length) {
        faculties = res.rows.map((r) => ({ id: r.id, name: r.name }));
      }
    } catch {
      // Ignore DB errors and keep enrollment-derived faculties instead.
    }
  }

  const useSap = process.env.USE_SAP_MONITORING === "true";
  let finalStudents = students;
  if (useSap) {
    try {
      const campus = process.env.SAP_CAMPUS ?? "11";
      const year = process.env.SAP_PYEAR ?? "2023";
      const session = process.env.SAP_PSESS ?? "001";
      const begda = process.env.SAP_BEGDA ?? "20230120";
      const endda = process.env.SAP_ENDDA ?? "20230520";
      const monitoringEntries = await fetchMonitoringEntries({
        Campus: campus,
        PYear: year,
        PSess: session,
        Begda: begda,
        Endda: endda,
      });
      finalStudents = mapMonitoringToStudents(monitoringEntries);
    } catch {
      // Keep enrollment-based students if SAP fails
    }
  }

  finalStudents.forEach(applyAttendanceAlertThreshold);
  finalStudents.forEach(applyGpaAlertThreshold);

  return {
    metadata: {
      thresholds: {
        attendance: { warning_percentage: THRESHOLDS.attendance.warning, critical_percentage: THRESHOLDS.attendance.critical },
        gpa: { warning_drop: THRESHOLDS.gpa.warning_drop, critical_drop: THRESHOLDS.gpa.critical_drop },
      },
    },
    faculties,
    departments,
    courses,
    users,
    students: finalStudents,
  };
}

export async function getFullData(): Promise<DataJson> {
  return getDataFromEnrollment();
}

function applyAttendanceAlertThreshold(student: Student): void {
  const att = student.attendance;
  const classAvg = att.class_average_attendance;
  const pct = att.attendance_percentage;

  if (!Number.isFinite(pct) || !Number.isFinite(classAvg)) {
    student.attendance.alert_level = null;
    return;
  }

  const diff = classAvg - pct; // positive = below class average
  if (diff >= 40) {
    student.attendance.alert_level = "critical";
  } else if (diff >= 20) {
    student.attendance.alert_level = "warning";
  } else {
    student.attendance.alert_level = null;
  }
}

/** Screen heading by role: Faculty name (dean) from faculties table, Department name(s) (hod), Instructor name (teacher). */
export function getScreenHeading(
  user: AppUser | null,
  data: { faculties: Faculty[]; departments: Department[] }
): string | null {
  if (!user) return null;
  if (user.role === "dean" && user.faculty_id) {
    return data.faculties.find((f) => f.id === user.faculty_id)?.name ?? null;
  }
  if (user.role === "hod" && user.department_ids?.length) {
    const names = data.departments
      .filter((d) => user.department_ids!.includes(d.id))
      .map((d) => d.name);
    return names.length ? names.join(", ") : null;
  }
  if (user.role === "teacher") return user.name;
  return null;
}

function applyMasterFilter(
  students: Student[],
  masterFilter: MasterFilterParams | undefined,
  data: DataJson
): Student[] {
  if (!masterFilter || Object.keys(masterFilter).length === 0) return students;
  let out = students;
  if (masterFilter.department_ids?.length) {
    out = out.filter((s) => masterFilter.department_ids!.includes(s.department_id));
  }
  if (masterFilter.programs?.length) {
    out = out.filter((s) =>
      masterFilter.programs!.includes(getProgramFromCourse(s.course_id))
    );
  }
  if (masterFilter.course_ids?.length) {
    out = out.filter((s) => masterFilter.course_ids!.includes(s.course_id));
  }
  if (masterFilter.instructor_ids?.length) {
    const courseIds = new Set<string>();
    for (const uid of masterFilter.instructor_ids) {
      const instructor = data.users.find(
        (u) => u.id === uid && u.role === "teacher" && u.course_ids?.length
      );
      instructor?.course_ids?.forEach((id) => courseIds.add(id));
    }
    if (courseIds.size) {
      out = out.filter((s) => courseIds.has(s.course_id));
    }
  }
  return out;
}

/** Get filter options with parent-child cascade: Department → Program → Course → Instructor. */
export async function getMasterFilterOptions(
  user?: AppUser | null,
  current?: MasterFilterParams
): Promise<MasterFilterOptions> {
  const data = await getDataFromEnrollment();

  // Prefer department names from the database when available; fall back to enrollment-derived departments.
  let departmentsSource: { id: string; name: string; faculty_id?: string }[] =
    data.departments;
  if (pool) {
    try {
      const res = await pool.query<{ id: string; name: string; faculty_id: string | null }>(
        "SELECT id, name, faculty_id FROM departments"
      );
      if (res.rows.length) {
        departmentsSource = res.rows.map((r: { id: string; name: string; faculty_id: string | null }) => ({
          id: r.id,
          name: r.name,
          faculty_id: r.faculty_id ?? undefined,
        }));
      }
    } catch {
      // Ignore DB errors and use enrollment-derived departments instead.
    }
  }

  const departments = getDepartmentsForRole(user as User, departmentsSource).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  let coursesForRole = getCoursesForRole(user as User, data.courses);

  // Cascade: filter courses by selected departments
  if (current?.department_ids?.length) {
    coursesForRole = coursesForRole.filter((c) =>
      current.department_ids!.includes(c.department_id)
    );
  }

  // Programs = program prefixes from (cascaded) courses
  const programSet = new Set(coursesForRole.map((c) => getProgramFromCourse(c.id)));
  const programs = Array.from(programSet)
    .sort((a, b) => a.localeCompare(b))
    .map((p) => ({ value: p, label: p }));

  // Cascade: filter courses by selected programs
  let coursesFiltered = coursesForRole;
  if (current?.programs?.length) {
    coursesFiltered = coursesFiltered.filter((c) =>
      current.programs!.includes(getProgramFromCourse(c.id))
    );
  }

  const courses = coursesFiltered.map((c) => ({
    value: c.id,
    label: `${c.id} – ${c.name}`,
  }));

  // Instructors: who teach (selected courses) or who teach any of the cascaded courses
  const courseIdsForInstructors = current?.course_ids?.length
    ? current.course_ids
    : coursesFiltered.map((c) => c.id);

  const teachers = data.users.filter((u) => u.role === "teacher" && u.department_id);
  let instructors: { value: string; label: string }[] = [];
  if (user?.role === "dean" && user.faculty_id) {
    const deptIdsInFaculty = data.departments
      .filter((d) => d.faculty_id === user.faculty_id)
      .map((d) => d.id);
    instructors = teachers
      .filter(
        (t) =>
          t.department_id &&
          deptIdsInFaculty.includes(t.department_id) &&
          t.course_ids?.some((cid) => courseIdsForInstructors.includes(cid))
      )
      .map((t) => ({ value: t.id, label: t.name }));
  } else if (user?.role === "hod" && user.department_ids?.length) {
    instructors = teachers
      .filter(
        (t) =>
          t.department_id &&
          user.department_ids!.includes(t.department_id) &&
          t.course_ids?.some((cid) => courseIdsForInstructors.includes(cid))
      )
      .map((t) => ({ value: t.id, label: t.name }));
  } else if (user?.role === "teacher") {
    instructors = teachers
      .filter(
        (t) =>
          t.id === user.id &&
          t.course_ids?.some((cid) => courseIdsForInstructors.includes(cid))
      )
      .map((t) => ({ value: t.id, label: t.name }));
  }
  instructors.sort((a, b) => a.label.localeCompare(b.label));

  return { departments, programs, instructors, courses };
}

export type DepartmentStats = {
  departmentId: string;
  departmentName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

/** Reads public/enrollment_data.json and returns department stats: unique department names and unique student count per department. Optional facultyId filters by FacId. Alert counts (yellow/red) are 0 as enrollment data has no GPA/attendance. */
export async function getDepartmentStatsFromEnrollment(
  facultyId?: string | null
): Promise<DepartmentStats[]> {
  try {
    const dataPath = path.join(process.cwd(), "public", ENROLLMENT_DATA_FILE);
    const raw = await readFile(dataPath, "utf-8");
    const records = JSON.parse(raw) as EnrollmentRecord[];
    if (!Array.isArray(records) || !records.length) return [];

    let list = records;
    if (facultyId) {
      const enrollmentFacId = FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
      list = list.filter((r) => r.FacId === enrollmentFacId);
    }

    // Unique students per department: key by DeptCode, value = Set of SapNo
    const byDept = new Map<string, { name: string; sapIds: Set<string> }>();
    for (const r of list) {
      const id = r.DeptCode || r.DeptId;
      const name = r.DeptName?.trim() || id;
      if (!id) continue;
      if (!byDept.has(id)) byDept.set(id, { name, sapIds: new Set() });
      byDept.get(id)!.sapIds.add(r.SapNo);
    }

    return Array.from(byDept.entries())
      .map(([departmentId, { name, sapIds }]) => ({
        departmentId,
        departmentName: name,
        total: sapIds.size,
        yellowGpa: 0,
        redGpa: 0,
        yellowAttendance: 0,
        redAttendance: 0,
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  } catch {
    return [];
  }
}

/** Stats per department for a faculty (dean view). When facultyId is null, returns all departments. Relation is one-way: department only (instructor does not filter departments). */
export async function getDeanDepartmentStats(
  facultyId: string | null,
  options?: { departmentIds?: string[] }
): Promise<DepartmentStats[]> {
  const useSap = process.env.USE_SAP_MONITORING === "true";
  const data = await getDataFromEnrollment();

  // SAP-backed path: derive departments from monitoring (student) data filtered by faculty NAME.
  // Here facultyId is treated as the faculty NAME coming from the logged-in dean, not an internal ID.
  if (useSap) {
    if (!facultyId) return [];

    const studentsForFaculty = data.students.filter(
      (s) => s.faculty_id === facultyId
    );
    if (!studentsForFaculty.length) return [];

    const byDeptName = new Map<string, Student[]>();
    for (const s of studentsForFaculty) {
      const deptKey = s.department_name ?? s.department_id;
      if (!deptKey) continue;
      if (!byDeptName.has(deptKey)) byDeptName.set(deptKey, []);
      byDeptName.get(deptKey)!.push(s);
    }

    let entries = Array.from(byDeptName.entries());
    if (options?.departmentIds?.length) {
      const filterSet = new Set(options.departmentIds);
      entries = entries.filter(([deptId]) => filterSet.has(deptId));
    }

    return entries.map(([deptId, deptStudents]) => {
      let yellowGpa = 0,
        redGpa = 0,
        yellowAttendance = 0,
        redAttendance = 0;
      for (const s of deptStudents) {
        if (s.gpa.alert_level === "critical") redGpa += 1;
        if (s.gpa.alert_level === "warning") yellowGpa += 1;
        if (s.attendance.alert_level === "critical") redAttendance += 1;
        if (s.attendance.alert_level === "warning") yellowAttendance += 1;
      }
      return {
        departmentId: deptId,
        departmentName: deptId,
        total: deptStudents.length,
        yellowGpa,
        redGpa,
        yellowAttendance,
        redAttendance,
      };
    });
  }

  let departments = facultyId
    ? data.departments.filter((d) => d.faculty_id === facultyId)
    : data.departments;

  if (options?.departmentIds?.length) {
    const set = new Set(options.departmentIds);
    departments = departments.filter((d) => set.has(d.id));
  }

  return departments.map((dept) => {
    const students = data.students.filter((s) => s.department_id === dept.id);
    let yellowGpa = 0,
      redGpa = 0,
      yellowAttendance = 0,
      redAttendance = 0;
    for (const s of students) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      total: students.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

export type InstructorStats = {
  instructorId: string;
  instructorName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

/** Reads public/enrollment_data.json and returns instructor stats: unique instructors by Pernr (teacher employee number), with unique student count per teacher. Optional facultyId/departmentIds/instructorIds filter. Alert counts are 0. */
export async function getInstructorStatsFromEnrollment(
  facultyId?: string | null,
  options?: { departmentIds?: string[]; instructorIds?: string[] }
): Promise<InstructorStats[]> {
  try {
    const dataPath = path.join(process.cwd(), "public", ENROLLMENT_DATA_FILE);
    const raw = await readFile(dataPath, "utf-8");
    const records = JSON.parse(raw) as EnrollmentRecord[];
    if (!Array.isArray(records) || !records.length) return [];

    let list = records;
    if (facultyId) {
      const enrollmentFacId = FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
      list = list.filter((r) => r.FacId === enrollmentFacId);
    }
    if (options?.departmentIds?.length) {
      const deptSet = new Set(options.departmentIds);
      list = list.filter((r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId));
    }
    if (options?.instructorIds?.length) {
      const instructorSet = new Set(options.instructorIds);
      list = list.filter((r) => r.Pernr && instructorSet.has(r.Pernr));
    }

    const byInstructor = new Map<string, { name: string; sapIds: Set<string> }>();
    for (const r of list) {
      const pernr = (r.Pernr ?? "").trim();
      if (!pernr) continue;
      const name = (r.Teacher ?? pernr).trim();
      if (!byInstructor.has(pernr)) byInstructor.set(pernr, { name, sapIds: new Set() });
      byInstructor.get(pernr)!.sapIds.add(r.SapNo);
    }

    return Array.from(byInstructor.entries())
      .map(([instructorId, { name, sapIds }]) => ({
        instructorId,
        instructorName: name,
        total: sapIds.size,
        yellowGpa: 0,
        redGpa: 0,
        yellowAttendance: 0,
        redAttendance: 0,
      }))
      .sort((a, b) => a.instructorName.localeCompare(b.instructorName));
  } catch {
    return [];
  }
}

/** Stats per instructor for a faculty (dean view). Returns instructors in departments under the given faculty. */
export async function getDeanInstructorStats(
  facultyId: string | null,
  options?: { departmentIds?: string[]; instructorIds?: string[] }
): Promise<InstructorStats[]> {
  const data = await getDataFromEnrollment();
  const deptIdsInFaculty =
    facultyId != null
      ? data.departments.filter((d) => d.faculty_id === facultyId).map((d) => d.id)
      : data.departments.map((d) => d.id);

  let teachers = data.users.filter(
    (u) =>
      u.role === "teacher" &&
      u.department_id &&
      deptIdsInFaculty.includes(u.department_id) &&
      u.course_ids?.length
  );

  if (options?.instructorIds?.length) {
    const set = new Set(options.instructorIds);
    teachers = teachers.filter((t) => set.has(t.id));
  } else if (options?.departmentIds?.length) {
    const set = new Set(options.departmentIds);
    teachers = teachers.filter((t) => t.department_id && set.has(t.department_id));
  }

  return teachers.map((teacher) => {
    const courseIds = new Set(teacher.course_ids ?? []);
    const students = data.students.filter((s) => courseIds.has(s.course_id));
    let yellowGpa = 0,
      redGpa = 0,
      yellowAttendance = 0,
      redAttendance = 0;
    for (const s of students) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      instructorId: teacher.id,
      instructorName: teacher.name,
      total: students.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

/** Reads public/enrollment_data.json and returns program stats: unique program (DegreeCode/DegreeTitle) and unique student count per program. Optional facultyId filters by FacId; optional departmentIds filter by DeptCode. Alert counts are 0. */
export async function getProgramStatsFromEnrollment(
  facultyId?: string | null,
  options?: { departmentIds?: string[] }
): Promise<ProgramStats[]> {
  try {
    const dataPath = path.join(process.cwd(), "public", ENROLLMENT_DATA_FILE);
    const raw = await readFile(dataPath, "utf-8");
    const records = JSON.parse(raw) as EnrollmentRecord[];
    if (!Array.isArray(records) || !records.length) return [];

    let list = records;
    if (facultyId) {
      const enrollmentFacId = FACULTY_ID_TO_ENROLLMENT_FAC_ID[facultyId] ?? facultyId;
      list = list.filter((r) => r.FacId === enrollmentFacId);
    }
    if (options?.departmentIds?.length) {
      const deptSet = new Set(options.departmentIds);
      list = list.filter((r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId));
    }

    const byProgram = new Map<string, { title: string; sapIds: Set<string> }>();
    for (const r of list) {
      const id = (r.DegreeCode || r.DeptCode || "").trim();
      const title = (r.DegreeTitle || r.DeptName || id || "Unknown").trim();
      if (!id) continue;
      if (!byProgram.has(id)) byProgram.set(id, { title, sapIds: new Set() });
      byProgram.get(id)!.sapIds.add(r.SapNo);
    }

    return Array.from(byProgram.entries())
      .map(([programId, { title, sapIds }]) => ({
        programId,
        programTitle: title,
        total: sapIds.size,
        yellowGpa: 0,
        redGpa: 0,
        yellowAttendance: 0,
        redAttendance: 0,
      }))
      .sort((a, b) => (a.programTitle || a.programId).localeCompare(b.programTitle || b.programId));
  } catch {
    return [];
  }
}

/** Stats per program for a faculty (dean view). Departments can optionally be narrowed via departmentIds. */
export async function getDeanProgramStats(
  facultyId: string | null,
  options?: { departmentIds?: string[] }
): Promise<ProgramStats[]> {
  if (!facultyId) return [];
  const data = await getDataFromEnrollment();
  const deptIdsInFaculty = data.departments
    .filter((d) => d.faculty_id === facultyId)
    .map((d) => d.id);

  if (!deptIdsInFaculty.length) return [];

  let departmentIds = deptIdsInFaculty;
  if (options?.departmentIds?.length) {
    const filterSet = new Set(options.departmentIds);
    departmentIds = deptIdsInFaculty.filter((id) => filterSet.has(id));
  }

  if (!departmentIds.length) return [];

  const deptSet = new Set(departmentIds);
  const students = data.students.filter((s) => deptSet.has(s.department_id));
  const byProgram = new Map<string, Student[]>();
  for (const s of students) {
    const programId = getProgramFromCourse(s.course_id);
    if (!byProgram.has(programId)) byProgram.set(programId, []);
    byProgram.get(programId)!.push(s);
  }
  const entries = Array.from(byProgram.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return entries.map(([programId, progStudents]) => {
    let yellowGpa = 0,
      redGpa = 0,
      yellowAttendance = 0,
      redAttendance = 0;
    for (const s of progStudents) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      programId,
      total: progStudents.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

export type ProgramStats = {
  programId: string;
  /** Optional display title (e.g. from enrollment DegreeTitle). */
  programTitle?: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

/** Stats per program for HoD (departments they head). */
export async function getHodProgramStats(
  departmentIds: string[]
): Promise<ProgramStats[]> {
  if (!departmentIds.length) return [];
  const data = await getDataFromEnrollment();
  const deptSet = new Set(departmentIds);
  const students = data.students.filter((s) => deptSet.has(s.department_id));
  const byProgram = new Map<string, Student[]>();
  for (const s of students) {
    const programId = getProgramFromCourse(s.course_id);
    if (!byProgram.has(programId)) byProgram.set(programId, []);
    byProgram.get(programId)!.push(s);
  }
  const entries = Array.from(byProgram.entries()).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([programId, progStudents]) => {
    let yellowGpa = 0, redGpa = 0, yellowAttendance = 0, redAttendance = 0;
    for (const s of progStudents) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      programId,
      total: progStudents.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

/** Instructor stats for HoD: teachers in the given department IDs. */
export async function getHodInstructorStats(
  departmentIds: string[],
  options?: { instructorIds?: string[]; programIds?: string[] }
): Promise<InstructorStats[]> {
  if (!departmentIds.length) return [];
  const data = await getDataFromEnrollment();
  const deptSet = new Set(departmentIds);

  let teachers = data.users.filter(
    (u) =>
      u.role === "teacher" &&
      u.department_id &&
      deptSet.has(u.department_id) &&
      u.course_ids?.length
  );

  if (options?.instructorIds?.length) {
    const set = new Set(options.instructorIds);
    teachers = teachers.filter((t) => set.has(t.id));
  }
  if (options?.programIds?.length) {
    const programSet = new Set(options.programIds);
    teachers = teachers.filter((t) => {
      const courseIds = t.course_ids ?? [];
      return courseIds.some((cid) => programSet.has(getProgramFromCourse(cid)));
    });
  }

  return teachers.map((teacher) => {
    const courseIds = new Set(teacher.course_ids ?? []);
    const students = data.students.filter((s) => courseIds.has(s.course_id));
    let yellowGpa = 0,
      redGpa = 0,
      yellowAttendance = 0,
      redAttendance = 0;
    for (const s of students) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      instructorId: teacher.id,
      instructorName: teacher.name,
      total: students.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

/** Map NextAuth session user (DB staff) to AppUser. Role "instructor" → "teacher". */
function sessionToAppUser(session: {
  user: {
    id: string;
    pernr: string;
    name: string;
    email: string;
    role: "dean" | "hod" | "instructor";
    faculty_id: string | null;
    department_ids: string[];
    img: string | null;
  };
}): AppUser {
  const u = session.user;
  return {
    id: u.id,
    img: u.img ?? null,
    sap_id: u.pernr,
    name: u.name,
    email: u.email,
    role: u.role === "instructor" ? "teacher" : u.role,
    faculty_id: u.faculty_id,
    department_id: u.department_ids?.[0] ?? null,
    department_ids: u.department_ids?.length ? u.department_ids : null,
    course_ids: null,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth-config");
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return sessionToAppUser(session);
}

/** Used only for legacy/cookie fallback; prefer NextAuth signIn. */
export async function findUserByEmailAndPassword(
  _email: string,
  _password: string
): Promise<AppUser | null> {
  return null;
}

const DEFAULT_PAGE_SIZE = 30;

export type StudentsByAlertResult = {
  students: Student[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getStudentsByAlert(
  alertFilter: string,
  options?: { page?: number; pageSize?: number },
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[]
): Promise<StudentsByAlertResult> {
  const data = await getDataFromEnrollment();
  const allRaw = data.students;
  const all = user
    ? (getStudentsForRole(user as User, allRaw) as Student[])
    : allRaw;

  const filter = isValidAlertFilter(alertFilter) ? alertFilter : "all";

  let filtered =
    filter === "all"
      ? all
      : all.filter((s) => {
          if (filter === "early_alert")
            return s.overall_alert === "critical" || s.overall_alert === "warning";
          if (filter === "gpa") return s.gpa.alert_level !== null;
          if (filter === "attendance") return s.attendance.alert_level !== null;
          if (filter === "yellow_gpa") return s.gpa.alert_level === "warning";
          if (filter === "red_gpa") return s.gpa.alert_level === "critical";
          if (filter === "yellow_attendance") return s.attendance.alert_level === "warning";
          if (filter === "red_attendance") return s.attendance.alert_level === "critical";
          return false;
        });

  filtered = applyMasterFilter(filtered, masterFilter, data);
  filtered = applyGpaAttendanceFilter(filtered, gpaFilters, attendanceFilters);

  const total = filtered.length;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, options?.page ?? 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return { students, total, page, pageSize, totalPages };
}

export type InterventionChartDataPoint = { x: string; y: number };

export type InterventionChartResult = {
  data: InterventionChartDataPoint[];
  statusColors: Record<string, string>;
};

/** Intervention stats for the campaign visitors chart: counts by status for the logged-in user's alert students. Sum of counts = totalAlertCount. */
export async function getInterventionChartData(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[],
): Promise<InterventionChartResult> {
  // 1) Total alerts (yellow + red) using same logic as Attendance card
  const overview = await getOverviewData(
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters,
  );
  const totalAlertStudents =
    (overview.yellowAttendance?.value ?? 0) +
    (overview.redAttendance?.value ?? 0);

  // 2) Read interventions table and aggregate latest status per student (role scoped)
  let notStarted = 0;
  let initiated = 0;
  let inProgress = 0;
  let referred = 0;
  let resolved = 0;

  if (pool) {
    const whereParts: string[] = [];
    const params: any[] = [];

    if (user?.role === "dean" && user.faculty_id) {
      whereParts.push("faculty_id = $1");
      params.push(user.faculty_id);
    } else if (user?.role === "hod" && user.department_ids?.length) {
      whereParts.push("department_id = ANY($1)");
      params.push(user.department_ids);
    } else if (user?.role === "teacher") {
      whereParts.push("staff_id = $1");
      params.push(user.id);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const res = await pool.query<{
      student_sap_id: string;
      status: string | null;
    }>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (student_sap_id)
          student_sap_id,
          status
        FROM interventions
        ${whereClause}
        ORDER BY student_sap_id, performed_at DESC
      )
      SELECT student_sap_id, status
      FROM latest
      `,
      params,
    );

    console.log("[InterventionChart] interventions", res.rows.length);

    for (const row of res.rows) {
      const status = row.status;
      if (!status) continue;
      if (status === "initiated") initiated += 1;
      else if (status === "in-progress") inProgress += 1;
      else if (status === "referred") referred += 1;
      else if (status === "resolved") resolved += 1;
      else {
        // Unknown status: treat as initiated bucket by default.
        initiated += 1;
      }
    }

    // 3) Not Started = Total Alerts (yellow+red) − total interventions count
    const totalInterventionStudents =
      initiated + inProgress + referred + resolved;
    notStarted = Math.max(
      0,
      totalAlertStudents - totalInterventionStudents,
    );
  } else {
    notStarted = totalAlertStudents;
  }

  const statusColors: Record<string, string> = {
    "Not Started": "#DE2649",
    Initiated: "#B5B126",
    "In-Progress": "#DBBE0F",
    Referred: "#9C5A99",
    Resolved: "#477061",
  };

  const data: InterventionChartDataPoint[] = [
    { x: "Not Started", y: notStarted },
    { x: "Initiated", y: initiated },
    { x: "In-Progress", y: inProgress },
    { x: "Resolved", y: resolved },
    { x: "Referred", y: referred },
  ];

  return {
    data,
    statusColors,
  };
}

/** Wellbeing stacked chart: open/closed cases per category for alert students visible to the user. */
export async function getWellbeingChartData(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[]
): Promise<StatusStackedChartData> {
  const result = await getStudentsByAlert(
    "early_alert",
    { page: 1, pageSize: 100000 },
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters
  );
  const sapIds = result.students.map((s) => s.sap_id);
  return getWellbeingChartDataForStudents(sapIds);
}

export async function getStudentBySapId(sapId: string): Promise<Student | null> {
  try {
    const sapStudents = await getMonitoringStudentsBySapId(sapId);
    if (sapStudents.length > 0) return sapStudents[0];
  } catch {
    // SAP not configured or request failed; fall back to enrollment.
  }
  const records = await readEnrollmentFile();
  const first = records.find((r) => String(r.SapNo ?? "").trim() === String(sapId).trim());
  if (!first?.DeptId || !first?.FacId) return null;
  const student = defaultStudent(
    first.SapNo ?? sapId,
    (first.Name ?? "").trim(),
    first.DeptId,
    first.FacId,
    (first.CrCode ?? "").trim() || "—"
  );
  applyGpaAlertThreshold(student);
  return student;
}

/** Legacy alias for route compatibility (route param is still "id" but value is sap_id) */
export const getStudentById = getStudentBySapId;

export type AlertReport = {
  student_sap_id: string;
  attendance_comparison: {
    student_percentage: number;
    class_average: number;
    deviation: number;
    total_classes: number;
    attended: number;
    total_students: number;
    status: "above_average" | "below_average" | "critical";
  };
  gpa_comparison: {
    current: number;
    previous: number;
    change: number;
    trend: string;
    class_average_current: number;
    class_average_previous: number;
    history: GpaHistoryEntry[];
    alert_triggered: boolean;
    alert_reason: string | null;
  };
};

export function generateAlertReport(student: Student): AlertReport {
  const att = student.attendance;
  const gpa = student.gpa;

  let attStatus: "above_average" | "below_average" | "critical" = "above_average";
  if (att.deviation_from_class_avg < 0) {
    attStatus = att.attendance_percentage <= THRESHOLDS.attendance.critical ? "critical" : "below_average";
  }

  const gpaDrop = Math.abs(Math.min(0, gpa.change));
  let alertReason: string | null = null;
  if (student.gpa.alert_level === "critical") {
    alertReason = "GPA drop >= 1.0";
  } else if (student.gpa.alert_level === "warning") {
    alertReason = "GPA drop >= 0.5";
  }

  return {
    student_sap_id: student.sap_id,
    attendance_comparison: {
      student_percentage: att.attendance_percentage,
      class_average: att.class_average_attendance,
      deviation: att.deviation_from_class_avg,
      total_classes: att.total_classes_held,
      attended: att.classes_attended,
      total_students: att.total_students_in_class ?? 0,
      status: attStatus,
    },
    gpa_comparison: {
      current: gpa.current,
      previous: gpa.previous,
      change: gpa.change,
      trend: gpa.trend,
      class_average_current: gpa.class_average_gpa_current,
      class_average_previous: gpa.class_average_gpa_previous,
      history: gpa.history,
      alert_triggered: student.gpa.alert_level !== null,
      alert_reason: alertReason,
    },
  };
}

export async function getChatsData() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return [
    { name: "Jacob Jones", profile: "/images/user/user-01.png", isActive: true, lastMessage: { content: "See you tomorrow at the meeting!", type: "text", timestamp: "2024-12-19T14:30:00Z", isRead: false }, unreadCount: 3 },
    { name: "Wilium Smith", profile: "/images/user/user-03.png", isActive: true, lastMessage: { content: "Thanks for the update", type: "text", timestamp: "2024-12-19T10:15:00Z", isRead: true }, unreadCount: 0 },
    { name: "Johurul Haque", profile: "/images/user/user-04.png", isActive: false, lastMessage: { content: "What's up?", type: "text", timestamp: "2024-12-19T10:15:00Z", isRead: true }, unreadCount: 0 },
    { name: "M. Chowdhury", profile: "/images/user/user-05.png", isActive: false, lastMessage: { content: "Where are you now?", type: "text", timestamp: "2024-12-19T10:15:00Z", isRead: true }, unreadCount: 2 },
    { name: "Akagami", profile: "/images/user/user-07.png", isActive: false, lastMessage: { content: "Hey, how are you?", type: "text", timestamp: "2024-12-19T10:15:00Z", isRead: true }, unreadCount: 0 },
  ];
}
