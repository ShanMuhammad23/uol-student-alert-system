import { pool } from "@/lib/db";
import type { InactiveLoginReminderRow } from "@/lib/inactive-login-reminder-types";

export type InactiveLoginReminderEmailStatus =
  | "sent"
  | "dry_run"
  | "skipped_no_email"
  | "skipped_duplicate"
  | "failed";

export type InsertInactiveLoginReminderEmailInput = {
  runId: number;
  facultyId?: string | null;
  status: InactiveLoginReminderEmailStatus;
  row: InactiveLoginReminderRow;
  recipientEmail?: string | null;
  sourceEmail?: string | null;
  emailSubject?: string | null;
  bodyHtml?: string | null;
  errorMessage?: string | null;
  dryRun?: boolean;
  smtpOverrideTo?: string | null;
  sentAt?: Date | null;
};

export async function createInactiveLoginReminderRun(input: {
  facultyId?: string | null;
  inactiveDays: number;
  dryRun: boolean;
}): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const res = await pool.query<{ id: string }>(
    `INSERT INTO inactive_login_reminder_runs (
       faculty_id, inactive_days, dry_run, status
     ) VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [input.facultyId?.trim() || null, input.inactiveDays, input.dryRun]
  );
  return Number(res.rows[0]?.id);
}

export async function finalizeInactiveLoginReminderRun(input: {
  runId: number;
  candidatesCount: number;
  sentCount: number;
  skippedNoEmail: number;
  skippedDuplicate: number;
  failedCount: number;
  status: "success" | "failed";
  errorMessage?: string | null;
}): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE inactive_login_reminder_runs
     SET completed_at = NOW(),
         status = $2,
         candidates_count = $3,
         sent_count = $4,
         skipped_no_email = $5,
         skipped_duplicate = $6,
         failed_count = $7,
         error_message = NULLIF(TRIM($8::text), '')
     WHERE id = $1`,
    [
      input.runId,
      input.status,
      input.candidatesCount,
      input.sentCount,
      input.skippedNoEmail,
      input.skippedDuplicate,
      input.failedCount,
      input.errorMessage ?? "",
    ]
  );
}

export async function insertInactiveLoginReminderEmail(
  input: InsertInactiveLoginReminderEmailInput
): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const { row } = input;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO inactive_login_reminder_emails (
       run_id,
       faculty_id,
       status,
       staff_id,
       staff_pernr,
       staff_name,
       recipient_email,
       source_email,
       login_count,
       never_logged_in,
       last_login_at,
       last_login_display,
       email_subject,
       body_html,
       error_message,
       dry_run,
       smtp_override_to,
       sent_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
     )
     RETURNING id`,
    [
      input.runId,
      input.facultyId?.trim() || row.facultyId || null,
      input.status,
      row.staffId || null,
      row.staffPernr || null,
      row.staffName || null,
      input.recipientEmail?.trim() || null,
      input.sourceEmail?.trim() || null,
      row.loginCount ?? 0,
      row.neverLoggedIn ?? false,
      row.lastLoginAt,
      row.lastLoginDisplay || null,
      input.emailSubject?.trim() || null,
      input.bodyHtml ?? null,
      input.errorMessage?.trim() || null,
      input.dryRun ?? false,
      input.smtpOverrideTo?.trim() || null,
      input.sentAt ?? null,
    ]
  );
  return Number(res.rows[0]?.id);
}
