import { pool } from "@/lib/db";

export type AlertDailySnapshotOptions = {
  facultyIds: string[];
  etlRunId?: number | null;
};

/**
 * Copies current alert facts into student_alert_daily for the given snapshot_date.
 * Scoped by faculty_id (same pattern as alert-counts / effectiveness ETL).
 * Re-running on the same date refreshes that day's rows (ON CONFLICT DO UPDATE).
 */
export async function upsertStudentAlertDailySnapshot(
  snapshotDate?: string,
  options?: AlertDailySnapshotOptions
): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");

  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const facultyIds = Array.from(
    new Set((options?.facultyIds ?? []).map((v) => String(v).trim()).filter(Boolean))
  );
  if (!facultyIds.length) {
    throw new Error(
      "facultyIds is required for student_alert_daily snapshot (global snapshots are disabled)."
    );
  }

  const res = await pool.query(
    `
      INSERT INTO student_alert_daily (
        snapshot_date,
        sap_id,
        course_id,
        section_code,
        event_package_id,
        faculty_id,
        department_id,
        program_id,
        instructor_pernr,
        attendance_alert_level,
        gpa_alert_level,
        overall_alert_level,
        total_classes_held,
        attendance_marked_classes,
        attendance_not_updated_classes,
        classes_attended,
        attendance_percentage,
        class_average_attendance,
        gpa_current,
        gpa_previous,
        gpa_change,
        etl_run_id
      )
      SELECT
        $1::date,
        c.sap_id,
        c.course_id,
        c.section_code,
        c.event_package_id,
        c.faculty_id,
        c.department_id,
        c.program_id,
        c.instructor_pernr,
        c.attendance_alert_level,
        c.gpa_alert_level,
        c.overall_alert_level,
        c.total_classes_held,
        c.attendance_marked_classes,
        c.attendance_not_updated_classes,
        c.classes_attended,
        c.attendance_percentage,
        c.class_average_attendance,
        c.gpa_current,
        c.gpa_previous,
        c.gpa_change,
        $3
      FROM student_alert_current c
      WHERE c.faculty_id = ANY($2::text[])
      ON CONFLICT (snapshot_date, sap_id, course_id, section_code, event_package_id)
      DO UPDATE SET
        faculty_id = EXCLUDED.faculty_id,
        department_id = EXCLUDED.department_id,
        program_id = EXCLUDED.program_id,
        instructor_pernr = EXCLUDED.instructor_pernr,
        attendance_alert_level = EXCLUDED.attendance_alert_level,
        gpa_alert_level = EXCLUDED.gpa_alert_level,
        overall_alert_level = EXCLUDED.overall_alert_level,
        total_classes_held = EXCLUDED.total_classes_held,
        attendance_marked_classes = EXCLUDED.attendance_marked_classes,
        attendance_not_updated_classes = EXCLUDED.attendance_not_updated_classes,
        classes_attended = EXCLUDED.classes_attended,
        attendance_percentage = EXCLUDED.attendance_percentage,
        class_average_attendance = EXCLUDED.class_average_attendance,
        gpa_current = EXCLUDED.gpa_current,
        gpa_previous = EXCLUDED.gpa_previous,
        gpa_change = EXCLUDED.gpa_change,
        etl_run_id = EXCLUDED.etl_run_id
    `,
    [date, facultyIds, options?.etlRunId ?? null]
  );

  return res.rowCount ?? 0;
}

export async function getLatestStudentAlertDailyDate(
  facultyIds?: string[]
): Promise<string | null> {
  if (!pool) return null;
  const scoped = Array.from(
    new Set((facultyIds ?? []).map((v) => String(v).trim()).filter(Boolean))
  );
  try {
    if (scoped.length) {
      const res = await pool.query<{ snapshot_date: string }>(
        `SELECT MAX(snapshot_date)::text AS snapshot_date
         FROM student_alert_daily
         WHERE faculty_id = ANY($1::text[])`,
        [scoped]
      );
      return res.rows[0]?.snapshot_date ?? null;
    }
    const res = await pool.query<{ snapshot_date: string }>(
      `SELECT MAX(snapshot_date)::text AS snapshot_date FROM student_alert_daily`
    );
    return res.rows[0]?.snapshot_date ?? null;
  } catch {
    return null;
  }
}
