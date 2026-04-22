import { pool } from "@/lib/db";

export async function insertWellbeingDirectCase(input: {
  studentSapId: string;
  interventionId: string;
  visitDate: string;
  reasonForVisit: string;
  initialFindings: string;
  directCaseStatus: string;
  externalNotes: string;
  createdByStaffId: string;
}): Promise<string | null> {
  if (!pool) return null;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO wellbeing_direct_cases (
       student_sap_id,
       intervention_id,
       visit_date,
       reason_for_visit,
       initial_findings,
       direct_case_status,
       external_notes,
       created_by_staff_id
     ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
     RETURNING id::text`,
    [
      input.studentSapId,
      input.interventionId,
      input.visitDate,
      input.reasonForVisit ?? "",
      input.initialFindings ?? "",
      input.directCaseStatus,
      input.externalNotes ?? "",
      input.createdByStaffId,
    ]
  );
  return res.rows[0]?.id ?? null;
}
