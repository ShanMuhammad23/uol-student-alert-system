import { getStudentsForRole, getCoursesForRole, getDepartmentsForRole } from "@/lib/role";
import type { User } from "@/lib/role";
import { getLatestInterventionStatusMap } from "@/data/intervention-store";
import { getWellbeingChartDataForStudents } from "@/lib/db/wellbeing";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";
import {
  getDistinctSapIdsForScope,
  type SessionScope as ListingSessionScope,
} from "@/lib/db/student-listing";
import { pool } from "@/lib/db";
import { authOptions } from "@/lib/auth-config";
import { fetchMonitoringEntries, mapMonitoringToStudents, getMonitoringStudentsBySapId } from "@/lib/sap-monitoring";
import { getServerSession } from "next-auth";
import { getAttendanceAlertLevel } from "@/lib/attendance-utils";
import { normalizeFacultyName } from "@/lib/faculty-name";

/** Minimal enrollment shape (one row per course enrollment; same student can appear multiple times). */
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
  if (!pool) return [];
  try {
    const res = await pool.query<{
      sap_id: string;
      student_name: string | null;
      faculty_id: string | null;
      department_id: string;
      department_code: string | null;
      department_name: string | null;
      program_id: string | null;
      program_title: string | null;
      course_id: string;
      course_title: string | null;
      section_code: string | null;
      instructor_name: string | null;
      instructor_pernr: string | null;
      campus_code: string | null;
      term_year: string | null;
      term_session: string | null;
      event_package_id: string | null;
    }>(
      `SELECT
         e.sap_id,
         e.student_name,
         e.faculty_id,
         e.department_id,
         d.code AS department_code,
         d.name AS department_name,
         e.program_id,
         p.title AS program_title,
         e.course_id,
         c.title AS course_title,
         e.section_code,
         e.instructor_name,
         e.instructor_pernr,
         e.campus_code,
         e.term_year,
         e.term_session,
         e.event_package_id
       FROM student_enrollment_current e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN programs p ON p.id = e.program_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE e.is_active = TRUE`
    );
    return res.rows.map((r) => ({
      SapNo: r.sap_id,
      Name: r.student_name ?? r.sap_id,
      FacId: r.faculty_id ?? undefined,
      DeptId: r.department_id,
      DeptCode: r.department_code ?? r.department_id,
      DeptName: r.department_name ?? r.department_id,
      DegreeCode: r.program_id ?? undefined,
      DegreeTitle: r.program_title ?? undefined,
      CrCode: r.course_id,
      CrTitle: r.course_title ?? r.course_id,
      Section: r.section_code ?? undefined,
      Teacher: r.instructor_name ?? undefined,
      Pernr: r.instructor_pernr ?? undefined,
      CampCode: r.campus_code ?? undefined,
      Peryr: r.term_year ?? undefined,
      Perid: r.term_session ?? undefined,
      Packnumber: r.event_package_id ?? undefined,
    }));
  } catch {
    return [];
  }
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
    if (!byId.has(id)) {
      byId.set(id, { id, name: normalizeFacultyName(id) ?? `Faculty ${id}` });
    }
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
    role: "instructor" as const,
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
  role:
    | "superadmin"
    | "dean"
    | "hod"
    | "teacher"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller";
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

type DbOverviewRow = {
  total_students: number | string | null;
  yellow_gpa: number | string | null;
  red_gpa: number | string | null;
  yellow_attendance: number | string | null;
  red_attendance: number | string | null;
};

type DbDimensionCountRow = {
  dimension_id: string;
  dimension_name: string;
  total_students: number | string | null;
  yellow_gpa: number | string | null;
  red_gpa: number | string | null;
  yellow_attendance: number | string | null;
  red_attendance: number | string | null;
};

