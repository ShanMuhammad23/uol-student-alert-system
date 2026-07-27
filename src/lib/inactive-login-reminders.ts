import {
  buildInactiveLoginReminderEmailHtml,
  buildInactiveLoginReminderEmailSubject,
  type PendingAction,
} from "@/helpers/inactive-login-reminder-email-template";
import { pool } from "@/lib/db";
import {
  createInactiveLoginReminderRun,
  finalizeInactiveLoginReminderRun,
  insertInactiveLoginReminderEmail,
} from "@/lib/db/inactive-login-reminder-logs";
import {
  getIntervenedStudentsOpenOutOfAlertCounts,
} from "@/lib/db/intervention-open-out-of-alert";
import {
  getAlertedWithoutInterventionCountForRoleScopeFromDb,
  getInterventionStatsForRoleScopeFromDb,
} from "@/lib/db/interventions";
import { getWellbeingHeadDashboardData } from "@/lib/db/wellbeing-head-dashboard";
import type { InactiveLoginReminderRow } from "@/lib/inactive-login-reminder-types";
import { sendSmtpMail } from "@/lib/smtp";

export type { InactiveLoginReminderRow } from "@/lib/inactive-login-reminder-types";

export type RunInactiveLoginRemindersOptions = {
  facultyId?: string;
  inactiveDays?: number;
  dryRun?: boolean;
};

export type RunInactiveLoginRemindersResult = {
  runId: number | null;
  facultyId: string | null;
  inactiveDays: number;
  candidates: number;
  sent: number;
  skippedNoEmail: number;
  skippedDuplicate: number;
  failed: number;
  dryRun: boolean;
  sentDetails: Array<{
    to: string;
    subject: string;
    staffId: string;
    staffPernr: string;
    lastLoginDisplay: string;
    logId: number;
  }>;
};

