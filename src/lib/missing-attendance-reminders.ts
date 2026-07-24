import {
  buildMissingAttendanceEmailHtml,
  buildMissingAttendanceEmailSubject,
} from "@/helpers/missing-attendance-email-template";
import { calculateMissingAttendance } from "@/lib/attendance-missing";
import { pool } from "@/lib/db";
import { loadMissingAttendanceReminderCcLookup } from "@/lib/db/missing-attendance-reminder-cc";
import {
  createMissingAttendanceReminderRun,
  finalizeMissingAttendanceReminderRun,
  insertMissingAttendanceReminderEmail,
} from "@/lib/db/missing-attendance-reminder-logs";
import type { MissingAttendanceReminderRow } from "@/lib/missing-attendance-reminder-types";
import { sendSmtpMail } from "@/lib/smtp";

export type { MissingAttendanceReminderRow } from "@/lib/missing-attendance-reminder-types";

export type RunMissingAttendanceRemindersOptions = {
  /** When omitted/empty, reminders are sent for every faculty with enrollment on the snapshot date. */
  facultyId?: string;
  snapshotDate?: string;
  minMissingEntries?: number;
  dryRun?: boolean;
};

export type RunMissingAttendanceRemindersResult = {
  runIds: number[];
  snapshotDate: string;
  /** Null when the run covered all faculties. */
  facultyId: string | null;
  facultyIds: string[];
  candidates: number;
  sent: number;
  skippedNoEmail: number;
  skippedDuplicateInstructor: number;
  failed: number;
  dryRun: boolean;
  sentDetails: Array<{
    to: string;
    subject: string;
    instructorPernr: string;
    courseCode: string;
    missingEntries: number;
    facultyId: string;
    logId: number;
  }>;
};

const DEFAULT_MIN_MISSING = 4;
/** Pause between SMTP sends to reduce bounce/rate-limit risk. */
const INTER_EMAIL_DELAY_MS = 5000;

