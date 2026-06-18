import { pool } from "@/lib/db";

export type AlertLevel = "none" | "warning" | "critical";

export type StudentAlertDailyEntry = {
  snapshotDate: string;
  courseId: string;
  courseTitle: string | null;
  sectionCode: string;
  eventPackageId: string;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaAlertLevel: "warning" | "critical" | null;
  overallAlertLevel: AlertLevel;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  gpaCurrent: number | null;
  gpaPrevious: number | null;
  gpaChange: number | null;
};

export type StudentAlertHistoryOptions = {
  courseId?: string | null;
  sectionCode?: string | null;
  eventPackageId?: string | null;
  limit?: number;
};

export async function getStudentAlertDailyHistory(
  sapId: string,
  options?: StudentAlertHistoryOptions
): Promise<StudentAlertDailyEntry[]> {
  if (!pool) return [];

  const courseId = String(options?.courseId ?? "").trim() || null;
  const sectionCode = String(options?.sectionCode ?? "").trim() || null;
  const eventPackageId = String(options?.eventPackageId ?? "").trim() || null;
  const limit = Math.min(Math.max(options?.limit ?? 365, 1), 1000);

  try {
    const res = await pool.query<{
      snapshot_date: string;
      course_id: string;
      course_title: string | null;
      section_code: string;
      event_package_id: string;
      attendance_alert_level: "warning" | "critical" | null;
      gpa_alert_level: "warning" | "critical" | null;
      overall_alert_level: AlertLevel;
      attendance_percentage: number | null;
      class_average_attendance: number | null;
      gpa_current: number | null;
      gpa_previous: number | null;
      gpa_change: number | null;
    }>(
      `SELECT
         sad.snapshot_date::text,
         sad.course_id,
         c.title AS course_title,
         sad.section_code,
         sad.event_package_id,
         sad.attendance_alert_level,
         sad.gpa_alert_level,
         sad.overall_alert_level,
         sad.attendance_percentage,
         sad.class_average_attendance,
         sad.gpa_current,
         sad.gpa_previous,
         sad.gpa_change
       FROM student_alert_daily sad
       LEFT JOIN courses c ON c.id = sad.course_id
       WHERE sad.sap_id = $1
         AND ($2::text IS NULL OR sad.course_id = $2)
         AND ($3::text IS NULL OR sad.section_code = $3)
         AND ($4::text IS NULL OR sad.event_package_id = $4)
       ORDER BY sad.snapshot_date DESC, sad.course_id ASC, sad.section_code ASC
       LIMIT $5`,
      [sapId, courseId, sectionCode, eventPackageId, limit]
    );

    return res.rows.map((r) => ({
      snapshotDate: r.snapshot_date,
      courseId: r.course_id,
      courseTitle: r.course_title,
      sectionCode: r.section_code ?? "",
      eventPackageId: r.event_package_id ?? "",
      attendanceAlertLevel: r.attendance_alert_level,
      gpaAlertLevel: r.gpa_alert_level,
      overallAlertLevel: r.overall_alert_level,
      attendancePercentage:
        r.attendance_percentage == null ? null : Number(r.attendance_percentage),
      classAverageAttendance:
        r.class_average_attendance == null
          ? null
          : Number(r.class_average_attendance),
      gpaCurrent: r.gpa_current == null ? null : Number(r.gpa_current),
      gpaPrevious: r.gpa_previous == null ? null : Number(r.gpa_previous),
      gpaChange: r.gpa_change == null ? null : Number(r.gpa_change),
    }));
  } catch {
    return [];
  }
}
