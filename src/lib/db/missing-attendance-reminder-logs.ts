import { pool } from "@/lib/db";
import type { MissingAttendanceReminderRow } from "@/lib/missing-attendance-reminder-types";
import type {
  MissingAttendanceReminderEmailLog,
  MissingAttendanceReminderRunLog,
} from "@/lib/missing-attendance-reminder-log-types";

export type { MissingAttendanceReminderEmailLog, MissingAttendanceReminderRunLog };
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

export async function listMissingAttendanceReminderRuns(
  limit = 50
): Promise<MissingAttendanceReminderRunLog[]> {
  if (!pool) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  const res = await pool.query<{
    id: string;
    faculty_id: string;
    snapshot_date: string;
    min_missing_entries: number;
    dry_run: boolean;
    candidates_count: number;
    sent_count: number;
    skipped_no_email: number;
    skipped_duplicate: number;
    failed_count: number;
    status: MissingAttendanceReminderRunLog["status"];
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
  }>(
    `SELECT
       id,
       faculty_id,
       snapshot_date::text AS snapshot_date,
       min_missing_entries,
       dry_run,
       candidates_count,
       sent_count,
       skipped_no_email,
       skipped_duplicate,
       failed_count,
       status,
       error_message,
       started_at::text AS started_at,
       completed_at::text AS completed_at
     FROM missing_attendance_reminder_runs
     ORDER BY started_at DESC, id DESC
     LIMIT $1`,
    [safeLimit]
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    facultyId: row.faculty_id,
    snapshotDate: row.snapshot_date,
    minMissingEntries: Number(row.min_missing_entries ?? 0),
    dryRun: Boolean(row.dry_run),
    candidatesCount: Number(row.candidates_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    skippedNoEmail: Number(row.skipped_no_email ?? 0),
    skippedDuplicate: Number(row.skipped_duplicate ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    status: row.status,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export async function listMissingAttendanceReminderEmailsForRun(
  runId: number,
  limit = 500
): Promise<MissingAttendanceReminderEmailLog[]> {
  if (!pool) return [];
  const safeRunId = Math.trunc(runId);
  if (!Number.isFinite(safeRunId) || safeRunId <= 0) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 500, 1), 2000);

  const res = await pool.query<{
    id: string;
    run_id: string;
    status: MissingAttendanceReminderEmailLog["status"];
    instructor_pernr: string | null;
    instructor_name: string | null;
    recipient_email: string | null;
    course_code: string | null;
    course_name: string | null;
    department_name: string | null;
    missing_entries: number;
    email_subject: string | null;
    error_message: string | null;
    cc_recipients: string | null;
    sent_at: string | null;
    created_at: string;
  }>(
    `SELECT
       id,
       run_id,
       status,
       instructor_pernr,
       instructor_name,
       recipient_email,
       course_code,
       course_name,
       department_name,
       missing_entries,
       email_subject,
       error_message,
       cc_recipients,
       sent_at::text AS sent_at,
       created_at::text AS created_at
     FROM missing_attendance_reminder_emails
     WHERE run_id = $1
     ORDER BY created_at ASC, id ASC
     LIMIT $2`,
    [safeRunId, safeLimit]
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    runId: Number(row.run_id),
    status: row.status,
    instructorPernr: row.instructor_pernr,
    instructorName: row.instructor_name,
    recipientEmail: row.recipient_email,
    courseCode: row.course_code,
    courseName: row.course_name,
    departmentName: row.department_name,
    missingEntries: Number(row.missing_entries ?? 0),
    emailSubject: row.email_subject,
    errorMessage: row.error_message,
    ccRecipients: row.cc_recipients,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
}
