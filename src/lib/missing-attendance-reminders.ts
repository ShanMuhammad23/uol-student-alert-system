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
import {
  getCurrentAcademicTerm,
} from "@/lib/academic-term";
import { sendSmtpMail } from "@/lib/smtp";

export type { MissingAttendanceReminderRow } from "@/lib/missing-attendance-reminder-types";
export { getCurrentAcademicTerm, type AcademicTerm } from "@/lib/academic-term";

export type MissingAttendanceTermBreakdown = {
  termYear: string;
  termSession: string;
  isCurrentTerm: boolean;
  classCount: number;
  candidateClassCount: number;
  candidateInstructorCount: number;
};

export type MissingAttendanceReminderSanityCheck = {
  termYear: string;
  termSession: string;
  snapshotDate: string | null;
  ok: boolean;
  activeClassCount: number;
  currentTermClassCount: number;
  previousTermClassCount: number;
  currentTermCandidateInstructors: number;
  previousTermCandidateInstructorsIgnored: number;
  /** Instructors whose highest-missing class is previous-term (would have been emailed about an old course). */
  instructorsWhoseTopClassWasPreviousTerm: number;
  terms: MissingAttendanceTermBreakdown[];
  warnings: string[];
};

export type RunMissingAttendanceRemindersOptions = {
  /** When omitted/empty, reminders are sent for every faculty with current-semester enrollment. */
  facultyId?: string;
  /** Optional pin to one ETL day. Omitted = all active current-semester rows. */
  snapshotDate?: string;
  minMissingEntries?: number;
  dryRun?: boolean;
};

export type RunMissingAttendanceRemindersResult = {
  runIds: number[];
  snapshotDate: string;
  termYear: string;
  termSession: string;
  /** Null when the run covered all faculties. */
  facultyId: string | null;
  facultyIds: string[];
  candidates: number;
  sent: number;
  skippedNoEmail: number;
  skippedDuplicateInstructor: number;
  failed: number;
  dryRun: boolean;
  sanityCheck: MissingAttendanceReminderSanityCheck;
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

function currentTermSql(yearParam: number, sessionParam: number): string {
  return `TRIM(ec.term_year) = $${yearParam}
       AND LPAD(TRIM(COALESCE(ec.term_session, '')), 3, '0') = $${sessionParam}`;
}

async function listFacultyIdsForCurrentTerm(options: {
  termYear: string;
  termSession: string;
  snapshotDate?: string | null;
}): Promise<string[]> {
  if (!pool) return [];
  const snapshotDate = options.snapshotDate?.trim() || null;
  const res = await pool.query<{ faculty_id: string }>(
    `SELECT DISTINCT TRIM(ec.faculty_id) AS faculty_id
     FROM student_enrollment_current ec
     WHERE ec.is_active = TRUE
       AND ${currentTermSql(1, 2)}
       AND ($3::date IS NULL OR ec.snapshot_at::date = $3::date)
       AND ec.faculty_id IS NOT NULL
       AND TRIM(ec.faculty_id) <> ''
     ORDER BY 1`,
    [options.termYear, options.termSession, snapshotDate]
  );
  return res.rows
    .map((row) => String(row.faculty_id ?? "").trim())
    .filter(Boolean);
}

async function resolveSnapshotDateForLogs(options: {
  termYear: string;
  termSession: string;
  snapshotDate?: string | null;
  facultyId?: string | null;
}): Promise<string> {
  const requested = options.snapshotDate?.trim() || null;
  if (requested) return requested;
  if (!pool) return new Date().toISOString().slice(0, 10);

  const facultyId = options.facultyId?.trim() || null;
  const res = await pool.query<{ snapshot_date: string | null }>(
    `SELECT MAX(ec.snapshot_at::date)::text AS snapshot_date
     FROM student_enrollment_current ec
     WHERE ec.is_active = TRUE
       AND ${currentTermSql(1, 2)}
       AND ($3::text IS NULL OR TRIM(ec.faculty_id) = $3)`,
    [options.termYear, options.termSession, facultyId]
  );
  return (
    res.rows[0]?.snapshot_date?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10)
  );
}

