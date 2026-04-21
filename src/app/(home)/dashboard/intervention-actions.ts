"use server";

import { recordIntervention as saveIntervention } from "@/data/intervention-store";
import { saveInterventionEmail } from "@/data/intervention-store";
import type { InterventionEmailTemplateKey } from "@/components/Forms/Intervention-Form";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { insertWellbeingCase } from "@/lib/db/wellbeing";
import { pool } from "@/lib/db";
import { recordDirectWellbeingIntervention as saveDirectWellbeingIntervention } from "@/data/intervention-store";

/** Form payload from Intervention-Form (date, outreachMode, remarks, status). */
export type RecordInterventionInput = {
  date: string;
  interventionType: "attendance" | "gpa" | "both";
  outreachMode: string;
  remarks: string;
  status: string;
  focusedCourseId?: string | null;
  focusedSectionCode?: string | null;
  focusedEventPackageId?: string | null;
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
  /** Manual option: append a new intervention row with status "resolved". */
  setInterventionResolved?: boolean;
};

/** Wellbeing direct cases are always external. */
export type RecordDirectWellbeingCaseInput = {
  date: string;
  interventionType: "attendance" | "gpa" | "both";
  outreachMode: string;
  remarks: string;
  status: string;
  assigneeStaffId: string;
  externalNotes?: string;
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
    focused_course_id: data.focusedCourseId ?? null,
    focused_section_code: data.focusedSectionCode ?? null,
    focused_event_package_id: data.focusedEventPackageId ?? null,
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
  const isWellbeingRole =
    session.user.role === "wellbeing" ||
    session.user.role === "wellbeing-counseller" ||
    session.user.role === "wellbeing-head";
  if (!isWellbeingRole && session.user.role !== "superadmin") {
    throw new Error("Only wellbeing can add wellbeing resolution.");
  }
  if (
    (session.user.role === "wellbeing" ||
      session.user.role === "wellbeing-counseller") &&
    pool
  ) {
    const access = await pool.query<{
      status: string | null;
      has_case: boolean;
      has_direct: boolean;
    }>(
      `WITH latest AS (
         SELECT status
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY performed_at DESC
         LIMIT 1
       )
       SELECT
         (SELECT status FROM latest) AS status,
         EXISTS (
           SELECT 1
           FROM wellbeing_cases wb
           WHERE wb.student_sap_id = $1
         ) AS has_case,
         EXISTS (
           SELECT 1 FROM wellbeing_direct_cases wdc
           WHERE wdc.student_sap_id = $1
         ) AS has_direct`,
      [studentSapId]
    );
    const row = access.rows[0];
    const isReferred = row?.status === "referred";
    const hasWellbeingCase = row?.has_case === true;
    const hasDirectCase = row?.has_direct === true;
    if (!isReferred && !hasWellbeingCase && !hasDirectCase) {
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

  const isInterventionCategory =
    data.category === "Counselling" || data.category === "Monitoring";

  if (isInterventionCategory) {
    const today = new Date().toISOString().slice(0, 10);
    const status =
      data.setInterventionResolved === true
        ? "resolved"
        : data.wellbeingStatus === "closed"
          ? "resolved"
          : "referred";
    await saveIntervention(studentSapId, {
      date: today,
      intervention_type: data.category === "Monitoring" ? "both" : "attendance",
      outreach_mode: "wellbeing-update",
      remarks: data.remarks || `Wellbeing ${data.category} update.`,
      status,
    });
    return;
  }

  if (data.setInterventionResolved === true) {
    const today = new Date().toISOString().slice(0, 10);
    await saveIntervention(studentSapId, {
      date: today,
      intervention_type: "both",
      outreach_mode: "wellbeing-update",
      remarks: "Intervention status marked as resolved by wellbeing.",
      status: "resolved",
    });
  }
}

export async function recordDirectWellbeingCase(
  studentSapId: string,
  data: RecordDirectWellbeingCaseInput
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }
  const isWellbeingRoleForDirect =
    session.user.role === "wellbeing" ||
    session.user.role === "wellbeing-counseller" ||
    session.user.role === "wellbeing-head";
  if (!isWellbeingRoleForDirect && session.user.role !== "superadmin") {
    throw new Error("Only wellbeing can add direct cases.");
  }
  if (!String(data.assigneeStaffId ?? "").trim()) {
    throw new Error("Assignee is required.");
  }
  await saveDirectWellbeingIntervention(studentSapId, {
    date: data.date,
    intervention_type: data.interventionType,
    outreach_mode: data.outreachMode,
    remarks: data.remarks,
    status: data.status,
    case_type: "external",
    assignee_staff_id: data.assigneeStaffId,
    external_notes: data.externalNotes,
  });
}
