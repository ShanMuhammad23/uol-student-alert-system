import { pool } from "@/lib/db";
import type { MissingAttendanceReminderRow } from "@/lib/missing-attendance-reminder-types";

export type MissingAttendanceReminderEmailStatus =
  | "sent"
  | "dry_run"
  | "skipped_no_email"
  | "skipped_duplicate_instructor"
  | "failed";

export type InsertMissingAttendanceReminderEmailInput = {
  runId: number;
  facultyId: string;
  snapshotDate: string;
  status: MissingAttendanceReminderEmailStatus;
  row: MissingAttendanceReminderRow;
  recipientEmail?: string | null;
  sourceInstructorEmail?: string | null;
  emailSubject?: string | null;
  bodyHtml?: string | null;
  errorMessage?: string | null;
  dryRun?: boolean;
  smtpOverrideTo?: string | null;
  ccRecipients?: string[] | null;
  sentAt?: Date | null;
};

export async function createMissingAttendanceReminderRun(input: {
  facultyId: string;
  snapshotDate: string;
  minMissingEntries: number;
  dryRun: boolean;
}): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const res = await pool.query<{ id: string }>(
    `INSERT INTO missing_attendance_reminder_runs (
       faculty_id, snapshot_date, min_missing_entries, dry_run, status
     ) VALUES ($1, $2::date, $3, $4, 'running')
     RETURNING id`,
    [input.facultyId, input.snapshotDate, input.minMissingEntries, input.dryRun]
  );
  return Number(res.rows[0]?.id);
}

export async function finalizeMissingAttendanceReminderRun(input: {
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
    `UPDATE missing_attendance_reminder_runs
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

export async function insertMissingAttendanceReminderEmail(
  input: InsertMissingAttendanceReminderEmailInput
): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const { row } = input;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO missing_attendance_reminder_emails (
       run_id,
       faculty_id,
       snapshot_date,
       status,
       instructor_pernr,
       instructor_name,
       recipient_email,
       source_instructor_email,
       course_id,
       course_code,
       course_name,
       department_name,
       section_code,
       event_package_id,
       students_enrolled,
       classes_held,
       attendance_posted,
       missing_entries,
       email_subject,
       body_html,
       error_message,
       dry_run,
       smtp_override_to,
       cc_recipients,
       sent_at
     ) VALUES (
       $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
     )
     RETURNING id`,
    [
      input.runId,
      input.facultyId,
      input.snapshotDate,
      input.status,
      row.instructorPernr || null,
      row.instructorName || null,
      input.recipientEmail?.trim() || null,
      input.sourceInstructorEmail?.trim() || null,
      row.courseId || null,
      row.courseCode || null,
      row.courseName || null,
      row.departmentName || null,
      row.sectionCode || "",
      row.eventPackageId || "",
      row.studentsEnrolled,
      row.classesHeld,
      row.attendancePosted,
      row.missingEntries,
      input.emailSubject?.trim() || null,
      input.bodyHtml ?? null,
      input.errorMessage?.trim() || null,
      input.dryRun ?? false,
      input.smtpOverrideTo?.trim() || null,
      input.ccRecipients?.length
        ? input.ccRecipients.join(", ")
        : null,
      input.sentAt ?? null,
    ]
  );
  return Number(res.rows[0]?.id);
}
