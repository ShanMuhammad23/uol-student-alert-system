"use server";

import { recordIntervention as saveIntervention } from "@/data/intervention-store";
import { saveInterventionEmail } from "@/data/intervention-store";
import type { InterventionEmailTemplateKey } from "@/components/Forms/Intervention-Form";

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
