import { pool } from "@/lib/db";

export async function insertWellbeingDirectCase(input: {
  studentSapId: string;
  interventionId: string;
  externalNotes: string;
  createdByStaffId: string;
}): Promise<string | null> {
  if (!pool) return null;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO wellbeing_direct_cases (
       student_sap_id,
       intervention_id,
       external_notes,
       created_by_staff_id
     ) VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [
      input.studentSapId,
      input.interventionId,
      input.externalNotes ?? "",
      input.createdByStaffId,
    ]
  );
  return res.rows[0]?.id ?? null;
}
