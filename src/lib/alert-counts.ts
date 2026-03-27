import {
  getDeanDepartmentStats,
  getDeanInstructorStats,
  getFullData,
  getHodProgramStats,
} from "@/app/(home)/dashboard/fetch";
import { pool } from "@/lib/db";

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

export async function buildAlertCountRows(snapshotDate?: string): Promise<AlertCountsRow[]> {
  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const data = await getFullData();
  const rows: AlertCountsRow[] = [];

  for (const faculty of data.faculties) {
    const students = data.students.filter((s) => s.faculty_id === faculty.id);
    let yellowGpa = 0;
    let redGpa = 0;
    let yellowAttendance = 0;
    let redAttendance = 0;
    for (const student of students) {
      if (student.gpa.alert_level === "warning") yellowGpa += 1;
      if (student.gpa.alert_level === "critical") redGpa += 1;
      if (student.attendance.alert_level === "warning") yellowAttendance += 1;
      if (student.attendance.alert_level === "critical") redAttendance += 1;
    }
    rows.push({
      snapshot_date: date,
      dimension_type: "faculty",
      dimension_id: faculty.id,
      dimension_name: faculty.name,
      total_students: students.length,
      yellow_gpa: yellowGpa,
      red_gpa: redGpa,
      yellow_attendance: yellowAttendance,
      red_attendance: redAttendance,
    });
  }

  const departmentStats = await getDeanDepartmentStats(null);
  for (const stat of departmentStats) {
    rows.push({
      snapshot_date: date,
      dimension_type: "department",
      dimension_id: stat.departmentId,
      dimension_name: stat.departmentName,
      total_students: stat.total,
      yellow_gpa: stat.yellowGpa,
      red_gpa: stat.redGpa,
      yellow_attendance: stat.yellowAttendance,
      red_attendance: stat.redAttendance,
    });
  }

  const departmentIds = data.departments.map((d) => d.id);
  const programStats = await getHodProgramStats(departmentIds);
  for (const stat of programStats) {
    rows.push({
      snapshot_date: date,
      dimension_type: "program",
      dimension_id: stat.programId,
      dimension_name: stat.programTitle ?? stat.programId,
      total_students: stat.total,
      yellow_gpa: stat.yellowGpa,
      red_gpa: stat.redGpa,
      yellow_attendance: stat.yellowAttendance,
      red_attendance: stat.redAttendance,
    });
  }

  const courseNameById = new Map(
    data.courses.map((course) => [course.id, course.name ?? course.id])
  );
  const studentsByCourse = new Map<string, typeof data.students>();
  for (const student of data.students) {
    const list = studentsByCourse.get(student.course_id) ?? [];
    list.push(student);
    studentsByCourse.set(student.course_id, list);
  }
  for (const [courseId, students] of studentsByCourse.entries()) {
    let yellowGpa = 0;
    let redGpa = 0;
    let yellowAttendance = 0;
    let redAttendance = 0;
    for (const student of students) {
      if (student.gpa.alert_level === "warning") yellowGpa += 1;
      if (student.gpa.alert_level === "critical") redGpa += 1;
      if (student.attendance.alert_level === "warning") yellowAttendance += 1;
      if (student.attendance.alert_level === "critical") redAttendance += 1;
    }
    rows.push({
      snapshot_date: date,
      dimension_type: "course",
      dimension_id: courseId,
      dimension_name: courseNameById.get(courseId) ?? courseId,
      total_students: students.length,
      yellow_gpa: yellowGpa,
      red_gpa: redGpa,
      yellow_attendance: yellowAttendance,
      red_attendance: redAttendance,
    });
  }

  const instructorStats = await getDeanInstructorStats(null);
  for (const stat of instructorStats) {
    rows.push({
      snapshot_date: date,
      dimension_type: "instructor",
      dimension_id: stat.instructorId,
      dimension_name: stat.instructorName,
      total_students: stat.total,
      yellow_gpa: stat.yellowGpa,
      red_gpa: stat.redGpa,
      yellow_attendance: stat.yellowAttendance,
      red_attendance: stat.redAttendance,
    });
  }

  return rows;
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
        red_attendance,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (snapshot_date, dimension_type, dimension_id)
      DO UPDATE SET
        dimension_name = EXCLUDED.dimension_name,
        total_students = EXCLUDED.total_students,
        yellow_gpa = EXCLUDED.yellow_gpa,
        red_gpa = EXCLUDED.red_gpa,
        yellow_attendance = EXCLUDED.yellow_attendance,
        red_attendance = EXCLUDED.red_attendance,
        updated_at = NOW()
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

