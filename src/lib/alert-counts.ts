import {
  getFullData,
  getProgramFromCourse,
} from "@/app/(home)/dashboard/fetch";
import { pool } from "@/lib/db";
import { fetchMonitoringEntries } from "@/lib/sap-monitoring";
import { readFile } from "fs/promises";
import path from "path";

export type AlertCountsRow = {
  snapshot_date: string;
  dimension_type: "faculty" | "department" | "program" | "course" | "instructor";
  dimension_id: string;
  dimension_name: string;
  total_students: number;
  yellow_gpa: number;
  red_gpa: number;
  yellow_attendance: number;
  red_attendance: number;
};

type Level = "critical" | "warning" | null;

function toSeverity(level: Level): 0 | 1 | 2 {
  if (level === "critical") return 2;
  if (level === "warning") return 1;
  return 0;
}

type StudentAlertState = { gpa: 0 | 1 | 2; attendance: 0 | 1 | 2 };
type DimensionBucket = {
  dimension_name: string;
  by_student: Map<string, StudentAlertState>;
};

function ensureBucket(
  map: Map<string, DimensionBucket>,
  id: string,
  name: string
): DimensionBucket {
  let bucket = map.get(id);
  if (!bucket) {
    bucket = { dimension_name: name, by_student: new Map() };
    map.set(id, bucket);
  }
  return bucket;
}

function updateBucket(
  bucket: DimensionBucket,
  sapId: string,
  gpaLevel: Level,
  attendanceLevel: Level
): void {
  if (!sapId) return;
  const current = bucket.by_student.get(sapId) ?? { gpa: 0, attendance: 0 };
  current.gpa = Math.max(current.gpa, toSeverity(gpaLevel)) as 0 | 1 | 2;
  current.attendance = Math.max(
    current.attendance,
    toSeverity(attendanceLevel)
  ) as 0 | 1 | 2;
  bucket.by_student.set(sapId, current);
}

function seedBucketStudents(bucket: DimensionBucket, sapIds: Set<string>): void {
  for (const sapId of sapIds) {
    bucket.by_student.set(sapId, { gpa: 0, attendance: 0 });
  }
}

function updateBucketIfEnrolled(
  bucket: DimensionBucket,
  sapId: string,
  gpaLevel: Level,
  attendanceLevel: Level
): void {
  if (!bucket.by_student.has(sapId)) return;
  updateBucket(bucket, sapId, gpaLevel, attendanceLevel);
}

function normalizeCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return String(asNumber);
  return trimmed;
}

function normalizeCourseCode(raw: string): string {
  const [code] = raw.split("|");
  return code.trim();
}

function toRows(
  snapshotDate: string,
  dimensionType: AlertCountsRow["dimension_type"],
  map: Map<string, DimensionBucket>
): AlertCountsRow[] {
  const rows: AlertCountsRow[] = [];
  for (const [dimensionId, bucket] of map.entries()) {
    let yellowGpa = 0;
    let redGpa = 0;
    let yellowAttendance = 0;
    let redAttendance = 0;
    for (const state of bucket.by_student.values()) {
      if (state.gpa === 1) yellowGpa += 1;
      if (state.gpa === 2) redGpa += 1;
      if (state.attendance === 1) yellowAttendance += 1;
      if (state.attendance === 2) redAttendance += 1;
    }
    rows.push({
      snapshot_date: snapshotDate,
      dimension_type: dimensionType,
      dimension_id: dimensionId,
      dimension_name: bucket.dimension_name,
      total_students: bucket.by_student.size,
      yellow_gpa: yellowGpa,
      red_gpa: redGpa,
      yellow_attendance: yellowAttendance,
      red_attendance: redAttendance,
    });
  }
  return rows;
}