const DEFAULT_INACTIVE_DAYS = 7;
/** Pause between SMTP sends to reduce bounce/rate-limit risk. */
const INTER_EMAIL_DELAY_MS = 5000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatLastLoginDisplay(
  value: Date | null,
  neverLoggedIn: boolean
): string {
  if (neverLoggedIn || !value || Number.isNaN(value.getTime())) return "Never";
  return value.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function queryInactiveLoginReminderCandidates(options?: {
  facultyId?: string;
  inactiveDays?: number;
  limit?: number;
}): Promise<InactiveLoginReminderRow[]> {
  if (!pool) return [];

  const inactiveDays = options?.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
  const facultyId = options?.facultyId?.trim() || null;
  const limit =
    options?.limit != null && options.limit > 0
      ? Math.trunc(options.limit)
      : null;

  const params: unknown[] = [inactiveDays];
  let facultySql = "";
  if (facultyId) {
    params.push(facultyId);
    facultySql = `AND s.faculty_id = $${params.length}`;
  }

  let limitSql = "";
  if (limit != null) {
    params.push(limit);
    limitSql = `LIMIT $${params.length}`;
  }

  const res = await pool.query<{
    id: string;
    pernr: string | null;
    name: string | null;
    email: string | null;
    faculty_id: string | null;
    login_count: string | number | null;
    last_login_at: Date | null;
    role: string | null;
    pseudo_role: string | null;
    actual_role: string | null;
    department_ids: string[] | null;
  }>(
    `SELECT
       s.id,
       s.pernr,
       s.name,
       s.email,
       s.faculty_id,
       COALESCE(s.login_count, 0) AS login_count,
       s.last_login_at,
       s.role,
       s.pseudo_role,
       s.actual_role,
       COALESCE(
         ARRAY(SELECT sd.department_id FROM staff_departments sd WHERE sd.staff_id = s.id),
         '{}'::text[]
       ) AS department_ids
     FROM staff s
     WHERE s.password_hash IS NOT NULL
       AND NULLIF(TRIM(s.email), '') IS NOT NULL
       AND (
         -- Never logged in (0 count and/or no last login timestamp)
         COALESCE(s.login_count, 0) = 0
         OR s.last_login_at IS NULL
         -- Logged in before, but inactive for N days
         OR s.last_login_at < NOW() - ($1::int * INTERVAL '1 day')
       )
       ${facultySql}
     ORDER BY s.last_login_at ASC NULLS FIRST, s.name ASC
     ${limitSql}`,
    params
  );

  return res.rows.map((row) => {
    const loginCount = Number(row.login_count ?? 0);
    const lastLoginAt = row.last_login_at
      ? new Date(row.last_login_at)
      : null;
    const neverLoggedIn =
      loginCount <= 0 ||
      lastLoginAt == null ||
      Number.isNaN(lastLoginAt.getTime());
    return {
      staffId: String(row.id ?? "").trim(),
      staffPernr: String(row.pernr ?? "").trim(),
      staffName: String(row.name ?? "").trim() || "Colleague",
      staffEmail: String(row.email ?? "").trim(),
      facultyId: row.faculty_id ? String(row.faculty_id).trim() : null,
      loginCount: Number.isFinite(loginCount) ? loginCount : 0,
      lastLoginAt: neverLoggedIn ? null : lastLoginAt,
      lastLoginDisplay: formatLastLoginDisplay(lastLoginAt, neverLoggedIn),
      neverLoggedIn,
      role: row.role ? String(row.role).trim() : null,
      pseudoRole: row.pseudo_role ? String(row.pseudo_role).trim() : null,
      actualRole: row.actual_role ? String(row.actual_role).trim() : null,
      departmentIds: Array.isArray(row.department_ids)
        ? row.department_ids.filter(Boolean).map(String)
        : [],
    };
  });
}

/**
 * Resolve the effective "acting" role for a staff member.
 * Admin/coordinator staff carry pseudo_role of dean/hod — we honour that.
 */
function resolveActingRole(row: InactiveLoginReminderRow): string | null {
  return row.pseudoRole || row.role || null;
}

function isSuperadmin(row: InactiveLoginReminderRow): boolean {
  const directRole = String(row.role ?? "")
    .trim()
    .toLowerCase();
  const actingRole = String(resolveActingRole(row) ?? "")
    .trim()
    .toLowerCase();
  return directRole === "superadmin" || actingRole === "superadmin";
}

/**
 * Fetch role-scoped pending action counts for a single staff member.
 * Returns only items with count > 0 so the email stays concise.
 */
export async function fetchPendingActionsForStaff(
  row: InactiveLoginReminderRow
): Promise<PendingAction[]> {
  const actingRole = resolveActingRole(row);
  const actions: PendingAction[] = [];

  try {
    if (
      actingRole === "dean" ||
      actingRole === "hod" ||
      actingRole === "instructor" ||
      actingRole === "teacher"
    ) {
      const scopeRole =
        actingRole === "dean"
          ? "dean"
          : actingRole === "hod"
          ? "hod"
          : "teacher";

      const interventionScope =
        scopeRole === "dean"
          ? {
              role: "dean" as const,
              interventionType: "all" as const,
              facultyId: row.facultyId,
            }
          : scopeRole === "hod"
          ? {
              role: "hod" as const,
              interventionType: "all" as const,
              departmentIds: row.departmentIds,
            }
          : {
              role: "teacher" as const,
              interventionType: "all" as const,
              instructorIds: row.staffPernr ? [row.staffPernr] : [],
              staffId: row.staffId || null,
            };

      const [stats, noIntervention] = await Promise.all([
        getInterventionStatsForRoleScopeFromDb(interventionScope),
        getAlertedWithoutInterventionCountForRoleScopeFromDb(interventionScope),
      ]);

      const totalAlerted =
        (stats.notStarted ?? 0) +
        (stats.initiated ?? 0) +
        (stats.inProgress ?? 0) +
        (stats.referred ?? 0);

      if (totalAlerted > 0) {
        actions.push({ label: "Students currently in alert", count: totalAlerted });
      }
      if (noIntervention > 0) {
        actions.push({
          label: "Alerted students with no intervention started",
          count: noIntervention,
        });
      }
      if ((stats.initiated ?? 0) + (stats.inProgress ?? 0) > 0) {
        actions.push({
          label: "Interventions in progress needing attention",
          count: (stats.initiated ?? 0) + (stats.inProgress ?? 0),
        });
      }
      if ((stats.referred ?? 0) > 0) {
        actions.push({ label: "Interventions referred to wellbeing", count: stats.referred });
      }

      const openOutOfAlertScope =
        scopeRole === "dean"
          ? { role: "dean" as const, facultyId: row.facultyId ?? "" }
          : scopeRole === "hod"
          ? { role: "hod" as const, departmentIds: row.departmentIds }
          : { role: "instructor" as const, pernr: row.staffPernr };

      const outOfAlert = await getIntervenedStudentsOpenOutOfAlertCounts(
        openOutOfAlertScope
      );
      if (outOfAlert.openOutOfAlertCount > 0) {
        actions.push({
          label: "Students out of alert but intervention still open",
          count: outOfAlert.openOutOfAlertCount,
        });
      }
    } else if (
      actingRole === "wellbeing" ||
      actingRole === "wellbeing-head" ||
      actingRole === "wellbeing-counseller"
    ) {
      const data = await getWellbeingHeadDashboardData();
      const open = data.totalRecords?.totals?.openCases ?? 0;
      const referred = data.totalRecords?.totals?.referred ?? 0;
      if (open > 0) {
        actions.push({ label: "Open wellbeing cases", count: open });
      }
      if (referred > 0) {
        actions.push({ label: "Referred cases awaiting action", count: referred });
      }
    }
  } catch (err) {
    console.error(
      "[inactive-login-reminders] fetchPendingActionsForStaff failed for",
      row.staffId,
      err
    );
  }

  return actions;
}

export async function runInactiveLoginReminders(
  options?: RunInactiveLoginRemindersOptions
): Promise<RunInactiveLoginRemindersResult> {
  if (!pool) throw new Error("DATABASE_URL is not configured");

  const facultyId = options?.facultyId?.trim() || null;
  const inactiveDays = options?.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
  const dryRun = options?.dryRun ?? false;
  const overrideTo = String(
    process.env.INACTIVE_LOGIN_OVERRIDE_TO ?? ""
  ).trim();

  const allCandidates = await queryInactiveLoginReminderCandidates({
    facultyId: facultyId ?? undefined,
    inactiveDays,
  });

  let runId: number | null = null;
  try {
    runId = await createInactiveLoginReminderRun({
      facultyId,
      inactiveDays,
      dryRun,
    });
  } catch (err) {
    console.error("[inactive-login-reminders] Failed to create run log:", err);
  }

  const sentDetails: RunInactiveLoginRemindersResult["sentDetails"] = [];
  const sentStaffKeys = new Set<string>();
  let sent = 0;
  let skippedNoEmail = 0;
  let skippedDuplicate = 0;
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
      | "skipped_duplicate"
      | "failed",
    row: InactiveLoginReminderRow,
    extra: {
      recipientEmail?: string | null;
      emailSubject?: string | null;
      bodyHtml?: string | null;
      errorMessage?: string | null;
      sentAt?: Date | null;
    } = {}
  ): Promise<number | null> => {
    if (runId == null) return null;
    try {
      return await insertInactiveLoginReminderEmail({
        runId,
        facultyId: facultyId ?? row.facultyId,
        status,
        row,
        recipientEmail: extra.recipientEmail ?? null,
        sourceEmail: row.staffEmail,
        emailSubject: extra.emailSubject ?? null,
        bodyHtml: extra.bodyHtml ?? null,
        errorMessage: extra.errorMessage ?? null,
        dryRun,
        smtpOverrideTo: overrideTo || null,
        sentAt: extra.sentAt ?? null,
      });
    } catch (err) {
      console.error(
        "[inactive-login-reminders] Failed to insert email log:",
        err
      );
      return null;
    }
  };

  try {
    for (const row of allCandidates) {
      if (isSuperadmin(row)) {
        continue;
      }

      const staffKey =
        row.staffId.trim().toLowerCase() ||
        row.staffEmail.trim().toLowerCase();
      if (staffKey && sentStaffKeys.has(staffKey)) {
        skippedDuplicate += 1;
        await logRow("skipped_duplicate", row);
        continue;
      }

      const to = overrideTo || row.staffEmail;
      if (!isValidEmail(to)) {
        skippedNoEmail += 1;
        await logRow("skipped_no_email", row, {
          recipientEmail: row.staffEmail || null,
        });
        continue;
      }

      const rawPortalUrl =
        process.env.INACTIVE_LOGIN_PORTAL_URL?.trim() ||
        process.env.APP_BASE_URL?.trim() ||
        "";
      // Never use localhost/loopback addresses in emails — fall back to the
      // hardcoded production URL defined in the email template helper.
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(rawPortalUrl);
      const portalUrl = rawPortalUrl && !isLocalhost ? rawPortalUrl : undefined;
      const resolvedPortalUrl = portalUrl
        ? portalUrl.includes("/auth/sign-in")
          ? portalUrl
          : `${portalUrl.replace(/\/$/, "")}/auth/sign-in`
        : undefined;

      const pendingActions = await fetchPendingActionsForStaff(row);
      if (pendingActions.length <= 0) {
        continue;
      }
      const subject = buildInactiveLoginReminderEmailSubject(pendingActions.length > 0);
      const html = buildInactiveLoginReminderEmailHtml({
        userName: row.staffName,
        lastLoginAt: row.lastLoginDisplay,
        neverLoggedIn: row.neverLoggedIn,
        portalUrl: resolvedPortalUrl,
        pendingActions,
      });

      if (dryRun) {
        const logId = await logRow("dry_run", row, {
          recipientEmail: to,
          emailSubject: subject,
          bodyHtml: html,
        });
        if (staffKey) sentStaffKeys.add(staffKey);
        sent += 1;
        sentDetails.push({
          to,
          subject,
          staffId: row.staffId,
          staffPernr: row.staffPernr,
          lastLoginDisplay: row.lastLoginDisplay,
          logId: logId ?? 0,
        });
        continue;
      }

      try {
        if (sent > 0) {
          await sleep(INTER_EMAIL_DELAY_MS);
        }
        await sendSmtpMail({
          to,
          subject,
          html,
          replyTo: process.env.INACTIVE_LOGIN_REPLY_TO?.trim() || undefined,
        });
        const sentAt = new Date();
        const logId = await logRow("sent", row, {
          recipientEmail: to,
          emailSubject: subject,
          bodyHtml: html,
          sentAt,
        });
        if (staffKey) sentStaffKeys.add(staffKey);
        sent += 1;
        sentDetails.push({
          to,
          subject,
          staffId: row.staffId,
          staffPernr: row.staffPernr,
          lastLoginDisplay: row.lastLoginDisplay,
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
        await finalizeInactiveLoginReminderRun({
          runId,
          candidatesCount: allCandidates.length,
          sentCount: sent,
          skippedNoEmail,
          skippedDuplicate,
          failedCount: failed,
          status: runFailed ? "failed" : "success",
          errorMessage: runErrorMessage,
        });
      } catch (err) {
        console.error(
          "[inactive-login-reminders] Failed to finalize run log:",
          err
        );
      }
    }
  }

  return {
    runId,
    facultyId,
    inactiveDays,
    candidates: allCandidates.length,
    sent,
    skippedNoEmail,
    skippedDuplicate,
    failed,
    dryRun,
    sentDetails,
  };
}
