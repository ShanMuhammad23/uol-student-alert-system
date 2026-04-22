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

type AlertCountOptions = {
  facultyIds?: string[];
};

export async function buildAlertCountRows(
  snapshotDate?: string,
  options?: AlertCountOptions
): Promise<AlertCountsRow[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const scopedFacultyIds = Array.from(
    new Set((options?.facultyIds ?? []).map((v) => String(v).trim()).filter(Boolean))
  );
  if (!scopedFacultyIds.length) {
    throw new Error("facultyIds is required for alert counts (global counts are disabled).");
  }
  const res = await pool.query<AlertCountsRow>(
    `
      WITH enrollment_dim AS (
        SELECT
          e.sap_id,
          'faculty'::text AS dimension_type,
          e.faculty_id AS dimension_id,
          COALESCE(NULLIF(TRIM(f.name), ''), e.faculty_id) AS dimension_name
        FROM student_enrollment_current e
        LEFT JOIN faculties f ON f.id = e.faculty_id
        WHERE e.is_active = TRUE
          AND e.faculty_id IS NOT NULL
          AND e.faculty_id <> ''
          AND e.faculty_id = ANY($2::text[])

        UNION ALL

        SELECT
          e.sap_id,
          'department'::text AS dimension_type,
          e.department_id AS dimension_id,
          COALESCE(NULLIF(TRIM(d.name), ''), e.department_id) AS dimension_name
        FROM student_enrollment_current e
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.is_active = TRUE
          AND e.department_id IS NOT NULL
          AND e.department_id <> ''
          AND e.faculty_id = ANY($2::text[])

        UNION ALL

        SELECT
          e.sap_id,
          'program'::text AS dimension_type,
          e.program_id AS dimension_id,
          COALESCE(NULLIF(TRIM(p.title), ''), e.program_id) AS dimension_name
        FROM student_enrollment_current e
        LEFT JOIN programs p ON p.id = e.program_id
        WHERE e.is_active = TRUE
          AND e.program_id IS NOT NULL
          AND e.program_id <> ''
          AND e.faculty_id = ANY($2::text[])

        UNION ALL

        SELECT
          e.sap_id,
          'course'::text AS dimension_type,
          e.course_id AS dimension_id,
          COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS dimension_name
        FROM student_enrollment_current e
        LEFT JOIN courses c ON c.id = e.course_id
        WHERE e.is_active = TRUE
          AND e.course_id IS NOT NULL
          AND e.course_id <> ''
          AND e.faculty_id = ANY($2::text[])

        UNION ALL

        SELECT
          e.sap_id,
          'instructor'::text AS dimension_type,
          e.instructor_pernr AS dimension_id,
          COALESCE(
            NULLIF(TRIM(s.name), ''),
            NULLIF(TRIM(e.instructor_name), ''),
            e.instructor_pernr
          ) AS dimension_name
        FROM student_enrollment_current e
        LEFT JOIN staff s ON s.pernr = e.instructor_pernr
        WHERE e.is_active = TRUE
          AND e.instructor_pernr IS NOT NULL
          AND e.instructor_pernr <> ''
          AND e.faculty_id = ANY($2::text[])
      ),
      pop AS (
        SELECT DISTINCT sap_id, dimension_type, dimension_id, dimension_name
        FROM enrollment_dim
      ),
      sev AS (
        SELECT
          p.sap_id,
          p.dimension_type,
          p.dimension_id,
          MAX(
            CASE
              WHEN a.gpa_alert_level = 'warning' THEN 1
              ELSE 0
            END
          ) AS gpa_has_warning,
          MAX(
            CASE
              WHEN a.gpa_alert_level = 'critical' THEN 1
              ELSE 0
            END
          ) AS gpa_has_critical,
          MAX(
            CASE
              WHEN a.attendance_alert_level = 'warning' THEN 1
              ELSE 0
            END
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
        FROM pop p
        LEFT JOIN student_enrollment_current e
          ON e.is_active = TRUE
         AND e.sap_id = p.sap_id
         AND (
              (p.dimension_type = 'faculty' AND e.faculty_id = p.dimension_id) OR
              (p.dimension_type = 'department' AND e.department_id = p.dimension_id) OR
              (p.dimension_type = 'program' AND e.program_id = p.dimension_id) OR
              (p.dimension_type = 'course' AND e.course_id = p.dimension_id) OR
              (p.dimension_type = 'instructor' AND e.instructor_pernr = p.dimension_id)
         )
        LEFT JOIN student_alert_current a
          ON a.sap_id = e.sap_id
         AND a.course_id = e.course_id
         AND a.section_code = e.section_code
         AND a.event_package_id = e.event_package_id
        GROUP BY p.sap_id, p.dimension_type, p.dimension_id
      )
      SELECT
        $1::date AS snapshot_date,
        p.dimension_type::text AS dimension_type,
        p.dimension_id::text AS dimension_id,
        p.dimension_name::text AS dimension_name,
        COUNT(*)::int AS total_students,
        COUNT(*) FILTER (WHERE COALESCE(s.gpa_has_warning, 0) = 1)::int AS yellow_gpa,
        COUNT(*) FILTER (WHERE COALESCE(s.gpa_has_critical, 0) = 1)::int AS red_gpa,
        COUNT(*) FILTER (WHERE COALESCE(s.attendance_has_warning, 0) = 1)::int AS yellow_attendance,
        COUNT(*) FILTER (WHERE COALESCE(s.attendance_has_critical, 0) = 1)::int AS red_attendance
      FROM pop p
      LEFT JOIN sev s
        ON s.sap_id = p.sap_id
       AND s.dimension_type = p.dimension_type
       AND s.dimension_id = p.dimension_id
      GROUP BY p.dimension_type, p.dimension_id, p.dimension_name
    `,
    [date, scopedFacultyIds]
  );

  return res.rows;
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