export async function buildAlertCountRows(snapshotDate?: string): Promise<AlertCountsRow[]> {
  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const data = await getFullData();
  type EnrollmentRow = {
    SapNo?: string;
    Smstatust?: string;
    Smstatus?: string;
    FacId?: string;
    DeptId?: string;
    DeptCode?: string;
    CrCode?: string;
    Section?: string;
    Packnumber?: string;
    CampCode?: string;
    Peryr?: string;
    Perid?: string;
  };
  type AttendanceRow = {
    Sapno?: string;
    CrCode?: string;
    EventPackageId?: string;
    Section?: string;
    AcadYear?: string;
    AcadPerid?: string;
  };
  const enrollmentPath = path.join(process.cwd(), "public", "enrollment_data.json");
  const enrollmentRaw = await readFile(enrollmentPath, "utf-8");
  const enrollmentRows = JSON.parse(enrollmentRaw) as EnrollmentRow[];
  const attendancePath = path.join(process.cwd(), "public", "attendance_data.json");
  const attendanceRaw = await readFile(attendancePath, "utf-8");
  const attendanceRows = JSON.parse(attendanceRaw) as AttendanceRow[];
  const campus = (process.env.SAP_CAMPUS ?? "11").trim();
  const pYear = (process.env.SAP_PYEAR ?? "2026").trim();
  const pSess = (process.env.SAP_PSESS ?? "001").trim();

  const facultyNameById = new Map(data.faculties.map((f) => [f.id, f.name]));
  const departmentById = new Map(data.departments.map((d) => [d.id, d]));
  const courseById = new Map(data.courses.map((c) => [c.id, c]));
  const instructorById = new Map(
    data.users
      .filter((u) => u.role === "teacher")
      .map((u) => [u.id, u.name])
  );

  const courseToInstructorIds = new Map<string, string[]>();
  for (const teacher of data.users.filter((u) => u.role === "teacher")) {
    for (const courseId of teacher.course_ids ?? []) {
      const list = courseToInstructorIds.get(courseId) ?? [];
      list.push(teacher.id);
      courseToInstructorIds.set(courseId, list);
    }
  }

  const facultyBuckets = new Map<string, DimensionBucket>();
  const departmentBuckets = new Map<string, DimensionBucket>();
  const programBuckets = new Map<string, DimensionBucket>();
  const courseBuckets = new Map<string, DimensionBucket>();
  const instructorBuckets = new Map<string, DimensionBucket>();
  const courseToFacultyId = new Map(
    data.courses.map((course) => [course.id, course.faculty_id])
  );

  const facultyPopulation = new Map<string, Set<string>>();
  const departmentPopulation = new Map<string, Set<string>>();
  const programPopulation = new Map<string, Set<string>>();
  const coursePopulation = new Map<string, Set<string>>();
  const instructorPopulation = new Map<string, Set<string>>();

  const filteredEnrollmentRows = enrollmentRows.filter((row) => {
    const rowCampus = (row.CampCode ?? "").trim();
    const rowYear = (row.Peryr ?? "").trim();
    const rowSess = (row.Perid ?? "").trim();
    if (rowCampus && normalizeCode(rowCampus) !== normalizeCode(campus)) return false;
    if (rowYear && normalizeCode(rowYear) !== normalizeCode(pYear)) return false;
    if (rowSess && normalizeCode(rowSess) !== normalizeCode(pSess)) return false;
    return true;
  });
  const sourceRows = filteredEnrollmentRows.length ? filteredEnrollmentRows : enrollmentRows;
  const monitoredEntries = await fetchMonitoringEntries({
    Campus: process.env.SAP_CAMPUS ?? "11",
    PYear: process.env.SAP_PYEAR ?? "2026",
    PSess: process.env.SAP_PSESS ?? "001",
    Begda: process.env.SAP_BEGDA ?? "20260120",
    Endda: process.env.SAP_ENDDA ?? "20260520",
  });
  if (!monitoredEntries.length) {
    throw new Error(
      "Monitoring data is empty; aborting alert-count generation to prevent zeroed alerts."
    );
  }

  // Same as UI path: use monitoring classes map keyed by normalized CrCode + SecCode, with ToDate.
  const classesHeldByCourseSection = new Map<string, number>();
  const classesHeldByCourse = new Map<string, number>();
  for (const entry of monitoredEntries) {
    const course = normalizeCourseCode(String(entry.CrCode ?? ""));
    const section = String(entry.SecCode ?? "");
    if (!course) continue;
    const toDateRaw = entry.ToDate;
    const toDate =
      typeof toDateRaw === "number" ? toDateRaw : Number(toDateRaw ?? 0) || 0;
    if (section) {
      const key = `${course}__${section}`;
      classesHeldByCourseSection.set(key, toDate);
    }
    const currentCourseHeld = classesHeldByCourse.get(course) ?? 0;
    if (toDate > currentCourseHeld) classesHeldByCourse.set(course, toDate);
  }

  // Absences index from attendance_data.json (same keying as UI utility).
  const absencesByEnrollmentKey = new Map<string, number>();
  for (const row of attendanceRows) {
    const sap = String(row.Sapno ?? "").trim();
    const course = normalizeCourseCode(String(row.CrCode ?? ""));
    const sectionOrPackage = String(row.EventPackageId ?? row.Section ?? "").trim();
    if (!sap || !course || !sectionOrPackage) continue;
    const key = `${sap}__${course}__${sectionOrPackage}`;
    absencesByEnrollmentKey.set(key, (absencesByEnrollmentKey.get(key) ?? 0) + 1);
  }

  // Per-enrollment attendance percentage, then class averages by course-section.
  const attendancePctByEnrollmentKey = new Map<string, number>();
  const classSum = new Map<string, number>();
  const classCount = new Map<string, number>();

  for (const row of sourceRows) {
    const sap = String(row.SapNo ?? "").trim();
    const rawCourse = String(row.CrCode ?? "").trim();
    const course = normalizeCourseCode(rawCourse);
    const section = String(row.Section ?? "").trim();
    const pack = String(row.Packnumber ?? row.Section ?? "").trim();
    if (!sap || !course || !section || !pack) continue;

    const enrollKey = `${sap}__${course}__${pack}`;
    const classKey = `${course}__${section}`;
    const totalHeld =
      classesHeldByCourseSection.get(classKey) ??
      classesHeldByCourse.get(course) ??
      0;
    const absences = absencesByEnrollmentKey.get(enrollKey) ?? 0;
    const attended = Math.max(0, totalHeld - absences);
    const percentage = totalHeld > 0 ? (attended / totalHeld) * 100 : 0;

    attendancePctByEnrollmentKey.set(enrollKey, percentage);
    classSum.set(classKey, (classSum.get(classKey) ?? 0) + percentage);
    classCount.set(classKey, (classCount.get(classKey) ?? 0) + 1);
  }

  const classAvgByCourseSection = new Map<string, number>();
  for (const [classKey, sum] of classSum.entries()) {
    const count = classCount.get(classKey) ?? 1;
    classAvgByCourseSection.set(classKey, sum / count);
  }

  for (const row of sourceRows) {

    const sapId = (row.SapNo ?? "").trim();
    const courseId = (row.CrCode ?? "").trim();
    if (!sapId || !courseId) continue;

    const facultyId = (row.FacId ?? "").trim() || courseToFacultyId.get(courseId) || "";
    const departmentId = (row.DeptId ?? "").trim() || (row.DeptCode ?? "").trim();
    const programId = getProgramFromCourse(courseId);

    if (facultyId) {
      const set = facultyPopulation.get(facultyId) ?? new Set<string>();
      set.add(sapId);
      facultyPopulation.set(facultyId, set);
    }
    if (departmentId) {
      const set = departmentPopulation.get(departmentId) ?? new Set<string>();
      set.add(sapId);
      departmentPopulation.set(departmentId, set);
    }
    {
      const set = programPopulation.get(programId) ?? new Set<string>();
      set.add(sapId);
      programPopulation.set(programId, set);
    }
    {
      const set = coursePopulation.get(courseId) ?? new Set<string>();
      set.add(sapId);
      coursePopulation.set(courseId, set);
    }
    for (const instructorId of courseToInstructorIds.get(courseId) ?? []) {
      const set = instructorPopulation.get(instructorId) ?? new Set<string>();
      set.add(sapId);
      instructorPopulation.set(instructorId, set);
    }
  }

  for (const [facultyId, sapIds] of facultyPopulation.entries()) {
    const bucket = ensureBucket(
      facultyBuckets,
      facultyId,
      facultyNameById.get(facultyId) ?? facultyId
    );
    seedBucketStudents(bucket, sapIds);
  }
  for (const [departmentId, sapIds] of departmentPopulation.entries()) {
    const deptName = departmentById.get(departmentId)?.name ?? departmentId;
    const bucket = ensureBucket(departmentBuckets, departmentId, deptName);
    seedBucketStudents(bucket, sapIds);
  }
  for (const [programId, sapIds] of programPopulation.entries()) {
    const bucket = ensureBucket(programBuckets, programId, programId);
    seedBucketStudents(bucket, sapIds);
  }
  for (const [courseId, sapIds] of coursePopulation.entries()) {
    const courseName = courseById.get(courseId)?.name ?? courseId;
    const bucket = ensureBucket(courseBuckets, courseId, courseName);
    seedBucketStudents(bucket, sapIds);
  }
  for (const [instructorId, sapIds] of instructorPopulation.entries()) {
    const instructorName = instructorById.get(instructorId) ?? instructorId;
    const bucket = ensureBucket(instructorBuckets, instructorId, instructorName);
    seedBucketStudents(bucket, sapIds);
  }

  // Apply attendance alerts onto enrolled population.
  for (const row of sourceRows) {
    const sapId = String(row.SapNo ?? "").trim();
    const rawCourse = String(row.CrCode ?? "").trim();
    const courseId = rawCourse;
    const courseNorm = normalizeCourseCode(rawCourse);
    const section = String(row.Section ?? "").trim();
    const pack = String(row.Packnumber ?? row.Section ?? "").trim();
    if (!sapId || !courseId || !courseNorm || !section || !pack) continue;

    const enrollKey = `${sapId}__${courseNorm}__${pack}`;
    const classKey = `${courseNorm}__${section}`;
    const studentPct = attendancePctByEnrollmentKey.get(enrollKey);
    const classAvg = classAvgByCourseSection.get(classKey);
    if (studentPct == null || classAvg == null) continue;
    const diff = classAvg - studentPct;
    const attendanceLevel: Level =
      diff >= 40 ? "critical" : diff >= 20 ? "warning" : null;

    const course = courseById.get(courseId);
    const facultyId = (row.FacId ?? "").trim() || course?.faculty_id || "";
    const departmentId =
      (row.DeptId ?? "").trim() ||
      (row.DeptCode ?? "").trim() ||
      course?.department_id ||
      "";
    const programId = getProgramFromCourse(courseId);

    if (facultyId) {
      const bucket = facultyBuckets.get(facultyId);
      if (bucket) updateBucketIfEnrolled(bucket, sapId, null, attendanceLevel);
    }
    if (departmentId) {
      const bucket = departmentBuckets.get(departmentId);
      if (bucket) updateBucketIfEnrolled(bucket, sapId, null, attendanceLevel);
    }
    {
      const bucket = programBuckets.get(programId);
      if (bucket) updateBucketIfEnrolled(bucket, sapId, null, attendanceLevel);
    }
    {
      const bucket = courseBuckets.get(courseId);
      if (bucket) updateBucketIfEnrolled(bucket, sapId, null, attendanceLevel);
    }
    for (const instructorId of courseToInstructorIds.get(courseId) ?? []) {
      const bucket = instructorBuckets.get(instructorId);
      if (bucket) updateBucketIfEnrolled(bucket, sapId, null, attendanceLevel);
    }
  }

  return [
    ...toRows(date, "faculty", facultyBuckets),
    ...toRows(date, "department", departmentBuckets),
    ...toRows(date, "program", programBuckets),
    ...toRows(date, "course", courseBuckets),
    ...toRows(date, "instructor", instructorBuckets),
  ];
}

export async function upsertAlertCountRows(rows: AlertCountsRow[]): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  if (!rows.length) return 0;

  await pool.query("BEGIN");
  try {
    const sql = `
      INSERT INTO alert_counts_by_dimension (
        snapshot_date,
        dimension_type,
        dimension_id,
        dimension_name,
        total_students,
        yellow_gpa,
        red_gpa,
        yellow_attendance,
        red_attendance
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (snapshot_date, dimension_type, dimension_id)
      DO UPDATE SET
        dimension_name = EXCLUDED.dimension_name,
        total_students = EXCLUDED.total_students,
        yellow_gpa = EXCLUDED.yellow_gpa,
        red_gpa = EXCLUDED.red_gpa,
        yellow_attendance = EXCLUDED.yellow_attendance,
        red_attendance = EXCLUDED.red_attendance
    `;

    for (const row of rows) {
      await pool.query(sql, [
        row.snapshot_date,
        row.dimension_type,
        row.dimension_id,
        row.dimension_name,
        row.total_students,
        row.yellow_gpa,
        row.red_gpa,
        row.yellow_attendance,
        row.red_attendance,
      ]);
    }

    await pool.query("COMMIT");
    return rows.length;
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

