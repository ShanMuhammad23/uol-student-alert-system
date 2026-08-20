import { pool } from "@/lib/db";
import { enrolledInCurrentTermSql } from "@/lib/academic-term";
import {
  resolveFacultyNameFromIdOrName,
  toShortFacultyName,
} from "@/lib/faculty-name";

export type InstructorFacultyRollupItem = {
  facultyId: string;
  /** Resolved + shortened for compact header display */
  displayLabel: string;
  studentCount: number;
};

/**
 * Distinct faculties where this instructor appears on active enrollment,
 * with distinct student (SAP) counts per faculty.
 */
export async function getInstructorFacultyRollup(
  instructorPernr: string
): Promise<InstructorFacultyRollupItem[]> {
  if (!pool) return [];
  const pernr = instructorPernr.trim();
  if (!pernr) return [];

  const res = await pool.query<{
    faculty_id: string;
    faculty_name: string | null;
    student_count: string | number;
  }>(
    `SELECT
       e.faculty_id,
       MAX(f.name) AS faculty_name,
       COUNT(DISTINCT e.sap_id)::bigint AS student_count
     FROM student_enrollment_current e
     LEFT JOIN faculties f ON f.id = e.faculty_id
     WHERE ${enrolledInCurrentTermSql("e")}
       AND e.faculty_id IS NOT NULL
       AND TRIM(COALESCE(e.instructor_pernr, '')) <> ''
       AND TRIM(e.instructor_pernr) = TRIM($1)
     GROUP BY e.faculty_id
     ORDER BY MAX(f.name) ASC NULLS LAST`,
    [pernr]
  );

  return res.rows.map((row) => {
    const resolved =
      resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name) ??
      row.faculty_id;
    const short = toShortFacultyName(resolved) ?? resolved;
    return {
      facultyId: row.faculty_id,
      displayLabel: short,
      studentCount: Number(row.student_count),
    };
  });
}
