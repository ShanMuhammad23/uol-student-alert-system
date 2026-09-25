import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { mapSessionToAppUser } from "@/app/(home)/dashboard/fetch";
import { pool } from "@/lib/db";
import {
  getIntervenedStudentsOpenOutOfAlertData,
  type InterventionReminderScope,
} from "@/lib/db/intervention-open-out-of-alert";
import {
  buildOpenInterventionReminderEmailHtml,
  DEFAULT_STUDENT_ALERT_BASE_URL,
  OPEN_INTERVENTION_REMINDER_EMAIL_SUBJECT,
} from "@/helpers/open-intervention-reminder-email-template";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { sendSmtpMail } from "@/lib/smtp";

export const dynamic = "force-dynamic";

function roleLabel(role?: string | null): string {
  const r = String(role ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    dean: "Dean",
    hod: "HoD",
    superadmin: "Super Admin",
    instructor: "Instructor",
    teacher: "Teacher",
    coordinator: "Coordinator",
    admin: "Admin",
    wellbeing: "Wellbeing",
    "wellbeing-head": "Wellbeing Head",
    "wellbeing-counseller": "Wellbeing Counsellor",
  };
  return labels[r] ?? (r ? r.charAt(0).toUpperCase() + r.slice(1) : "");
}

function resolveStudentUrl(sapId: string): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.INACTIVE_LOGIN_PORTAL_URL?.trim() ||
    "";
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw);
  const base = raw && !isLocalhost ? raw.replace(/\/$/, "") : DEFAULT_STUDENT_ALERT_BASE_URL;
  return `${base}/students/${encodeURIComponent(sapId)}`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );
  if (
    user.role !== "dean" &&
    user.role !== "hod" &&
    user.role !== "superadmin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    interventionId?: string;
    faculty?: string;
  } | null;
  const interventionId = String(body?.interventionId ?? "").trim();
  if (!interventionId) {
    return NextResponse.json(
      { error: "interventionId is required" },
      { status: 400 }
    );
  }
  const emulatedFacultyId = String(body?.faculty ?? "").trim();

  // The intervention must be an open, out-of-alert case inside the caller's scope.
  let scope: InterventionReminderScope | null = null;
  if (user.role === "superadmin") {
    if (emulatedFacultyId) scope = { role: "dean", facultyId: emulatedFacultyId };
  } else if (user.role === "dean" && user.faculty_id) {
    scope = { role: "dean", facultyId: user.faculty_id };
  } else if (user.role === "hod" && user.department_ids?.length) {
    scope = { role: "hod", departmentIds: user.department_ids };
  }

  if (scope) {
    const data = await getIntervenedStudentsOpenOutOfAlertData(scope);
    if (!data.rows.some((r) => r.interventionId === interventionId)) {
      return NextResponse.json(
        { error: "Intervention is outside your scope or already closed" },
        { status: 403 }
      );
    }
  }

  if (!pool) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const interventionRes = await pool.query<{
    id: string;
    student_sap_id: string;
    status: string;
    date: string | Date | null;
    course_id: string | null;
    course_title: string | null;
    student_name: string | null;
    initiator_name: string | null;
    initiator_email: string | null;
  }>(
    `SELECT
       i.id,
       i.student_sap_id,
       i.status,
       i.date,
       i.course_id,
       c.title AS course_title,
       st.full_name AS student_name,
       s.name AS initiator_name,
       s.email AS initiator_email
     FROM interventions i
     LEFT JOIN staff s ON s.id = i.staff_id
     LEFT JOIN students st ON st.sap_id = i.student_sap_id
     LEFT JOIN courses c ON c.id = i.course_id
     WHERE i.id = $1
     LIMIT 1`,
    [interventionId]
  );
  const intervention = interventionRes.rows[0];
  if (!intervention) {
    return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
  }

  const initiatorEmail = String(intervention.initiator_email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(initiatorEmail)) {
    return NextResponse.json(
      { error: "The intervention initiator has no email on record" },
      { status: 422 }
    );
  }

  // Sender details from the session: actual role, department(s), faculty.
  const senderFacultyId =
    user.role === "superadmin" && emulatedFacultyId
      ? emulatedFacultyId
      : user.faculty_id;
  let facultyName: string | null = null;
  if (senderFacultyId) {
    const facRes = await pool.query<{ name: string | null }>(
      `SELECT name FROM faculties WHERE id = $1 LIMIT 1`,
      [senderFacultyId]
    );
    facultyName = resolveFacultyNameFromIdOrName(
      senderFacultyId,
      facRes.rows[0]?.name ?? null
    );
  }
  let departmentName = "";
  if (user.department_ids?.length) {
    const deptRes = await pool.query<{ name: string | null }>(
      `SELECT name FROM departments WHERE id = ANY($1::text[]) ORDER BY name`,
      [user.department_ids]
    );
    departmentName = deptRes.rows
      .map((r) => String(r.name ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  const sapId = String(intervention.student_sap_id ?? "").trim();
  const courseId = String(intervention.course_id ?? "").trim();
  const courseTitle = String(intervention.course_title ?? "").trim();
  const courseLabel =
    courseId && courseTitle
      ? `${courseId} — ${courseTitle}`
      : courseId || courseTitle;
  const rawDate = intervention.date;
  const interventionDate =
    rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate ?? "").slice(0, 10);

  const html = buildOpenInterventionReminderEmailHtml({
    recipientName: String(intervention.initiator_name ?? "Colleague"),
    studentName: String(intervention.student_name ?? sapId),
    studentSapId: sapId,
    courseLabel,
    status: String(intervention.status ?? ""),
    interventionDate,
    studentUrl: resolveStudentUrl(sapId),
    senderName: String(user.name ?? ""),
    senderRoleLabel: roleLabel(user.actual_role ?? user.role),
    senderDepartment: departmentName,
    senderFaculty: facultyName ?? "",
  });

  try {
    await sendSmtpMail({
      to: initiatorEmail,
      subject: OPEN_INTERVENTION_REMINDER_EMAIL_SUBJECT,
      html,
      replyTo: String(user.email ?? "").trim() || undefined,
    });
  } catch (err) {
    console.error("[header-intervention-reminder] remind send failed:", err);
    return NextResponse.json(
      { error: "Failed to send reminder email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