function normalizeCourseCode(courseId: string): string {
  const raw = String(courseId ?? "").trim();
  if (!raw) return "";
  const [code] = raw.split("|");
  return code.trim() || raw;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function listFacultyIdsForSnapshot(snapshotDate: string): Promise<string[]> {
  if (!pool) return [];
  const res = await pool.query<{ faculty_id: string }>(
    `SELECT DISTINCT TRIM(ec.faculty_id) AS faculty_id
     FROM student_enrollment_current ec
     WHERE ec.is_active = TRUE
       AND ec.snapshot_at::date = $1::date
       AND ec.faculty_id IS NOT NULL
       AND TRIM(ec.faculty_id) <> ''
     ORDER BY 1`,
    [snapshotDate]
  );
  return res.rows
    .map((row) => String(row.faculty_id ?? "").trim())
    .filter(Boolean);
}

export async function queryMissingAttendanceReminderCandidates(options?: {
  facultyId: string;
  snapshotDate?: string;
  minMissingEntries?: number;
  limit?: number;
}): Promise<MissingAttendanceReminderRow[]> {
  if (!pool) return [];

  const facultyId = String(options?.facultyId ?? "").trim();
  if (!facultyId) return [];

  const snapshotDate =
    options?.snapshotDate ?? new Date().toISOString().slice(0, 10);
  const minMissing = options?.minMissingEntries ?? DEFAULT_MIN_MISSING;
  const limit =
    options?.limit != null && options.limit > 0
      ? Math.trunc(options.limit)
      : null;
  const params: unknown[] = [facultyId, snapshotDate, minMissing];
  const limitSql = limit != null ? `LIMIT $${params.length + 1}` : "";
  if (limit != null) params.push(limit);

  const res = await pool.query<{
    instructor_pernr: string;
    instructor_name: string | null;
    instructor_email: string | null;
    staff_email: string | null;
    course_id: string;
    course_title: string | null;
    department_id: string | null;
    department_name: string | null;
    section_code: string;
    event_package_id: string;
    students_enrolled: string | number;
    classes_held: string | number;
    attendance_posted: string | number;
  }>(
    `WITH class_rows AS (
       SELECT
         TRIM(ec.instructor_pernr) AS instructor_pernr,
         MAX(NULLIF(TRIM(ec.instructor_name), '')) AS instructor_name,
         MAX(NULLIF(TRIM(ec.instructor_email), '')) AS instructor_email,
         MAX(NULLIF(TRIM(s.email), '')) AS staff_email,
         ec.course_id,
         MAX(NULLIF(TRIM(c.title), '')) AS course_title,
         ec.department_id,
         MAX(NULLIF(TRIM(d.name), '')) AS department_name,
         ec.section_code,
         ec.event_package_id,
         COUNT(DISTINCT ec.sap_id)::int AS students_enrolled,
         COALESCE(MAX(a.total_classes_held), 0)::int AS classes_held,
         COALESCE(MAX(a.attendance_marked_classes), 0)::int AS attendance_posted
       FROM student_enrollment_current ec
       LEFT JOIN student_alert_current a
         ON a.sap_id = ec.sap_id
        AND a.course_id = ec.course_id
        AND COALESCE(TRIM(a.section_code), '') = COALESCE(TRIM(ec.section_code), '')
        AND COALESCE(TRIM(a.event_package_id), '') = COALESCE(TRIM(ec.event_package_id), '')
       LEFT JOIN courses c ON c.id = ec.course_id
       LEFT JOIN departments d ON d.id = ec.department_id
       LEFT JOIN staff s ON TRIM(s.pernr) = TRIM(ec.instructor_pernr)
       WHERE ec.is_active = TRUE
         AND ec.faculty_id = $1
         AND ec.snapshot_at::date = $2::date
         AND ec.instructor_pernr IS NOT NULL
         AND TRIM(ec.instructor_pernr) <> ''
       GROUP BY
         TRIM(ec.instructor_pernr),
         ec.course_id,
         ec.department_id,
         ec.section_code,
         ec.event_package_id
     )
     SELECT
       instructor_pernr,
       instructor_name,
       instructor_email,
       staff_email,
       course_id,
       course_title,
       department_id,
       department_name,
       section_code,
       event_package_id,
       students_enrolled,
       classes_held,
       attendance_posted
     FROM class_rows
     WHERE (classes_held - attendance_posted) >= $3
     ORDER BY (classes_held - attendance_posted) DESC, instructor_name, course_id
     ${limitSql}`,
    params
  );

  return res.rows.map((row) => {
    const classesHeld = Number(row.classes_held ?? 0);
    const attendancePosted = Number(row.attendance_posted ?? 0);
    const missingEntries = calculateMissingAttendance(
      classesHeld,
      attendancePosted
    );
    const courseId = String(row.course_id ?? "").trim();
    const courseCode = normalizeCourseCode(courseId);
    const recipient =
      String(row.instructor_email ?? "").trim() ||
      String(row.staff_email ?? "").trim();

    return {
      instructorPernr: row.instructor_pernr,
      instructorName:
        String(row.instructor_name ?? "").trim() || row.instructor_pernr,
      instructorEmail: recipient,
      courseId,
      courseName:
        String(row.course_title ?? "").trim() || courseCode || courseId,
      courseCode: courseCode || courseId,
      departmentId: String(row.department_id ?? "").trim(),
      departmentName: String(row.department_name ?? "").trim() || "—",
      sectionCode: String(row.section_code ?? "").trim(),
      eventPackageId: String(row.event_package_id ?? "").trim(),
      studentsEnrolled: Number(row.students_enrolled ?? 0),
      classesHeld,
      attendancePosted,
      missingEntries,
    };
  });
}

async function runMissingAttendanceRemindersForFaculty(input: {
  facultyId: string;
  snapshotDate: string;
  minMissingEntries: number;
  dryRun: boolean;
  overrideTo: string;
  /** Carry SMTP delay state across faculties in an all-faculty run. */
  emailsAlreadySent: { count: number };
}): Promise<Omit<RunMissingAttendanceRemindersResult, "facultyId" | "facultyIds" | "runIds"> & {
  runId: number | null;
  facultyId: string;
}> {
  const {
    facultyId,
    snapshotDate,
    minMissingEntries: minMissing,
    dryRun,
    overrideTo,
    emailsAlreadySent,
  } = input;

  const allCandidates = await queryMissingAttendanceReminderCandidates({
    facultyId,
    snapshotDate,
    minMissingEntries: minMissing,
  });

  const ccLookup = await loadMissingAttendanceReminderCcLookup(facultyId);

  let runId: number | null = null;
  try {
    runId = await createMissingAttendanceReminderRun({
      facultyId,
      snapshotDate,
      minMissingEntries: minMissing,
      dryRun,
    });
  } catch (err) {
    console.error(
      `[missing-attendance-reminders] Failed to create run log for faculty ${facultyId}:`,
      err
    );
  }

  const sentDetails: RunMissingAttendanceRemindersResult["sentDetails"] = [];
  const sentInstructorKeys = new Set<string>();
  let sent = 0;
  let skippedNoEmail = 0;
  let skippedDuplicateInstructor = 0;
  let failed = 0;
  let runFailed = false;
  let runErrorMessage: string | null = null;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const logRow = async (
    status:
      | "sent"
      | "dry_run"
      | "skipped_no_email"
      | "skipped_duplicate_instructor"
      | "failed",
    row: MissingAttendanceReminderRow,
    extra: {
      recipientEmail?: string | null;
      emailSubject?: string | null;
      bodyHtml?: string | null;
      errorMessage?: string | null;
      ccRecipients?: string[] | null;
      sentAt?: Date | null;
    } = {}
  ): Promise<number | null> => {
    if (runId == null) return null;
    try {
      return await insertMissingAttendanceReminderEmail({
        runId,
        facultyId,
        snapshotDate,
        status,
        row,
        recipientEmail: extra.recipientEmail ?? null,
        sourceInstructorEmail: row.instructorEmail,
        emailSubject: extra.emailSubject ?? null,
        bodyHtml: extra.bodyHtml ?? null,
        errorMessage: extra.errorMessage ?? null,
        dryRun,
        smtpOverrideTo: overrideTo || null,
        ccRecipients: extra.ccRecipients ?? null,
        sentAt: extra.sentAt ?? null,
      });
    } catch (err) {
      console.error(
        "[missing-attendance-reminders] Failed to insert email log:",
        err
      );
      return null;
    }
  };

  try {
    for (const row of allCandidates) {
      const instructorKey =
        row.instructorPernr.trim().toLowerCase() ||
        row.instructorEmail.trim().toLowerCase();
      if (instructorKey && sentInstructorKeys.has(instructorKey)) {
        skippedDuplicateInstructor += 1;
        await logRow("skipped_duplicate_instructor", row);
        continue;
      }

      const to = overrideTo || row.instructorEmail;
      if (!isValidEmail(to)) {
        skippedNoEmail += 1;
        await logRow("skipped_no_email", row, {
          recipientEmail: row.instructorEmail || null,
        });
        continue;
      }

      const subject = buildMissingAttendanceEmailSubject(row.courseCode);
      const cc = ccLookup.resolveCc(row.departmentId, to);
      const html = buildMissingAttendanceEmailHtml({
        instructorName: row.instructorName,
        courseName: row.courseName,
        courseCode: row.courseCode,
        department: row.departmentName,
        studentsEnrolled: row.studentsEnrolled,
        classesHeld: row.classesHeld,
        attendancePosted: row.attendancePosted,
        missingEntries: row.missingEntries,
      });

      if (dryRun) {
        const logId = await logRow("dry_run", row, {
          recipientEmail: to,
          emailSubject: subject,
          bodyHtml: html,
          ccRecipients: cc,
        });
        if (instructorKey) sentInstructorKeys.add(instructorKey);
        sent += 1;
        sentDetails.push({
          to,
          subject,
          instructorPernr: row.instructorPernr,
          courseCode: row.courseCode,
          missingEntries: row.missingEntries,
          facultyId,
          logId: logId ?? 0,
        });
        continue;
      }

      try {
        if (emailsAlreadySent.count > 0 || sent > 0) {
          await sleep(INTER_EMAIL_DELAY_MS);
        }
        await sendSmtpMail({
          to,
          subject,
          html,
          cc: cc.length ? cc : undefined,
          replyTo: process.env.MISSING_ATTENDANCE_REPLY_TO?.trim() || undefined,
        });
        const sentAt = new Date();
        const logId = await logRow("sent", row, {
          recipientEmail: to,
          emailSubject: subject,
          bodyHtml: html,
          ccRecipients: cc,
          sentAt,
        });
        if (instructorKey) sentInstructorKeys.add(instructorKey);
        sent += 1;
        emailsAlreadySent.count += 1;
        sentDetails.push({
          to,
          subject,
          instructorPernr: row.instructorPernr,
          courseCode: row.courseCode,
          missingEntries: row.missingEntries,
          facultyId,
          logId: logId ?? 0,
        });
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error ? err.message : "Failed to send reminder email";
        await logRow("failed", row, {
          recipientEmail: to,
          emailSubject: subject,
          bodyHtml: html,
          ccRecipients: cc,
          errorMessage: message,
        });
      }
    }
  } catch (err) {
    runFailed = true;
    runErrorMessage =
      err instanceof Error ? err.message : "Reminder run failed unexpectedly";
    throw err;
  } finally {
    if (runId != null) {
      try {
        await finalizeMissingAttendanceReminderRun({
          runId,
          candidatesCount: allCandidates.length,
          sentCount: sent,
          skippedNoEmail,
          skippedDuplicate: skippedDuplicateInstructor,
          failedCount: failed,
          status: runFailed ? "failed" : "success",
          errorMessage: runErrorMessage,
        });
      } catch (err) {
        console.error(
          `[missing-attendance-reminders] Failed to finalize run log for faculty ${facultyId}:`,
          err
        );
      }
    }
  }

  return {
    runId,
    snapshotDate,
    facultyId,
    candidates: allCandidates.length,
    sent,
    skippedNoEmail,
    skippedDuplicateInstructor,
    failed,
    dryRun,
    sentDetails,
  };
}

export async function runMissingAttendanceReminders(
  options?: RunMissingAttendanceRemindersOptions
): Promise<RunMissingAttendanceRemindersResult> {
  if (!pool) throw new Error("DATABASE_URL is not configured");

  const requestedFacultyId = options?.facultyId?.trim() || null;
  const snapshotDate =
    options?.snapshotDate ?? new Date().toISOString().slice(0, 10);
  const minMissing = options?.minMissingEntries ?? DEFAULT_MIN_MISSING;
  const dryRun = options?.dryRun ?? false;
  const overrideTo = String(
    process.env.MISSING_ATTENDANCE_OVERRIDE_TO ?? ""
  ).trim();

  const facultyIds = requestedFacultyId
    ? [requestedFacultyId]
    : await listFacultyIdsForSnapshot(snapshotDate);

  if (!facultyIds.length) {
    return {
      runIds: [],
      snapshotDate,
      facultyId: requestedFacultyId,
      facultyIds: [],
      candidates: 0,
      sent: 0,
      skippedNoEmail: 0,
      skippedDuplicateInstructor: 0,
      failed: 0,
      dryRun,
      sentDetails: [],
    };
  }

  const emailsAlreadySent = { count: 0 };
  const runIds: number[] = [];
  const sentDetails: RunMissingAttendanceRemindersResult["sentDetails"] = [];
  let candidates = 0;
  let sent = 0;
  let skippedNoEmail = 0;
  let skippedDuplicateInstructor = 0;
  let failed = 0;

  for (const facultyId of facultyIds) {
    const result = await runMissingAttendanceRemindersForFaculty({
      facultyId,
      snapshotDate,
      minMissingEntries: minMissing,
      dryRun,
      overrideTo,
      emailsAlreadySent,
    });
    if (result.runId != null) runIds.push(result.runId);
    candidates += result.candidates;
    sent += result.sent;
    skippedNoEmail += result.skippedNoEmail;
    skippedDuplicateInstructor += result.skippedDuplicateInstructor;
    failed += result.failed;
    sentDetails.push(...result.sentDetails);
  }

  return {
    runIds,
    snapshotDate,
    facultyId: requestedFacultyId,
    facultyIds,
    candidates,
    sent,
    skippedNoEmail,
    skippedDuplicateInstructor,
    failed,
    dryRun,
    sentDetails,
  };
}