function toInt(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const LATEST_ALERT_COUNTS_SNAPSHOT_SQL = `
  WITH per_snapshot AS (
    SELECT
      snapshot_date,
      MAX(created_at) AS latest_created_at,
      COUNT(DISTINCT dimension_type) AS type_count
    FROM alert_counts_by_dimension
    GROUP BY snapshot_date
  ),
  best_complete AS (
    SELECT snapshot_date, latest_created_at
    FROM per_snapshot
    WHERE type_count >= 5
    ORDER BY latest_created_at DESC NULLS LAST, snapshot_date DESC
    LIMIT 1
  ),
  best_any AS (
    SELECT snapshot_date, latest_created_at
    FROM per_snapshot
    ORDER BY latest_created_at DESC NULLS LAST, snapshot_date DESC
    LIMIT 1
  )
  SELECT COALESCE(c.snapshot_date, a.snapshot_date)
  FROM best_any a
  FULL OUTER JOIN best_complete c ON TRUE
  LIMIT 1
`;

export type LatestAlertCountsSnapshot = {
  snapshotDate: string | null;
  createdAt: string | null;
};

export async function getLatestAlertCountsSnapshot(): Promise<LatestAlertCountsSnapshot> {
  if (!pool) return { snapshotDate: null, createdAt: null };
  try {
    const res = await pool.query<{ snapshot_date: string | null; created_at: string | null }>(
      `
        WITH per_snapshot AS (
          SELECT
            snapshot_date,
            MAX(created_at) AS latest_created_at,
            COUNT(DISTINCT dimension_type) AS type_count
          FROM alert_counts_by_dimension
          GROUP BY snapshot_date
        ),
        best_complete AS (
          SELECT
            snapshot_date,
            latest_created_at
          FROM per_snapshot
          WHERE type_count >= 5
          ORDER BY latest_created_at DESC NULLS LAST, snapshot_date DESC
          LIMIT 1
        ),
        best_any AS (
          SELECT
            snapshot_date,
            latest_created_at
          FROM per_snapshot
          ORDER BY latest_created_at DESC NULLS LAST, snapshot_date DESC
          LIMIT 1
        )
        SELECT
          COALESCE(c.snapshot_date, a.snapshot_date)::text AS snapshot_date,
          COALESCE(c.latest_created_at, a.latest_created_at)::text AS created_at
        FROM best_any a
        FULL OUTER JOIN best_complete c ON TRUE
        LIMIT 1
      `
    );
    const row = res.rows[0];
    return {
      snapshotDate: row?.snapshot_date ?? null,
      createdAt: row?.created_at ?? null,
    };
  } catch {
    return { snapshotDate: null, createdAt: null };
  }
}

async function getDimensionCountsFromDb(
  dimensionType: "program" | "instructor",
  ids: string[]
): Promise<Map<string, DbDimensionCountRow>> {
  const map = new Map<string, DbDimensionCountRow>();
  if (!pool || !ids.length) return map;
  const res = await pool.query<DbDimensionCountRow>(
    `SELECT
       dimension_id,
       dimension_name,
       total_students,
       yellow_gpa,
       red_gpa,
       yellow_attendance,
       red_attendance
     FROM alert_counts_by_dimension
     WHERE snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL})
       AND dimension_type = $1
       AND dimension_id = ANY($2)`,
    [dimensionType, ids]
  );
  for (const row of res.rows) {
    map.set(row.dimension_id, row);
  }
  return map;
}

type MissingDimensionType = "department" | "program" | "course" | "instructor";

type MissingScope = {
  facultyId?: string | null;
  facultyIds?: string[];
  departmentIds?: string[];
  programIds?: string[];
  courseIds?: string[];
  instructorIds?: string[];
};

function buildFacultyScopeIds(facultyId: string | null | undefined): string[] {
  const raw = String(facultyId ?? "").trim();
  if (!raw) return [];
  const mapped = FACULTY_ID_TO_ENROLLMENT_FAC_ID[raw];
  return Array.from(new Set([raw, mapped].filter(Boolean) as string[]));
}

type ScopedDimensionType = "department" | "program" | "course" | "instructor";

async function getScopedDimensionCountsFromLive(
  dimensionType: ScopedDimensionType,
  scope: MissingScope
): Promise<
  Array<{
    dimension_id: string;
    dimension_name: string;
    total_students: number | string | null;
    yellow_gpa: number | string | null;
    red_gpa: number | string | null;
    yellow_attendance: number | string | null;
    red_attendance: number | string | null;
  }>
> {
  if (!pool) return [];
  const dimensionIdExpr =
    dimensionType === "department"
      ? "e.department_id"
      : dimensionType === "program"
        ? "e.program_id"
        : dimensionType === "course"
          ? "e.course_id"
          : "e.instructor_pernr";
  const dimensionIdTextExpr = `COALESCE(${dimensionIdExpr}::text, '')`;
  const params: unknown[] = [];
  const where: string[] = [
    "e.is_active = TRUE",
    `${dimensionIdTextExpr} <> ''`,
  ];
  if (scope.facultyIds?.length) {
    params.push(scope.facultyIds);
    where.push(`e.faculty_id = ANY($${params.length}::text[])`);
  } else if (scope.facultyId) {
    params.push(scope.facultyId);
    where.push(`e.faculty_id = $${params.length}`);
  }
  if (scope.departmentIds?.length) {
    params.push(scope.departmentIds);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  }
  if (scope.programIds?.length) {
    params.push(scope.programIds);
    where.push(`e.program_id = ANY($${params.length}::text[])`);
  }
  if (scope.courseIds?.length) {
    params.push(scope.courseIds);
    where.push(`e.course_id = ANY($${params.length}::text[])`);
  }
  if (scope.instructorIds?.length) {
    params.push(scope.instructorIds);
    where.push(`e.instructor_pernr = ANY($${params.length}::text[])`);
  }

  const dimensionSql =
    dimensionType === "department"
      ? `e.department_id::text AS dimension_id,
         COALESCE(NULLIF(TRIM(d.name), ''), e.department_id) AS dimension_name`
      : dimensionType === "program"
        ? `e.program_id::text AS dimension_id,
           COALESCE(NULLIF(TRIM(p.title), ''), e.program_id) AS dimension_name`
        : dimensionType === "course"
          ? `e.course_id::text AS dimension_id,
             COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS dimension_name`
          : `e.instructor_pernr::text AS dimension_id,
             COALESCE(
               NULLIF(TRIM(s.name), ''),
               NULLIF(TRIM(e.instructor_name), ''),
               e.instructor_pernr
             ) AS dimension_name`;

  const whereSql = where.join(" AND ");
  const res = await pool.query<{
    dimension_id: string;
    dimension_name: string;
    total_students: number | string | null;
    yellow_gpa: number | string | null;
    red_gpa: number | string | null;
    yellow_attendance: number | string | null;
    red_attendance: number | string | null;
  }>(
    `WITH scoped AS (
       SELECT
         ${dimensionSql},
         e.sap_id,
         MAX(
           CASE
             WHEN a.gpa_alert_level = 'critical' THEN 2
             WHEN a.gpa_alert_level = 'warning' THEN 1
             ELSE 0
           END
         ) AS gpa_sev,
         MAX(
           CASE WHEN a.attendance_alert_level = 'warning' THEN 1 ELSE 0 END
         ) AS attendance_has_warning,
         MAX(
           CASE
             WHEN a.attendance_alert_level = 'critical'
               OR (
                 a.attendance_percentage IS NOT NULL
                 AND a.attendance_percentage <= 60
               ) THEN 1
             ELSE 0
           END
         ) AS attendance_has_critical
       FROM student_enrollment_current e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN programs p ON p.id = e.program_id
       LEFT JOIN courses c ON c.id = e.course_id
       LEFT JOIN staff s ON s.pernr = e.instructor_pernr
       LEFT JOIN student_alert_current a
         ON a.sap_id = e.sap_id
        AND a.course_id = e.course_id
        AND a.section_code = e.section_code
        AND a.event_package_id = e.event_package_id
       WHERE ${whereSql}
      GROUP BY dimension_id, dimension_name, e.sap_id
     )
     SELECT
       dimension_id,
       dimension_name,
       COUNT(*)::int AS total_students,
       COUNT(*) FILTER (WHERE gpa_sev = 1)::int AS yellow_gpa,
       COUNT(*) FILTER (WHERE gpa_sev = 2)::int AS red_gpa,
       COUNT(*) FILTER (WHERE attendance_has_warning = 1)::int AS yellow_attendance,
       COUNT(*) FILTER (WHERE attendance_has_critical = 1)::int AS red_attendance
     FROM scoped
     GROUP BY dimension_id, dimension_name
     ORDER BY dimension_name ASC`,
    params
  );

  return res.rows;
}

async function getAttendanceMissingByDimension(
  dimensionType: MissingDimensionType,
  ids: string[],
  scope?: MissingScope
): Promise<Map<string, { missing: number; held: number }>> {
  const map = new Map<string, { missing: number; held: number }>();
  if (!pool || !ids.length) return map;

  const dimensionExpr =
    dimensionType === "department"
      ? "e.department_id"
      : dimensionType === "program"
        ? "e.program_id"
        : dimensionType === "course"
          ? "e.course_id"
          : "e.instructor_pernr";

  const where: string[] = [
    "e.is_active = TRUE",
    `${dimensionExpr} = ANY($1::text[])`,
  ];
  const params: unknown[] = [ids];

  if (scope?.facultyIds?.length) {
    params.push(scope.facultyIds);
    where.push(`e.faculty_id = ANY($${params.length}::text[])`);
  } else if (scope?.facultyId) {
    params.push(scope.facultyId);
    where.push(`e.faculty_id = $${params.length}`);
  }
  if (scope?.departmentIds?.length) {
    params.push(scope.departmentIds);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  }
  if (scope?.programIds?.length) {
    params.push(scope.programIds);
    where.push(`e.program_id = ANY($${params.length}::text[])`);
  }
  if (scope?.courseIds?.length) {
    params.push(scope.courseIds);
    where.push(`e.course_id = ANY($${params.length}::text[])`);
  }
  if (scope?.instructorIds?.length) {
    params.push(scope.instructorIds);
    where.push(`e.instructor_pernr = ANY($${params.length}::text[])`);
  }

  const res =
    dimensionType === "program"
      ? await pool.query<{
          dimension_id: string;
          missing_count: number | string | null;
          held_count: number | string | null;
        }>(
          `WITH scoped AS (
             SELECT
               e.program_id AS dimension_id,
               e.sap_id,
               e.course_id,
               e.section_code,
               e.event_package_id,
               COALESCE(a.total_classes_held, 0) AS held,
               COALESCE(a.attendance_marked_classes, 0) AS marked
             FROM student_enrollment_current e
             LEFT JOIN student_alert_current a
               ON a.sap_id = e.sap_id
              AND a.course_id = e.course_id
              AND a.section_code = e.section_code
              AND a.event_package_id = e.event_package_id
             WHERE ${where.join(" AND ")}
           ),
           class_max AS (
             SELECT
               course_id,
               section_code,
               event_package_id,
               MAX(held) AS held,
               MAX(marked) AS marked
             FROM scoped
             WHERE dimension_id IS NOT NULL AND dimension_id <> ''
             GROUP BY course_id, section_code, event_package_id
           ),
           class_program_counts AS (
             SELECT
               dimension_id,
               course_id,
               section_code,
               event_package_id,
               COUNT(DISTINCT sap_id)::int AS student_count
             FROM scoped
             WHERE dimension_id IS NOT NULL AND dimension_id <> ''
             GROUP BY dimension_id, course_id, section_code, event_package_id
           ),
           class_program_owner AS (
             SELECT
               dimension_id,
               course_id,
               section_code,
               event_package_id
             FROM (
               SELECT
                 cpc.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY cpc.course_id, cpc.section_code, cpc.event_package_id
                   ORDER BY cpc.student_count DESC, cpc.dimension_id ASC
                 ) AS rn
               FROM class_program_counts cpc
             ) ranked
             WHERE rn = 1
           )
           SELECT
             owner.dimension_id,
            COALESCE(SUM(GREATEST(cm.held - cm.marked, 0)), 0) AS missing_count,
            COALESCE(SUM(cm.held), 0) AS held_count
           FROM class_program_owner owner
           JOIN class_max cm
             ON cm.course_id = owner.course_id
            AND cm.section_code = owner.section_code
            AND cm.event_package_id = owner.event_package_id
           GROUP BY owner.dimension_id`,
          params
        )
      : await pool.query<{
          dimension_id: string;
          missing_count: number | string | null;
          held_count: number | string | null;
        }>(
          `WITH scoped AS (
             SELECT
               ${dimensionExpr} AS dimension_id,
               e.course_id,
               e.section_code,
               e.event_package_id,
               COALESCE(a.total_classes_held, 0) AS held,
               COALESCE(a.attendance_marked_classes, 0) AS marked
             FROM student_enrollment_current e
             LEFT JOIN student_alert_current a
               ON a.sap_id = e.sap_id
              AND a.course_id = e.course_id
              AND a.section_code = e.section_code
              AND a.event_package_id = e.event_package_id
             WHERE ${where.join(" AND ")}
           ),
           class_max AS (
             SELECT
               dimension_id,
               course_id,
               section_code,
               event_package_id,
               MAX(held) AS held,
               MAX(marked) AS marked
             FROM scoped
             WHERE dimension_id IS NOT NULL AND dimension_id <> ''
             GROUP BY dimension_id, course_id, section_code, event_package_id
           )
           SELECT
             dimension_id,
            COALESCE(SUM(GREATEST(held - marked, 0)), 0) AS missing_count,
            COALESCE(SUM(held), 0) AS held_count
           FROM class_max
           GROUP BY dimension_id`,
          params
        );

  for (const row of res.rows) {
    map.set(row.dimension_id, {
      missing: toInt(row.missing_count),
      held: toInt(row.held_count),
    });
  }
  return map;
}

function applyDimensionFilterToCounts(
  yellow: number,
  red: number,
  filters?: AlertDimensionFilter[]
): { yellow: number; red: number } {
  if (!filters?.length) return { yellow, red };
  const hasYellow = filters.includes("yellow");
  const hasRed = filters.includes("red");
  const hasGood = filters.includes("good");
  if (hasGood && !hasYellow && !hasRed) return { yellow: 0, red: 0 };
  return {
    yellow: hasYellow ? yellow : 0,
    red: hasRed ? red : 0,
  };
}

function getDbScope(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams
): { dimensionType: "faculty" | "department" | "program" | "course" | "instructor"; ids?: string[] } {
  if (masterFilter?.course_ids?.length) {
    return { dimensionType: "course", ids: masterFilter.course_ids };
  }
  if (masterFilter?.instructor_ids?.length) {
    return { dimensionType: "instructor", ids: masterFilter.instructor_ids };
  }
  if (masterFilter?.programs?.length) {
    return { dimensionType: "program", ids: masterFilter.programs };
  }
  if (masterFilter?.department_ids?.length) {
    return { dimensionType: "department", ids: masterFilter.department_ids };
  }
  if (user?.role === "instructor" && user.sap_id) {
    return { dimensionType: "instructor", ids: [user.sap_id] };
  }
  if (user?.role === "hod" && user.department_ids?.length) {
    return { dimensionType: "department", ids: user.department_ids };
  }
  if (user?.role === "dean" && user.faculty_id) {
    const mappedFacultyId =
      FACULTY_ID_TO_ENROLLMENT_FAC_ID[user.faculty_id] ?? user.faculty_id;
    return { dimensionType: "faculty", ids: [mappedFacultyId] };
  }
  return { dimensionType: "faculty" };
}

async function getOverviewDataFromDb(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[]
) {
  if (!pool) return null;
  const scope = getDbScope(user, masterFilter);
  const params: unknown[] = [scope.dimensionType];
  let where = `snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL}) AND dimension_type = $1`;
  if (scope.ids?.length) {
    params.push(scope.ids);
    where += ` AND dimension_id = ANY($2)`;
  }
  const res = await pool.query<DbOverviewRow>(
    `SELECT
       COALESCE(SUM(total_students), 0) AS total_students,
       COALESCE(SUM(yellow_gpa), 0) AS yellow_gpa,
       COALESCE(SUM(red_gpa), 0) AS red_gpa,
       COALESCE(SUM(yellow_attendance), 0) AS yellow_attendance,
       COALESCE(SUM(red_attendance), 0) AS red_attendance
     FROM alert_counts_by_dimension
     WHERE ${where}`,
    params
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  const gpa = applyDimensionFilterToCounts(
    toInt(row.yellow_gpa),
    toInt(row.red_gpa),
    gpaFilters
  );
  const attendance = applyDimensionFilterToCounts(
    toInt(row.yellow_attendance),
    toInt(row.red_attendance),
    attendanceFilters
  );
  return {
    totalStudents: toInt(row.total_students),
    earlyAlertCount: gpa.yellow + gpa.red + attendance.yellow + attendance.red,
    yellowGpa: { value: gpa.yellow },
    redGpa: { value: gpa.red },
    yellowAttendance: { value: attendance.yellow },
    redAttendance: { value: attendance.red },
  };
}

export type AttendanceCoverageData = {
  updatedAttendance: number;
  totalClassesHeld: number;
};

export async function getAttendanceCoverageData(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams
): Promise<AttendanceCoverageData> {
  if (!pool) return { updatedAttendance: 0, totalClassesHeld: 0 };
  const scope = getDbScope(user, masterFilter);
  const dimColumn: Record<
    "faculty" | "department" | "program" | "course" | "instructor",
    string
  > = {
    faculty: "e.faculty_id",
    department: "e.department_id",
    program: "e.program_id",
    course: "e.course_id",
    instructor: "e.instructor_pernr",
  };
  const params: unknown[] = [];
  const where: string[] = ["e.is_active = TRUE"];
  if (scope.ids?.length) {
    params.push(scope.ids);
    where.push(`${dimColumn[scope.dimensionType]} = ANY($${params.length}::text[])`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const res = await pool.query<{
    updated_attendance: number | string | null;
    total_classes_held: number | string | null;
  }>(
    `
      WITH scoped_class_rows AS (
        SELECT
          e.course_id,
          e.section_code,
          -- student_alert_current stores class metrics per enrollment row.
          -- Use MAX per class (course+section) to avoid multiplying by student count.
          COALESCE(MAX(COALESCE(a.attendance_marked_classes, 0)), 0) AS attendance_marked_classes,
          COALESCE(MAX(COALESCE(a.total_classes_held, 0)), 0) AS total_classes_held
        FROM student_enrollment_current e
        LEFT JOIN student_alert_current a
          ON a.sap_id = e.sap_id
         AND a.course_id = e.course_id
         AND a.section_code = e.section_code
         AND a.event_package_id = e.event_package_id
        ${whereSql}
        GROUP BY e.course_id, e.section_code
      )
      SELECT
        COALESCE(SUM(attendance_marked_classes), 0) AS updated_attendance,
        COALESCE(SUM(total_classes_held), 0) AS total_classes_held
      FROM scoped_class_rows
    `,
    params
  );
  const row = res.rows[0];
  return {
    updatedAttendance: toInt(row?.updated_attendance),
    totalClassesHeld: toInt(row?.total_classes_held),
  };
}

export async function getOverviewData(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  gpaFilters?: AlertDimensionFilter[],
  attendanceFilters?: AlertDimensionFilter[]
) {
  if (pool) {
    try {
      const dbOverview = await getOverviewDataFromDb(
        user,
        masterFilter,
        gpaFilters,
        attendanceFilters
      );
      if (dbOverview) return dbOverview;
    } catch {
      // Fall back to file-based calculation when DB aggregate table is unavailable.
    }
  }
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

/** Unique student SAP IDs with the given GPA alert level after the same filters as `getOverviewData`. */
export async function getSapIdsForGpaAlertSegment(
  user: AppUser | null,
  masterFilter: MasterFilterParams | undefined,
  gpaFilters: AlertDimensionFilter[] | undefined,
  attendanceFilters: AlertDimensionFilter[] | undefined,
  gpaLevel: "warning" | "critical"
): Promise<string[]> {
  const data = await getDataFromEnrollment();
  const { students: allStudents } = data;
  const hasValidUser =
    user && VALID_ROLES.includes(user.role as (typeof VALID_ROLES)[number]);
  let students = hasValidUser
    ? (getStudentsForRole(user as User, allStudents) as Student[])
    : allStudents;
  students = applyMasterFilter(students, masterFilter, data);
  students = applyGpaAttendanceFilter(students, gpaFilters, attendanceFilters);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of students) {
    if (s.gpa.alert_level !== gpaLevel) continue;
    if (seen.has(s.sap_id)) continue;
    seen.add(s.sap_id);
    out.push(s.sap_id);
  }
  return out;
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
  student.attendance.alert_level = getAttendanceAlertLevel(
    att.attendance_percentage,
    att.class_average_attendance,
    att.total_classes_held
  );
}

/** Screen heading by role: Faculty name (dean) from faculties table, Department name(s) (hod), Instructor name (teacher). */
export function getScreenHeading(
  user: AppUser | null,
  data: { faculties: Faculty[]; departments: Department[] }
): string | null {
  if (!user) return null;
  if (user.role === "dean" && user.faculty_id) {
    const mappedFacultyId =
      FACULTY_ID_TO_ENROLLMENT_FAC_ID[user.faculty_id] ?? user.faculty_id;
    return (
      data.faculties.find((f) => f.id === user.faculty_id)?.name ??
      data.faculties.find((f) => f.id === mappedFacultyId)?.name ??
      user.faculty_id
    );
  }
  if (user.role === "hod" && user.department_ids?.length) {
    const names = data.departments
      .filter((d) => user.department_ids!.includes(d.id))
      .map((d) => d.name);
    return names.length ? names.join(", ") : null;
  }
  if (user.role === "instructor") return user.name;
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
        (u) => u.id === uid && u.role === "instructor" && u.course_ids?.length
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
  if (pool) {
    try {
      const dims = await pool.query<{
        dimension_type: "department" | "program" | "course" | "instructor";
        dimension_id: string;
        dimension_name: string;
        total_students: number | string | null;
      }>(
        `SELECT dimension_type, dimension_id, dimension_name, total_students
         FROM alert_counts_by_dimension
         WHERE snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL})
           AND dimension_type = ANY($1::varchar[])`,
        [["department", "program", "course", "instructor"]]
      );
      const byType = new Map<string, { value: string; label: string }[]>();
      for (const row of dims.rows) {
        const list = byType.get(row.dimension_type) ?? [];
        const count = toInt(row.total_students);
        list.push({
          value: row.dimension_id,
          label:
            count > 0
              ? `${row.dimension_name} (${count.toLocaleString()})`
              : row.dimension_name,
        });
        byType.set(row.dimension_type, list);
      }
      const departments = (byType.get("department") ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      const programs = (byType.get("program") ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      const courses = (byType.get("course") ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      const instructors = (byType.get("instructor") ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );

      if (user?.role === "dean" && user.faculty_id) {
        const enrollmentFacultyId =
          FACULTY_ID_TO_ENROLLMENT_FAC_ID[user.faculty_id] ?? user.faculty_id;
        const scopedRowsRes = await pool.query<{
          department_id: string | null;
          course_id: string;
          program_id: string | null;
          instructor_pernr: string | null;
        }>(
          `SELECT DISTINCT department_id, course_id, program_id, instructor_pernr
           FROM student_enrollment_current
           WHERE is_active = TRUE
             AND faculty_id = $1`,
          [enrollmentFacultyId]
        );

        const scopedCourseIds = new Set(
          scopedRowsRes.rows.map((r) => r.course_id).filter(Boolean)
        );
        const scopedDepartmentIds = new Set(
          scopedRowsRes.rows.map((r) => r.department_id).filter(Boolean) as string[]
        );
        const scopedProgramIds = new Set(
          scopedRowsRes.rows
            .map((r) =>
              r.program_id && r.program_id.trim()
                ? r.program_id
                : getProgramFromCourse(r.course_id)
            )
            .filter(Boolean) as string[]
        );

        const selectedPrograms = current?.programs?.length
          ? new Set(current.programs)
          : null;
        const selectedCourses = current?.course_ids?.length
          ? new Set(current.course_ids)
          : null;
        const courseToProgramId = new Map<string, string>();
        for (const row of scopedRowsRes.rows) {
          const programId =
            row.program_id && row.program_id.trim()
              ? row.program_id
              : getProgramFromCourse(row.course_id);
          if (!courseToProgramId.has(row.course_id)) {
            courseToProgramId.set(row.course_id, programId);
          }
        }

        const departmentsScoped = departments.filter((d) =>
          scopedDepartmentIds.has(d.value)
        );
        const programsScoped = programs.filter((p) =>
          scopedProgramIds.has(p.value)
        );
        const coursesScoped = courses.filter((c) => {
          if (!scopedCourseIds.has(c.value)) return false;
          const programIdForCourse =
            courseToProgramId.get(c.value) ?? getProgramFromCourse(c.value);
          if (selectedPrograms && !selectedPrograms.has(programIdForCourse)) {
            return false;
          }
          return true;
        });

        const courseIdsForInstructorFilter = selectedCourses
          ? selectedCourses
          : new Set(coursesScoped.map((c) => c.value));
        const instructorIdsInScope = new Set(
          scopedRowsRes.rows
            .filter(
              (r) => r.instructor_pernr && courseIdsForInstructorFilter.has(r.course_id)
            )
            .map((r) => String(r.instructor_pernr))
        );
        const instructorsScoped = instructors.filter((i) =>
          instructorIdsInScope.has(i.value)
        );

        return {
          departments: departmentsScoped,
          programs: programsScoped,
          courses: coursesScoped,
          instructors: instructorsScoped,
        };
      }

      if (user?.role === "hod" && user.department_ids?.length) {
        const deptSet = new Set(user.department_ids);
        const scopedCoursesRes = await pool.query<{
          course_id: string;
          program_id: string | null;
          instructor_pernr: string | null;
        }>(
          `SELECT DISTINCT course_id, program_id, instructor_pernr
           FROM student_enrollment_current
           WHERE is_active = TRUE
             AND department_id = ANY($1::text[])`,
          [user.department_ids]
        );
        const scopedCourseIds = new Set(
          scopedCoursesRes.rows.map((r) => r.course_id).filter(Boolean)
        );
        const scopedProgramIds = new Set(
          Array.from(scopedCourseIds).map((courseId) => getProgramFromCourse(courseId))
        );

        const departmentsScoped = departments.filter((d) =>
          deptSet.has(d.value)
        );

        const selectedPrograms = current?.programs?.length
          ? new Set(current.programs)
          : null;
        const selectedCourses = current?.course_ids?.length
          ? new Set(current.course_ids)
          : null;
        const courseToProgramId = new Map<string, string>();
        for (const row of scopedCoursesRes.rows) {
          const programId =
            row.program_id && row.program_id.trim()
              ? row.program_id
              : getProgramFromCourse(row.course_id);
          if (!courseToProgramId.has(row.course_id)) {
            courseToProgramId.set(row.course_id, programId);
          }
        }

        const programsScoped = programs.filter((p) =>
          scopedProgramIds.has(p.value)
        );
        const coursesScoped = courses.filter((c) => {
          if (!scopedCourseIds.has(c.value)) return false;
          const programIdForCourse =
            courseToProgramId.get(c.value) ?? getProgramFromCourse(c.value);
          if (selectedPrograms && !selectedPrograms.has(programIdForCourse)) {
            return false;
          }
          return true;
        });

        const courseIdsForInstructorFilter = selectedCourses
          ? selectedCourses
          : new Set(coursesScoped.map((c) => c.value));
        const instructorIdsInScope = new Set(
          scopedCoursesRes.rows
            .filter((r) => r.instructor_pernr && courseIdsForInstructorFilter.has(r.course_id))
            .map((r) => String(r.instructor_pernr))
        );
        const instructorsScoped = instructors.filter((i) =>
          instructorIdsInScope.has(i.value)
        );

        return {
          departments: departmentsScoped,
          programs: programsScoped,
          courses: coursesScoped,
          instructors: instructorsScoped,
        };
      }

      if (user?.role === "instructor") {
        const instructorPernr = String(user.sap_id ?? "").trim();
        if (!instructorPernr) {
          return { departments: [], programs: [], courses: [], instructors: [] };
        }
        const scopedRows = await pool.query<{
          department_id: string | null;
          course_id: string;
          program_id: string | null;
          instructor_pernr: string | null;
        }>(
          `SELECT DISTINCT department_id, course_id, program_id, instructor_pernr
           FROM student_enrollment_current
           WHERE is_active = TRUE
             AND instructor_pernr = $1`,
          [instructorPernr]
        );
        const courseIds = new Set(
          scopedRows.rows.map((r) => r.course_id).filter(Boolean)
        );
        const departmentIds = new Set(
          scopedRows.rows.map((r) => r.department_id).filter(Boolean) as string[]
        );
        const programIds = new Set(
          scopedRows.rows
            .map((r) => (r.program_id && r.program_id.trim() ? r.program_id : getProgramFromCourse(r.course_id)))
            .filter(Boolean) as string[]
        );
        const departmentsScoped = departments.filter((d) => departmentIds.has(d.value));
        const programsScoped = programs.filter((p) => programIds.has(p.value));
        const coursesScoped = courses.filter((c) => courseIds.has(c.value));
        const instructorsScoped = instructors.filter((i) => i.value === instructorPernr);
        return {
          departments: departmentsScoped,
          programs: programsScoped,
          courses: coursesScoped,
          instructors: instructorsScoped,
        };
      }

      if (
        departments.length ||
        programs.length ||
        courses.length ||
        instructors.length
      ) {
        return { departments, programs, instructors, courses };
      }
    } catch {
      // Fall back to enrollment-derived options.
    }
  }
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

  const teachers = data.users.filter((u) => u.role === "instructor" && u.department_id);
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
  } else if (user?.role === "instructor") {
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
  attendanceMissing?: number;
  attendanceClassesHeld?: number;
};

/** Returns department stats from enrollment tables. */
export async function getDepartmentStatsFromEnrollment(
  facultyId?: string | null
): Promise<DepartmentStats[]> {
  try {
    const records = await readEnrollmentFile();
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
  if (pool) {
    try {
      const facultyScopeIds = buildFacultyScopeIds(facultyId);
      const rows = await getScopedDimensionCountsFromLive("department", {
        facultyIds: facultyScopeIds,
        departmentIds: options?.departmentIds,
      });
      const missingByDepartment = await getAttendanceMissingByDimension(
        "department",
        rows.map((row) => row.dimension_id),
        {
          facultyIds: facultyScopeIds,
          departmentIds: options?.departmentIds,
        }
      );
      return rows.map((row) => ({
        departmentId: row.dimension_id,
        departmentName: row.dimension_name,
        total: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
        attendanceMissing: missingByDepartment.get(row.dimension_id)?.missing ?? 0,
        attendanceClassesHeld: missingByDepartment.get(row.dimension_id)?.held ?? 0,
      }));
    } catch {
      // Fall back to existing file/SAP paths below.
    }
  }
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
  attendanceMissing?: number;
  attendanceClassesHeld?: number;
};

/** Returns instructor stats from enrollment tables. */
export async function getInstructorStatsFromEnrollment(
  facultyId?: string | null,
  options?: { departmentIds?: string[]; instructorIds?: string[] }
): Promise<InstructorStats[]> {
  try {
    const records = await readEnrollmentFile();
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
  if (pool) {
    try {
      if (!facultyId) return [];
      const facultyScopeIds = buildFacultyScopeIds(facultyId);
      const rows = await getScopedDimensionCountsFromLive("instructor", {
        facultyIds: facultyScopeIds,
        departmentIds: options?.departmentIds,
        instructorIds: options?.instructorIds,
      });
      const missingByInstructor = await getAttendanceMissingByDimension(
        "instructor",
        rows.map((row) => row.dimension_id),
        {
          facultyIds: facultyScopeIds,
          departmentIds: options?.departmentIds,
          instructorIds: options?.instructorIds,
        }
      );
      return rows.map((row) => ({
        instructorId: row.dimension_id,
        instructorName: row.dimension_name,
        total: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
        attendanceMissing: missingByInstructor.get(row.dimension_id)?.missing ?? 0,
        attendanceClassesHeld: missingByInstructor.get(row.dimension_id)?.held ?? 0,
      }));
    } catch {
      // Fall back to file-derived aggregation below.
    }
  }
  const data = await getDataFromEnrollment();
  const deptIdsInFaculty =
    facultyId != null
      ? data.departments.filter((d) => d.faculty_id === facultyId).map((d) => d.id)
      : data.departments.map((d) => d.id);

  let teachers = data.users.filter(
    (u) =>
      u.role === "instructor" &&
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

/** Returns program stats from enrollment tables. */
export async function getProgramStatsFromEnrollment(
  facultyId?: string | null,
  options?: { departmentIds?: string[] }
): Promise<ProgramStats[]> {
  try {
    const records = await readEnrollmentFile();
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
  if (pool) {
    try {
      if (!facultyId) return [];
      const facultyScopeIds = buildFacultyScopeIds(facultyId);
      const rows = await getScopedDimensionCountsFromLive("program", {
        facultyIds: facultyScopeIds,
        departmentIds: options?.departmentIds,
      });
      const missingByProgram = await getAttendanceMissingByDimension(
        "program",
        rows.map((row) => row.dimension_id),
        {
          facultyIds: facultyScopeIds,
          departmentIds: options?.departmentIds,
        }
      );
      return rows.map((row) => ({
        programId: row.dimension_id,
        programTitle: row.dimension_name,
        total: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
        attendanceMissing: missingByProgram.get(row.dimension_id)?.missing ?? 0,
        attendanceClassesHeld: missingByProgram.get(row.dimension_id)?.held ?? 0,
      }));
    } catch {
      // Fall back to file-derived aggregation below.
    }
  }
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
  attendanceMissing?: number;
  attendanceClassesHeld?: number;
};

export type FacultyStats = {
  facultyId: string;
  facultyName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

export type AlertSnapshotTrendPoint = {
  snapshotDate: string;
  totalStudents: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

/** Stats per faculty for Superadmin view. */
export async function getSuperadminFacultyStats(): Promise<FacultyStats[]> {
  if (pool) {
    try {
      const res = await pool.query<{
        dimension_id: string;
        dimension_name: string;
        total_students: number | string | null;
        yellow_gpa: number | string | null;
        red_gpa: number | string | null;
        yellow_attendance: number | string | null;
        red_attendance: number | string | null;
      }>(
        `SELECT
           dimension_id,
           dimension_name,
           total_students,
           yellow_gpa,
           red_gpa,
           yellow_attendance,
           red_attendance
         FROM alert_counts_by_dimension
         WHERE snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL})
           AND dimension_type = 'faculty'
         ORDER BY dimension_name ASC`
      );
      return res.rows.map((row) => ({
        facultyId: row.dimension_id,
        facultyName: row.dimension_name || row.dimension_id,
        total: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
      }));
    } catch {
      // Fall back to file-derived aggregation if DB aggregate read fails.
    }
  }

  const data = await getDataFromEnrollment();
  const byFaculty = new Map<string, Student[]>();
  for (const s of data.students) {
    const facultyId = (s.faculty_id ?? "").trim();
    if (!facultyId) continue;
    if (!byFaculty.has(facultyId)) byFaculty.set(facultyId, []);
    byFaculty.get(facultyId)!.push(s);
  }

  const facultyNameById = new Map(data.faculties.map((f) => [f.id, f.name]));
  return Array.from(byFaculty.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([facultyId, students]) => {
      let yellowGpa = 0;
      let redGpa = 0;
      let yellowAttendance = 0;
      let redAttendance = 0;
      for (const s of students) {
        if (s.gpa.alert_level === "warning") yellowGpa += 1;
        if (s.gpa.alert_level === "critical") redGpa += 1;
        if (s.attendance.alert_level === "warning") yellowAttendance += 1;
        if (s.attendance.alert_level === "critical") redAttendance += 1;
      }
      return {
        facultyId,
        facultyName: facultyNameById.get(facultyId) ?? facultyId,
        total: students.length,
        yellowGpa,
        redGpa,
        yellowAttendance,
        redAttendance,
      };
    });
}

/** Daily alert snapshot trend for Superadmin charts. */
export async function getSuperadminAlertSnapshotTrend(
  limit = 30,
  facultyId?: string | null
): Promise<AlertSnapshotTrendPoint[]> {
  if (!pool) return [];
  try {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(365, limit)) : 30;
    const params: unknown[] = [];
    let whereSql = "WHERE dimension_type = 'faculty'";
    if (facultyId) {
      params.push(facultyId);
      whereSql += ` AND dimension_id = $${params.length}`;
    }
    params.push(safeLimit);
    const res = await pool.query<{
      snapshot_date: string;
      total_students: number | string | null;
      yellow_gpa: number | string | null;
      red_gpa: number | string | null;
      yellow_attendance: number | string | null;
      red_attendance: number | string | null;
    }>(
      `SELECT
         snapshot_date::text AS snapshot_date,
         COALESCE(SUM(total_students), 0) AS total_students,
         COALESCE(SUM(yellow_gpa), 0) AS yellow_gpa,
         COALESCE(SUM(red_gpa), 0) AS red_gpa,
         COALESCE(SUM(yellow_attendance), 0) AS yellow_attendance,
         COALESCE(SUM(red_attendance), 0) AS red_attendance
       FROM alert_counts_by_dimension
       ${whereSql}
       GROUP BY snapshot_date
       ORDER BY snapshot_date DESC
       LIMIT $${params.length}`,
      params
    );

    return res.rows
      .map((row) => ({
        snapshotDate: row.snapshot_date,
        totalStudents: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
      }))
      .reverse();
  } catch {
    return [];
  }
}

/** Daily alert snapshot trend scoped to the current user's access/filter scope. */
export async function getAlertSnapshotTrend(
  user?: AppUser | null,
  masterFilter?: MasterFilterParams,
  limit = 30
): Promise<AlertSnapshotTrendPoint[]> {
  if (!pool) return [];
  try {
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(365, limit))
      : 30;
    const scope = getDbScope(user, masterFilter);
    const params: unknown[] = [scope.dimensionType];
    let where = "dimension_type = $1";

    if (scope.ids?.length) {
      params.push(scope.ids);
      where += ` AND dimension_id = ANY($2)`;
    }

    params.push(safeLimit);
    const limitParamIndex = params.length;

    const res = await pool.query<{
      snapshot_date: string;
      total_students: number | string | null;
      yellow_gpa: number | string | null;
      red_gpa: number | string | null;
      yellow_attendance: number | string | null;
      red_attendance: number | string | null;
    }>(
      `SELECT
         snapshot_date::text AS snapshot_date,
         COALESCE(SUM(total_students), 0) AS total_students,
         COALESCE(SUM(yellow_gpa), 0) AS yellow_gpa,
         COALESCE(SUM(red_gpa), 0) AS red_gpa,
         COALESCE(SUM(yellow_attendance), 0) AS yellow_attendance,
         COALESCE(SUM(red_attendance), 0) AS red_attendance
       FROM alert_counts_by_dimension
       WHERE ${where}
       GROUP BY snapshot_date
       ORDER BY snapshot_date DESC
       LIMIT $${limitParamIndex}`,
      params
    );

    return res.rows
      .map((row) => ({
        snapshotDate: row.snapshot_date,
        totalStudents: toInt(row.total_students),
        yellowGpa: toInt(row.yellow_gpa),
        redGpa: toInt(row.red_gpa),
        yellowAttendance: toInt(row.yellow_attendance),
        redAttendance: toInt(row.red_attendance),
      }))
      .reverse();
  } catch {
    return [];
  }
}

export type CourseStats = {
  courseId: string;
  courseName: string;
  total: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
  attendanceMissing?: number;
  attendanceClassesHeld?: number;
  lastAttendancePostedAt?: string | null;
};

async function getLastAttendancePostedByCourse(
  courseIds: string[],
  scope?: {
    facultyIds?: string[];
    departmentIds?: string[];
    programIds?: string[];
    instructorIds?: string[];
    courseIds?: string[];
  }
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ids = Array.from(new Set(courseIds.map((v) => String(v).trim()).filter(Boolean)));
  if (!pool || !ids.length) return map;
  const params: unknown[] = [ids];
  const where: string[] = ["e.is_active = TRUE", "e.course_id = ANY($1::text[])"];
  if (scope?.facultyIds?.length) {
    params.push(scope.facultyIds);
    where.push(`e.faculty_id = ANY($${params.length}::text[])`);
  }
  if (scope?.departmentIds?.length) {
    params.push(scope.departmentIds);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  }
  if (scope?.programIds?.length) {
    params.push(scope.programIds);
    where.push(`e.program_id = ANY($${params.length}::text[])`);
  }
  if (scope?.instructorIds?.length) {
    params.push(scope.instructorIds);
    where.push(`e.instructor_pernr = ANY($${params.length}::text[])`);
  }
  const res = await pool.query<{
    course_id: string;
    last_attendance_posted_at: string | null;
  }>(
    `SELECT
       e.course_id,
       MAX(a.last_attendance_posted_at)::text AS last_attendance_posted_at
     FROM student_enrollment_current e
     LEFT JOIN student_alert_current a
       ON a.sap_id = e.sap_id
      AND a.course_id = e.course_id
      AND a.section_code = e.section_code
      AND a.event_package_id = e.event_package_id
     WHERE ${where.join(" AND ")}
     GROUP BY e.course_id`,
    params
  );
  for (const row of res.rows) map.set(row.course_id, row.last_attendance_posted_at);
  return map;
}

/** Course stats for Dean scoped to faculty and optional department/program/course filters. */
export async function getDeanCourseStats(
  facultyId: string | null,
  options?: { departmentIds?: string[]; programIds?: string[]; courseIds?: string[] }
): Promise<CourseStats[]> {
  if (!facultyId) return [];
  if (!pool) return [];
  try {
    const facultyScopeIds = buildFacultyScopeIds(facultyId);
    const rows = await getScopedDimensionCountsFromLive("course", {
      facultyIds: facultyScopeIds,
      departmentIds: options?.departmentIds,
      programIds: options?.programIds,
      courseIds: options?.courseIds,
    });
    const missingByCourse = await getAttendanceMissingByDimension(
      "course",
      rows.map((row) => row.dimension_id),
      {
        facultyIds: facultyScopeIds,
        departmentIds: options?.departmentIds,
        programIds: options?.programIds,
        courseIds: options?.courseIds,
      }
    );
    const lastAttendancePostedByCourse = await getLastAttendancePostedByCourse(
      rows.map((row) => row.dimension_id),
      {
        facultyIds: facultyScopeIds,
        departmentIds: options?.departmentIds,
        programIds: options?.programIds,
      }
    );
    return rows.map((row) => ({
      courseId: row.dimension_id,
      courseName: row.dimension_name,
      total: toInt(row.total_students),
      yellowGpa: toInt(row.yellow_gpa),
      redGpa: toInt(row.red_gpa),
      yellowAttendance: toInt(row.yellow_attendance),
      redAttendance: toInt(row.red_attendance),
      attendanceMissing: missingByCourse.get(row.dimension_id)?.missing ?? 0,
      attendanceClassesHeld: missingByCourse.get(row.dimension_id)?.held ?? 0,
      lastAttendancePostedAt:
        lastAttendancePostedByCourse.get(row.dimension_id) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Stats per program for HoD (departments they head). */
export async function getHodProgramStats(
  departmentIds: string[]
): Promise<ProgramStats[]> {
  if (!departmentIds.length) return [];
  if (!pool) return [];
  try {
    const res = await pool.query<{ program_id: string; program_title: string | null }>(
      `SELECT DISTINCT
         e.program_id,
         p.title AS program_title
       FROM student_enrollment_current e
       LEFT JOIN programs p ON p.id = e.program_id
       WHERE e.is_active = TRUE
         AND e.department_id = ANY($1::text[])
         AND e.program_id IS NOT NULL
         AND e.program_id <> ''`,
      [departmentIds]
    );
    const programRows = Array.from(
      new Map(
        res.rows
          .filter((r) => Boolean(r.program_id))
          .map((r) => [r.program_id, r])
      ).values()
    ).sort((a, b) => a.program_id.localeCompare(b.program_id));
    const programIds = programRows.map((r) => r.program_id);
    if (!programIds.length) return [];
    const dbCounts = await getDimensionCountsFromDb("program", programIds);
    const missingByProgram = await getAttendanceMissingByDimension(
      "program",
      programIds,
      { departmentIds }
    );
    const titleByProgramId = new Map(
      programRows.map((r) => [r.program_id, (r.program_title ?? "").trim()])
    );
    return programIds.map((programId) => {
      const row = dbCounts.get(programId);
      return {
        programId,
        programTitle: titleByProgramId.get(programId) || programId,
        total: row ? toInt(row.total_students) : 0,
        yellowGpa: row ? toInt(row.yellow_gpa) : 0,
        redGpa: row ? toInt(row.red_gpa) : 0,
        yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
        redAttendance: row ? toInt(row.red_attendance) : 0,
        attendanceMissing: missingByProgram.get(programId)?.missing ?? 0,
        attendanceClassesHeld: missingByProgram.get(programId)?.held ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/** Instructor stats for HoD: teachers in the given department IDs. */
export async function getHodInstructorStats(
  departmentIds: string[],
  options?: { instructorIds?: string[]; programIds?: string[]; courseIds?: string[] }
): Promise<InstructorStats[]> {
  if (!departmentIds.length) return [];
  if (pool) {
    try {
      const params: unknown[] = [departmentIds];
      const where: string[] = [
        "e.is_active = TRUE",
        "e.department_id = ANY($1::text[])",
        "e.instructor_pernr IS NOT NULL",
        "e.instructor_pernr <> ''",
      ];
      if (options?.instructorIds?.length) {
        params.push(options.instructorIds);
        where.push(`e.instructor_pernr = ANY($${params.length}::text[])`);
      }
      if (options?.programIds?.length) {
        params.push(options.programIds);
        where.push(`e.program_id = ANY($${params.length}::text[])`);
      }
      if (options?.courseIds?.length) {
        params.push(options.courseIds);
        where.push(`e.course_id = ANY($${params.length}::text[])`);
      }
      const res = await pool.query<{ instructor_id: string; instructor_name: string }>(
        `SELECT DISTINCT
           e.instructor_pernr AS instructor_id,
           COALESCE(NULLIF(TRIM(MAX(e.instructor_name)), ''), e.instructor_pernr) AS instructor_name
         FROM student_enrollment_current e
         WHERE ${where.join(" AND ")}
         GROUP BY e.instructor_pernr
         ORDER BY instructor_name ASC`,
        params
      );
      const instructorIds = res.rows.map((r) => r.instructor_id);
      if (!instructorIds.length) return [];
      const dbCounts = await getDimensionCountsFromDb("instructor", instructorIds);
      const missingByInstructor = await getAttendanceMissingByDimension(
        "instructor",
        instructorIds,
        {
          departmentIds,
          programIds: options?.programIds,
          courseIds: options?.courseIds,
          instructorIds: options?.instructorIds,
        }
      );
      return res.rows.map((teacher) => {
        const row = dbCounts.get(teacher.instructor_id);
        return {
          instructorId: teacher.instructor_id,
          instructorName: teacher.instructor_name,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing:
            missingByInstructor.get(teacher.instructor_id)?.missing ?? 0,
          attendanceClassesHeld:
            missingByInstructor.get(teacher.instructor_id)?.held ?? 0,
        };
      });
    } catch {
      // Fall back to file-derived calculations when DB path fails.
    }
  }
  const data = await getDataFromEnrollment();
  const deptSet = new Set(departmentIds);

  let teachers = data.users.filter(
    (u) =>
      u.role === "instructor" &&
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
  if (options?.courseIds?.length) {
    const selectedCourses = new Set(options.courseIds);
    teachers = teachers.filter((t) =>
      (t.course_ids ?? []).some((cid) => selectedCourses.has(cid))
    );
  }

  if (pool) {
    try {
      const instructorIds = teachers.map((t) => t.id);
      const dbCounts = await getDimensionCountsFromDb("instructor", instructorIds);
      const missingByInstructor = await getAttendanceMissingByDimension(
        "instructor",
        instructorIds,
        {
          departmentIds,
          programIds: options?.programIds,
          courseIds: options?.courseIds,
          instructorIds: options?.instructorIds,
        }
      );
      return teachers.map((teacher) => {
        const row = dbCounts.get(teacher.id);
        return {
          instructorId: teacher.id,
          instructorName: teacher.name,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing: missingByInstructor.get(teacher.id)?.missing ?? 0,
          attendanceClassesHeld: missingByInstructor.get(teacher.id)?.held ?? 0,
        };
      });
    } catch {
      // Fall back to file-derived alert calculations if DB aggregate read fails.
    }
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

/** Course stats for HoD scoped to departments and optionally programs/courses. */
export async function getHodCourseStats(
  departmentIds: string[],
  options?: { programIds?: string[]; courseIds?: string[] }
): Promise<CourseStats[]> {
  if (!departmentIds.length) return [];
  if (pool) {
    try {
      const params: unknown[] = [departmentIds];
      const where: string[] = [
        "e.is_active = TRUE",
        "e.department_id = ANY($1::text[])",
      ];
      if (options?.programIds?.length) {
        params.push(options.programIds);
        where.push(`e.program_id = ANY($${params.length}::text[])`);
      }
      if (options?.courseIds?.length) {
        params.push(options.courseIds);
        where.push(`e.course_id = ANY($${params.length}::text[])`);
      }
      const res = await pool.query<{ course_id: string; course_name: string }>(
        `SELECT DISTINCT
           e.course_id,
           COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS course_name
         FROM student_enrollment_current e
         LEFT JOIN courses c ON c.id = e.course_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.course_id ASC`,
        params
      );
      const sortedCourseIds = res.rows.map((r) => r.course_id);
      if (!sortedCourseIds.length) return [];
      const courseNameById = new Map(res.rows.map((r) => [r.course_id, r.course_name]));
      const courseIdBaseByFull = new Map(
        sortedCourseIds.map((id) => [id, id.split("|")[0]?.trim() || id])
      );
      const normalizedCourseIds = Array.from(new Set(Array.from(courseIdBaseByFull.values())));
      const counts = await pool.query<{
        course_id: string;
        course_name: string;
        total_students: number | string | null;
        yellow_gpa: number | string | null;
        red_gpa: number | string | null;
        yellow_attendance: number | string | null;
        red_attendance: number | string | null;
      }>(
        `SELECT
           split_part(dimension_id, '|', 1) AS course_id,
           MAX(dimension_name) AS course_name,
           COALESCE(SUM(total_students), 0) AS total_students,
           COALESCE(SUM(yellow_gpa), 0) AS yellow_gpa,
           COALESCE(SUM(red_gpa), 0) AS red_gpa,
           COALESCE(SUM(yellow_attendance), 0) AS yellow_attendance,
           COALESCE(SUM(red_attendance), 0) AS red_attendance
         FROM alert_counts_by_dimension
         WHERE snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL})
           AND dimension_type = 'course'
           AND split_part(dimension_id, '|', 1) = ANY($1)
         GROUP BY split_part(dimension_id, '|', 1)`,
        [normalizedCourseIds]
      );
      const byCourse = new Map(counts.rows.map((r) => [r.course_id, r]));
      const missingByCourse = await getAttendanceMissingByDimension(
        "course",
        sortedCourseIds,
        {
          departmentIds,
          programIds: options?.programIds,
          courseIds: options?.courseIds,
        }
      );
      const lastAttendancePostedByCourse = await getLastAttendancePostedByCourse(
        sortedCourseIds,
        {
          departmentIds,
          programIds: options?.programIds,
        }
      );
      return sortedCourseIds.map((courseId) => {
        const baseId = courseIdBaseByFull.get(courseId) ?? courseId;
        const row = byCourse.get(baseId);
        return {
          courseId,
          courseName: row?.course_name ?? courseNameById.get(courseId) ?? courseId,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing: missingByCourse.get(courseId)?.missing ?? 0,
          attendanceClassesHeld: missingByCourse.get(courseId)?.held ?? 0,
          lastAttendancePostedAt:
            lastAttendancePostedByCourse.get(courseId) ?? null,
        };
      });
    } catch {
      // Fall back to file-derived calculations when DB path fails.
    }
  }
  const data = await getDataFromEnrollment();
  const deptSet = new Set(departmentIds);

  let courses = data.courses.filter((c) => deptSet.has(c.department_id));
  if (options?.programIds?.length) {
    const programSet = new Set(options.programIds);
    courses = courses.filter((c) => programSet.has(getProgramFromCourse(c.id)));
  }
  if (options?.courseIds?.length) {
    const selectedCourseSet = new Set(options.courseIds);
    courses = courses.filter((c) => selectedCourseSet.has(c.id));
  }
  if (!courses.length) return [];

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
  const sortedCourseIds = Array.from(new Set(courses.map((c) => c.id))).sort((a, b) =>
    a.localeCompare(b)
  );

  if (pool) {
    try {
      const res = await pool.query<{
        course_id: string;
        course_name: string;
        total_students: number | string | null;
        yellow_gpa: number | string | null;
        red_gpa: number | string | null;
        yellow_attendance: number | string | null;
        red_attendance: number | string | null;
      }>(
        `SELECT
           split_part(dimension_id, '|', 1) AS course_id,
           MAX(dimension_name) AS course_name,
           COALESCE(SUM(total_students), 0) AS total_students,
           COALESCE(SUM(yellow_gpa), 0) AS yellow_gpa,
           COALESCE(SUM(red_gpa), 0) AS red_gpa,
           COALESCE(SUM(yellow_attendance), 0) AS yellow_attendance,
           COALESCE(SUM(red_attendance), 0) AS red_attendance
         FROM alert_counts_by_dimension
         WHERE snapshot_date = (${LATEST_ALERT_COUNTS_SNAPSHOT_SQL})
           AND dimension_type = 'course'
           AND split_part(dimension_id, '|', 1) = ANY($1)
         GROUP BY split_part(dimension_id, '|', 1)`,
        [sortedCourseIds]
      );

      const byCourse = new Map(res.rows.map((r) => [r.course_id, r]));
      const missingByCourse = await getAttendanceMissingByDimension(
        "course",
        sortedCourseIds,
        {
          departmentIds,
          programIds: options?.programIds,
          courseIds: options?.courseIds,
        }
      );
      const lastAttendancePostedByCourse = await getLastAttendancePostedByCourse(
        sortedCourseIds,
        {
          departmentIds,
          programIds: options?.programIds,
          courseIds: options?.courseIds,
        }
      );
      return sortedCourseIds.map((courseId) => {
        const row = byCourse.get(courseId);
        return {
          courseId,
          courseName: row?.course_name ?? courseNameById.get(courseId) ?? courseId,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing: missingByCourse.get(courseId)?.missing ?? 0,
          attendanceClassesHeld: missingByCourse.get(courseId)?.held ?? 0,
          lastAttendancePostedAt:
            lastAttendancePostedByCourse.get(courseId) ?? null,
        };
      });
    } catch {
      // Fall back to file-derived alert calculations if DB aggregate read fails.
    }
  }

  const courseSet = new Set(sortedCourseIds);
  const students = data.students.filter((s) => courseSet.has(s.course_id));
  const byCourseStudents = new Map<string, Student[]>();
  for (const s of students) {
    if (!byCourseStudents.has(s.course_id)) byCourseStudents.set(s.course_id, []);
    byCourseStudents.get(s.course_id)!.push(s);
  }

  return sortedCourseIds.map((courseId) => {
    const courseStudents = byCourseStudents.get(courseId) ?? [];
    let yellowGpa = 0;
    let redGpa = 0;
    let yellowAttendance = 0;
    let redAttendance = 0;
    for (const s of courseStudents) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      courseId,
      courseName: courseNameById.get(courseId) ?? courseId,
      total: courseStudents.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

/** Course stats for Instructor: scoped to courses assigned to the logged-in teacher. */
export async function getInstructorCourseStats(
  user: AppUser | null,
  options?: { courseIds?: string[] }
): Promise<CourseStats[]> {
  if (!user || user.role !== "instructor") return [];
  if (pool) {
    try {
      const pernr = String(user.sap_id ?? "").trim();
      if (!pernr) return [];
      const params: unknown[] = [pernr];
      const where: string[] = [
        "e.is_active = TRUE",
        "e.instructor_pernr = $1",
      ];
      if (options?.courseIds?.length) {
        params.push(options.courseIds);
        where.push(`e.course_id = ANY($${params.length}::text[])`);
      }
      const res = await pool.query<{ course_id: string; course_name: string }>(
        `SELECT DISTINCT
           e.course_id,
           COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS course_name
         FROM student_enrollment_current e
         LEFT JOIN courses c ON c.id = e.course_id
         WHERE ${where.join(" AND ")}
         ORDER BY e.course_id ASC`,
        params
      );
      const courseIds = res.rows.map((r) => r.course_id);
      if (!courseIds.length) return [];
      const courseNameById = new Map(res.rows.map((r) => [r.course_id, r.course_name]));
      const counts = await pool.query<{
        course_id: string;
        course_name: string;
        total_students: number | string | null;
        yellow_gpa: number | string | null;
        red_gpa: number | string | null;
        yellow_attendance: number | string | null;
        red_attendance: number | string | null;
      }>(
        `WITH scoped AS (
           SELECT
             e.course_id,
             COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS course_name,
             e.sap_id,
             MAX(CASE WHEN a.gpa_alert_level = 'warning' THEN 1 ELSE 0 END) AS gpa_warning,
             MAX(CASE WHEN a.gpa_alert_level = 'critical' THEN 1 ELSE 0 END) AS gpa_critical,
             MAX(CASE WHEN a.attendance_alert_level = 'warning' THEN 1 ELSE 0 END) AS attendance_warning,
             MAX(CASE WHEN a.attendance_alert_level = 'critical' THEN 1 ELSE 0 END) AS attendance_critical
           FROM student_enrollment_current e
           LEFT JOIN courses c ON c.id = e.course_id
           LEFT JOIN student_alert_current a
             ON a.sap_id = e.sap_id
            AND a.course_id = e.course_id
            AND a.section_code = e.section_code
            AND a.event_package_id = e.event_package_id
           WHERE e.is_active = TRUE
             AND e.instructor_pernr = $1
             AND e.course_id = ANY($2::text[])
           GROUP BY e.course_id, COALESCE(NULLIF(TRIM(c.title), ''), e.course_id), e.sap_id
         )
         SELECT
           course_id,
           MAX(course_name) AS course_name,
           COUNT(*)::int AS total_students,
           COALESCE(SUM(gpa_warning), 0)::int AS yellow_gpa,
           COALESCE(SUM(gpa_critical), 0)::int AS red_gpa,
           COALESCE(SUM(attendance_warning), 0)::int AS yellow_attendance,
           COALESCE(SUM(attendance_critical), 0)::int AS red_attendance
         FROM scoped
         GROUP BY course_id`,
        [pernr, courseIds]
      );
      const byCourse = new Map(counts.rows.map((r) => [r.course_id, r]));
      const missingByCourse = await getAttendanceMissingByDimension(
        "course",
        courseIds,
        { instructorIds: [pernr], courseIds: options?.courseIds }
      );
      const lastAttendancePostedByCourse = await getLastAttendancePostedByCourse(
        courseIds,
        { instructorIds: [pernr] }
      );
      return courseIds.map((courseId) => {
        const row = byCourse.get(courseId);
        return {
          courseId,
          courseName: row?.course_name ?? courseNameById.get(courseId) ?? courseId,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing: missingByCourse.get(courseId)?.missing ?? 0,
          attendanceClassesHeld: missingByCourse.get(courseId)?.held ?? 0,
          lastAttendancePostedAt:
            lastAttendancePostedByCourse.get(courseId) ?? null,
        };
      });
    } catch {
      // Fall back to file-derived calculations when DB path fails.
    }
  }
  const data = await getDataFromEnrollment();

  const teacher =
    data.users.find((u) => u.role === "instructor" && u.id === user.id) ??
    data.users.find((u) => u.role === "instructor" && u.sap_id === user.sap_id);
  if (!teacher?.course_ids?.length) return [];

  let courseIds = Array.from(new Set(teacher.course_ids)).sort((a, b) =>
    a.localeCompare(b)
  );
  if (options?.courseIds?.length) {
    const selected = new Set(options.courseIds);
    courseIds = courseIds.filter((id) => selected.has(id));
  }
  if (!courseIds.length) return [];

  const courseNameById = new Map(
    data.courses
      .filter((c) => courseIds.includes(c.id))
      .map((c) => [c.id, c.name])
  );

  if (pool) {
    try {
      const pernr = String(user.sap_id ?? "").trim();
      if (!pernr) return [];
      const res = await pool.query<{
        course_id: string;
        course_name: string;
        total_students: number | string | null;
        yellow_gpa: number | string | null;
        red_gpa: number | string | null;
        yellow_attendance: number | string | null;
        red_attendance: number | string | null;
      }>(
        `WITH scoped AS (
           SELECT
             e.course_id,
             COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS course_name,
             e.sap_id,
             MAX(CASE WHEN a.gpa_alert_level = 'warning' THEN 1 ELSE 0 END) AS gpa_warning,
             MAX(CASE WHEN a.gpa_alert_level = 'critical' THEN 1 ELSE 0 END) AS gpa_critical,
             MAX(CASE WHEN a.attendance_alert_level = 'warning' THEN 1 ELSE 0 END) AS attendance_warning,
             MAX(CASE WHEN a.attendance_alert_level = 'critical' THEN 1 ELSE 0 END) AS attendance_critical
           FROM student_enrollment_current e
           LEFT JOIN courses c ON c.id = e.course_id
           LEFT JOIN student_alert_current a
             ON a.sap_id = e.sap_id
            AND a.course_id = e.course_id
            AND a.section_code = e.section_code
            AND a.event_package_id = e.event_package_id
           WHERE e.is_active = TRUE
             AND e.instructor_pernr = $1
             AND e.course_id = ANY($2::text[])
           GROUP BY e.course_id, COALESCE(NULLIF(TRIM(c.title), ''), e.course_id), e.sap_id
         )
         SELECT
           course_id,
           MAX(course_name) AS course_name,
           COUNT(*)::int AS total_students,
           COALESCE(SUM(gpa_warning), 0)::int AS yellow_gpa,
           COALESCE(SUM(gpa_critical), 0)::int AS red_gpa,
           COALESCE(SUM(attendance_warning), 0)::int AS yellow_attendance,
           COALESCE(SUM(attendance_critical), 0)::int AS red_attendance
         FROM scoped
         GROUP BY course_id`,
        [pernr, courseIds]
      );

      const byCourse = new Map(res.rows.map((r) => [r.course_id, r]));
      const missingByCourse = await getAttendanceMissingByDimension(
        "course",
        courseIds,
        { instructorIds: [pernr], courseIds }
      );
      const lastAttendancePostedByCourse = await getLastAttendancePostedByCourse(
        courseIds,
        { instructorIds: [pernr] }
      );
      return courseIds.map((courseId) => {
        const row = byCourse.get(courseId);
        return {
          courseId,
          courseName: row?.course_name ?? courseNameById.get(courseId) ?? courseId,
          total: row ? toInt(row.total_students) : 0,
          yellowGpa: row ? toInt(row.yellow_gpa) : 0,
          redGpa: row ? toInt(row.red_gpa) : 0,
          yellowAttendance: row ? toInt(row.yellow_attendance) : 0,
          redAttendance: row ? toInt(row.red_attendance) : 0,
          attendanceMissing: missingByCourse.get(courseId)?.missing ?? 0,
          attendanceClassesHeld: missingByCourse.get(courseId)?.held ?? 0,
          lastAttendancePostedAt:
            lastAttendancePostedByCourse.get(courseId) ?? null,
        };
      });
    } catch {
      // Fall back to file-derived alert calculations if DB aggregate read fails.
    }
  }

  const courseSet = new Set(courseIds);
  const students = data.students.filter((s) => courseSet.has(s.course_id));
  const byCourseStudents = new Map<string, Student[]>();
  for (const s of students) {
    if (!byCourseStudents.has(s.course_id)) byCourseStudents.set(s.course_id, []);
    byCourseStudents.get(s.course_id)!.push(s);
  }

  return courseIds.map((courseId) => {
    const courseStudents = byCourseStudents.get(courseId) ?? [];
    let yellowGpa = 0;
    let redGpa = 0;
    let yellowAttendance = 0;
    let redAttendance = 0;
    for (const s of courseStudents) {
      if (s.gpa.alert_level === "critical") redGpa += 1;
      if (s.gpa.alert_level === "warning") yellowGpa += 1;
      if (s.attendance.alert_level === "critical") redAttendance += 1;
      if (s.attendance.alert_level === "warning") yellowAttendance += 1;
    }
    return {
      courseId,
      courseName: courseNameById.get(courseId) ?? courseId,
      total: courseStudents.length,
      yellowGpa,
      redGpa,
      yellowAttendance,
      redAttendance,
    };
  });
}

/** Map NextAuth session user (DB staff) to AppUser. Role "instructor" → "teacher". */
export function mapSessionToAppUser(session: {
  user: {
    id: string;
    pernr: string;
    name: string;
    email: string;
    role:
      | "superadmin"
      | "dean"
      | "hod"
      | "instructor"
      | "wellbeing"
      | "wellbeing-head"
      | "wellbeing-counseller";
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
    role: u.role === "instructor" ? "instructor" : u.role,
    faculty_id: u.faculty_id,
    department_id: u.department_ids?.[0] ?? null,
    department_ids: u.department_ids?.length ? u.department_ids : null,
    course_ids: null,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return mapSessionToAppUser(session);
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
  let noActionRequired = 0;

  if (pool) {
    const whereParts: string[] = [];
    const params: any[] = [];

    if (user?.role === "dean" && user.faculty_id) {
      whereParts.push("faculty_id = $1");
      params.push(user.faculty_id);
    } else if (user?.role === "hod" && user.department_ids?.length) {
      whereParts.push("department_id = ANY($1)");
      params.push(user.department_ids);
    } else if (user?.role === "instructor") {
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
      else if (status === "no-action-required") noActionRequired += 1;
      else {
        // Unknown status: treat as initiated bucket by default.
        initiated += 1;
      }
    }

    // 3) Not Started = Total Alerts (yellow+red) − total interventions count
    const totalInterventionStudents =
      initiated + inProgress + referred + resolved + noActionRequired;
    notStarted = Math.max(
      0,
      totalAlertStudents - totalInterventionStudents,
    );
  } else {
    notStarted = totalAlertStudents;
  }

  const statusColors: Record<string, string> = {
    "Not Started": "#DE2649",
    "No Action Required": "#64748B",
    Initiated: "#B5B126",
    "In-Progress": "#DBBE0F",
    Referred: "#9C5A99",
    Resolved: "#477061",
  };

  const data: InterventionChartDataPoint[] = [
    { x: "Not Started", y: notStarted },
    { x: "No Action Required", y: noActionRequired },
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
  const role =
    user?.role === "teacher"
      ? "instructor"
      : user?.role === "instructor" ||
          user?.role === "dean" ||
          user?.role === "hod" ||
          user?.role === "wellbeing" ||
          user?.role === "wellbeing-head" ||
          user?.role === "wellbeing-counseller" ||
          user?.role === "superadmin"
        ? user.role
        : "superadmin";
  const scope: ListingSessionScope = {
    role,
    staff_id: user?.id ?? null,
    faculty_id: user?.faculty_id ?? null,
    department_ids: user?.department_ids ?? null,
    pernr: user?.sap_id?.trim() || null,
  };
  const sapIds = await getDistinctSapIdsForScope(scope, {
    department_ids: masterFilter?.department_ids,
    programs: masterFilter?.programs,
    instructor_ids: masterFilter?.instructor_ids,
    course_ids: masterFilter?.course_ids,
    gpaFilters,
    attendanceFilters,
  });
  return getWellbeingChartDataForStudents(sapIds);
}

/** Same stacked chart using `wellbeing_cases` for students on the wellbeing dashboard (listing scope). */
export async function getWellbeingChartDataForWellbeingRole(
  user: AppUser
): Promise<StatusStackedChartData> {
  const scope: ListingSessionScope = {
    role:
      user.role === "wellbeing-counseller"
        ? "wellbeing-counseller"
        : user.role === "wellbeing-head"
          ? "wellbeing-head"
          : "wellbeing",
    staff_id: user.id,
    faculty_id: user.faculty_id,
    department_ids: user.department_ids,
    pernr: user.sap_id?.trim() || null,
  };
  const sapIds = await getDistinctSapIdsForScope(scope, {});
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