export async function queryMissingAttendanceReminderCandidates(options?: {
  facultyId: string;
  snapshotDate?: string | null;
  minMissingEntries?: number;
  termYear?: string;
  termSession?: string;
  limit?: number;
}): Promise<MissingAttendanceReminderRow[]> {
  if (!pool) return [];

  const facultyId = String(options?.facultyId ?? "").trim();
  if (!facultyId) return [];

  const term = getCurrentAcademicTerm();
  const termYear = options?.termYear?.trim() || term.termYear;
  const termSession =
    options?.termSession?.trim().padStart(3, "0") || term.termSession;
  const snapshotDate = options?.snapshotDate?.trim() || null;
  const minMissing = options?.minMissingEntries ?? DEFAULT_MIN_MISSING;
  const limit =
    options?.limit != null && options.limit > 0
      ? Math.trunc(options.limit)
      : null;
  const params: unknown[] = [
    facultyId,
    snapshotDate,
    minMissing,
    termYear,
    termSession,
  ];
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
         AND ($2::date IS NULL OR ec.snapshot_at::date = $2::date)
         AND TRIM(ec.term_year) = $4
         AND LPAD(TRIM(COALESCE(ec.term_session, '')), 3, '0') = $5
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

export async function sanityCheckMissingAttendanceReminders(options?: {
  facultyId?: string | null;
  snapshotDate?: string | null;
  minMissingEntries?: number;
  termYear?: string;
  termSession?: string;
}): Promise<MissingAttendanceReminderSanityCheck> {
  const term = getCurrentAcademicTerm();
  const termYear = options?.termYear?.trim() || term.termYear;
  const termSession =
    options?.termSession?.trim().padStart(3, "0") || term.termSession;
  const snapshotDate = options?.snapshotDate?.trim() || null;
  const minMissing = options?.minMissingEntries ?? DEFAULT_MIN_MISSING;
  const facultyId = options?.facultyId?.trim() || null;
  const empty: MissingAttendanceReminderSanityCheck = {
    termYear,
    termSession,
    snapshotDate,
    ok: true,
    activeClassCount: 0,
    currentTermClassCount: 0,
    previousTermClassCount: 0,
    currentTermCandidateInstructors: 0,
    previousTermCandidateInstructorsIgnored: 0,
    instructorsWhoseTopClassWasPreviousTerm: 0,
    terms: [],
    warnings: [],
  };
  if (!pool) {
    empty.ok = false;
    empty.warnings.push("DATABASE_URL is not configured");
    return empty;
  }

  const res = await pool.query<{
    term_year: string | null;
    term_session: string | null;
    class_count: string | number;
    candidate_class_count: string | number;
    candidate_instructor_count: string | number;
    top_class_previous_term_instructors: string | number;
  }>(
    `WITH class_rows AS (
       SELECT
         TRIM(ec.instructor_pernr) AS instructor_pernr,
         TRIM(ec.term_year) AS term_year,
         LPAD(TRIM(COALESCE(ec.term_session, '')), 3, '0') AS term_session,
         (COALESCE(MAX(a.total_classes_held), 0) - COALESCE(MAX(a.attendance_marked_classes), 0))::int AS missing
       FROM student_enrollment_current ec
       LEFT JOIN student_alert_current a
         ON a.sap_id = ec.sap_id
        AND a.course_id = ec.course_id
        AND COALESCE(TRIM(a.section_code), '') = COALESCE(TRIM(ec.section_code), '')
        AND COALESCE(TRIM(a.event_package_id), '') = COALESCE(TRIM(ec.event_package_id), '')
       WHERE ec.is_active = TRUE
         AND ($1::text IS NULL OR TRIM(ec.faculty_id) = $1)
         AND ($2::date IS NULL OR ec.snapshot_at::date = $2::date)
         AND ec.instructor_pernr IS NOT NULL
         AND TRIM(ec.instructor_pernr) <> ''
       GROUP BY
         TRIM(ec.instructor_pernr),
         ec.course_id,
         ec.department_id,
         ec.section_code,
         ec.event_package_id,
         TRIM(ec.term_year),
         LPAD(TRIM(COALESCE(ec.term_session, '')), 3, '0')
     ),
     top_class AS (
       SELECT DISTINCT ON (instructor_pernr)
         instructor_pernr,
         term_year,
         term_session
       FROM class_rows
       WHERE missing >= $3
       ORDER BY instructor_pernr, missing DESC, instructor_pernr
     )
     SELECT
       c.term_year,
       c.term_session,
       COUNT(*)::int AS class_count,
       COUNT(*) FILTER (WHERE c.missing >= $3)::int AS candidate_class_count,
       COUNT(DISTINCT c.instructor_pernr) FILTER (WHERE c.missing >= $3)::int AS candidate_instructor_count,
       (
         SELECT COUNT(*)::int
         FROM top_class tc
         WHERE NOT (tc.term_year = $4 AND tc.term_session = $5)
       ) AS top_class_previous_term_instructors
     FROM class_rows c
     GROUP BY c.term_year, c.term_session
     ORDER BY c.term_year DESC NULLS LAST, c.term_session DESC NULLS LAST`,
    [facultyId, snapshotDate, minMissing, termYear, termSession]
  );

  const terms: MissingAttendanceTermBreakdown[] = res.rows.map((row) => {
    const rowYear = String(row.term_year ?? "").trim();
    const rowSession = String(row.term_session ?? "").trim().padStart(3, "0");
    return {
      termYear: rowYear,
      termSession: rowSession,
      isCurrentTerm: rowYear === termYear && rowSession === termSession,
      classCount: Number(row.class_count ?? 0),
      candidateClassCount: Number(row.candidate_class_count ?? 0),
      candidateInstructorCount: Number(row.candidate_instructor_count ?? 0),
    };
  });

  const current = terms.filter((t) => t.isCurrentTerm);
  const previous = terms.filter((t) => !t.isCurrentTerm);
  const currentTermClassCount = current.reduce((sum, t) => sum + t.classCount, 0);
  const previousTermClassCount = previous.reduce((sum, t) => sum + t.classCount, 0);
  const currentTermCandidateInstructors = current.reduce(
    (sum, t) => sum + t.candidateInstructorCount,
    0
  );
  const previousTermCandidateInstructorsIgnored = previous.reduce(
    (sum, t) => sum + t.candidateInstructorCount,
    0
  );
  const instructorsWhoseTopClassWasPreviousTerm = res.rows.reduce(
    (max, row) =>
      Math.max(max, Number(row.top_class_previous_term_instructors ?? 0)),
    0
  );

  const warnings: string[] = [];
  if (currentTermClassCount <= 0) {
    warnings.push(
      `No active current-semester classes found for ${termYear}/${termSession}.`
    );
  }
  if (previousTermClassCount > 0) {
    warnings.push(
      `Ignored ${previousTermClassCount} previous-semester class row(s) and ${previousTermCandidateInstructorsIgnored} instructor(s) who would have met the missing-attendance threshold.`
    );
  }
  if (instructorsWhoseTopClassWasPreviousTerm > 0) {
    warnings.push(
      `${instructorsWhoseTopClassWasPreviousTerm} instructor(s) would previously have been emailed about a previous-semester course (highest missing count).`
    );
  }

  return {
    termYear,
    termSession,
    snapshotDate,
    ok: currentTermClassCount > 0,
    activeClassCount: currentTermClassCount + previousTermClassCount,
    currentTermClassCount,
    previousTermClassCount,
    currentTermCandidateInstructors,
    previousTermCandidateInstructorsIgnored,
    instructorsWhoseTopClassWasPreviousTerm,
    terms,
    warnings,
  };
}

async function runMissingAttendanceRemindersForFaculty(input: {
  facultyId: string;
  snapshotDate: string;
  requestedSnapshotDate: string | null;
  minMissingEntries: number;
  termYear: string;
  termSession: string;
  dryRun: boolean;
  overrideTo: string;
  /** Carry SMTP delay state across faculties in an all-faculty run. */
  emailsAlreadySent: { count: number };
}): Promise<
  Omit<
    RunMissingAttendanceRemindersResult,
    "facultyId" | "facultyIds" | "runIds" | "termYear" | "termSession" | "sanityCheck"
  > & {
    runId: number | null;
    facultyId: string;
  }
> {
  const {
    facultyId,
    snapshotDate,
    requestedSnapshotDate,
    minMissingEntries: minMissing,
    termYear,
    termSession,
    dryRun,
    overrideTo,
    emailsAlreadySent,
  } = input;

  const allCandidates = await queryMissingAttendanceReminderCandidates({
    facultyId,
    snapshotDate: requestedSnapshotDate,
    minMissingEntries: minMissing,
    termYear,
    termSession,
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
  const requestedSnapshotDate = options?.snapshotDate?.trim() || null;
  const { termYear, termSession } = getCurrentAcademicTerm();
  const minMissing = options?.minMissingEntries ?? DEFAULT_MIN_MISSING;
  const dryRun = options?.dryRun ?? false;
  const overrideTo = String(
    process.env.MISSING_ATTENDANCE_OVERRIDE_TO ?? ""
  ).trim();

  // Cron used to pin snapshot_at::date = today. ETL usually lands the previous
  // evening, so 07:00 jobs matched zero rows. Use the date only when it actually
  // has current-semester enrollment; otherwise fall back to latest active term.
  let snapshotFilter = requestedSnapshotDate;
  if (snapshotFilter) {
    const facultiesOnRequestedDate = await listFacultyIdsForCurrentTerm({
      termYear,
      termSession,
      snapshotDate: snapshotFilter,
    });
    if (!facultiesOnRequestedDate.length) {
      console.info(
        `[missing-attendance-reminders] No current-term enrollment on snapshot ${snapshotFilter}; falling back to latest active ${termYear}/${termSession} data`
      );
      snapshotFilter = null;
    }
  }

  const snapshotDate = await resolveSnapshotDateForLogs({
    termYear,
    termSession,
    snapshotDate: snapshotFilter,
    facultyId: requestedFacultyId,
  });

  const sanityCheck = await sanityCheckMissingAttendanceReminders({
    facultyId: requestedFacultyId,
    snapshotDate: snapshotFilter,
    minMissingEntries: minMissing,
    termYear,
    termSession,
  });
  if (requestedSnapshotDate && !snapshotFilter) {
    sanityCheck.warnings.unshift(
      `Snapshot ${requestedSnapshotDate} had no current-semester rows; used latest active ${termYear}/${termSession} snapshot ${snapshotDate} instead.`
    );
  }
  if (sanityCheck.warnings.length) {
    console.info(
      "[missing-attendance-reminders] sanity check",
      JSON.stringify({
        termYear,
        termSession,
        snapshotDate: snapshotFilter,
        requestedSnapshotDate,
        warnings: sanityCheck.warnings,
        previousTermClassCount: sanityCheck.previousTermClassCount,
        previousTermCandidateInstructorsIgnored:
          sanityCheck.previousTermCandidateInstructorsIgnored,
        instructorsWhoseTopClassWasPreviousTerm:
          sanityCheck.instructorsWhoseTopClassWasPreviousTerm,
      })
    );
  }

  const facultyIds = requestedFacultyId
    ? [requestedFacultyId]
    : await listFacultyIdsForCurrentTerm({
        termYear,
        termSession,
        snapshotDate: snapshotFilter,
      });

  const emptyResult = (): RunMissingAttendanceRemindersResult => ({
    runIds: [],
    snapshotDate,
    termYear,
    termSession,
    facultyId: requestedFacultyId,
    facultyIds: [],
    candidates: 0,
    sent: 0,
    skippedNoEmail: 0,
    skippedDuplicateInstructor: 0,
    failed: 0,
    dryRun,
    sanityCheck,
    sentDetails: [],
  });

  if (!facultyIds.length) {
    return emptyResult();
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
      requestedSnapshotDate: snapshotFilter,
      minMissingEntries: minMissing,
      termYear,
      termSession,
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
    termYear,
    termSession,
    facultyId: requestedFacultyId,
    facultyIds,
    candidates,
    sent,
    skippedNoEmail,
    skippedDuplicateInstructor,
    failed,
    dryRun,
    sanityCheck,
    sentDetails,
  };
}
