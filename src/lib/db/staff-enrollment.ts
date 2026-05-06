import { pool } from "@/lib/db";

/** Returns true if `pernr` appears as an instructor on at least one active enrollment row. */
export async function isInstructorPernrInEnrollment(
  pernr: string
): Promise<boolean> {
  if (!pool) return false;
  const normalized = String(pernr ?? "").trim();
  if (!normalized) return false;

  const res = await pool.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM student_enrollment_current e
      WHERE e.is_active = TRUE
        AND e.instructor_pernr IS NOT NULL
        AND TRIM(BOTH FROM e.instructor_pernr) = $1
    ) AS ok
    `,
    [normalized]
  );

  return Boolean(res.rows[0]?.ok);
}
