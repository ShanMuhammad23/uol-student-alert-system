"use server";

import { recordIntervention as saveIntervention } from "@/data/intervention-store";
import { saveInterventionEmail } from "@/data/intervention-store";
import type { InterventionEmailTemplateKey } from "@/components/Forms/Intervention-Form";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { insertWellbeingCase } from "@/lib/db/wellbeing";
import { pool } from "@/lib/db";

/** Form payload from Intervention-Form (date, outreachMode, remarks, status). */
export type RecordInterventionInput = {
  date: string;
  interventionType: "attendance" | "gpa" | "both";
  outreachMode: string;
  remarks: string;
  status: string;
};

export type RecordInterventionEmailInput = {
  templateKey: InterventionEmailTemplateKey;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
};

export type RecordWellbeingCaseInput = {
  category: "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
  wellbeingStatus: "open" | "closed";
  remarks: string;
};

export async function recordIntervention(
  studentSapId: string,
  data: RecordInterventionInput
): Promise<void> {
  await saveIntervention(studentSapId, {
    date: data.date,
    intervention_type: data.interventionType,
    outreach_mode: data.outreachMode,
    remarks: data.remarks,
    status: data.status,
  });
}

export async function recordInterventionEmail(
  studentSapId: string,
  data: RecordInterventionEmailInput
): Promise<void> {
  await saveInterventionEmail(studentSapId, {
    template_key: data.templateKey,
    recipient_email: data.recipientEmail,
    subject: data.subject,
    body_html: data.bodyHtml,
  });
}

export async function recordWellbeingCase(
  studentSapId: string,
  data: RecordWellbeingCaseInput
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }
  if (session.user.role !== "wellbeing" && session.user.role !== "superadmin") {
    throw new Error("Only wellbeing can add wellbeing resolution.");
  }
  if (session.user.role === "wellbeing" && pool) {
    const latest = await pool.query<{ status: string | null }>(
      `SELECT status
       FROM interventions
       WHERE student_sap_id = $1
       ORDER BY performed_at DESC
       LIMIT 1`,
      [studentSapId]
    );
    if (latest.rows[0]?.status !== "referred") {
      throw new Error("Wellbeing can only manage referred students.");
    }
  }

  const created = await insertWellbeingCase({
    studentSapId,
    category: data.category,
    wellbeingStatus: data.wellbeingStatus,
    remarks: data.remarks ?? "",
    staffId: session.user.id,
  });
  if (!created) {
    throw new Error("Failed to save wellbeing case.");
  }

  if (pool) {
    await pool.query(
      `WITH latest AS (
         SELECT id
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY performed_at DESC
         LIMIT 1
       )
       UPDATE interventions i
       SET status = 'resolved'
       FROM latest
       WHERE i.id = latest.id`,
      [studentSapId]
    );
  }
}
