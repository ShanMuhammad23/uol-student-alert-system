"use server";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";
import { getStudentBySapId } from "@/app/(home)/dashboard/fetch";
import {
  ensureCourseExists,
  deleteInterventionByIdFromDb,
  getInterventionByIdFromDb,
  insertIntervention,
  getInterventionsByStudentSapIdFromDb,
  getLatestInterventionStatusMapFromDb,
  getInterventionStatsForStudentsFromDb,
  getInterventionStatsForRoleScopeFromDb,
  updateInterventionByIdFromDb,
  type InterventionRoleScope,
  type InterventionRoleScopeStats,
} from "@/lib/db/interventions";
import { insertWellbeingDirectCase } from "@/lib/db/wellbeing-direct-cases";

/** Matches Intervention-Form fields for intervention history. */
export type InterventionRecord = {
  id: string;
  student_sap_id: string;
  date: string; // YYYY-MM-DD
  intervention_type: "attendance" | "gpa" | "both";
  alert_level?: "warning" | "critical" | null;
  outreach_mode: string; // email | phone-call | meeting
  remarks: string;
  status: string; // initiated | in-progress | referred | resolved | no-action-required
  performed_at: string; // ISO date
  staff_id?: string;
  uploader_name?: string | null;
  uploader_email?: string | null;
  uploader_pernr?: string | null;
  case_type?: "referred" | "internal" | "external" | null;
  assignee_name?: string | null;
  assignee_pernr?: string | null;
  assignee_email?: string | null;
};

export type InterventionEmailRecord = {
  id: string;
  student_sap_id: string;
  template_key: "sos_check_in" | "student_referral";
  recipient_email: string;
  subject: string;
  body_html: string;
  sender_staff_id: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_pernr: string | null;
  received_at: string;
  sent_at: string;
  created_at: string;
};

const STORE_DIR = ".data";
const STORE_FILENAME = "intervention-store.json";

function getStorePath(): string {
  return path.join(process.cwd(), STORE_DIR, STORE_FILENAME);
}

type EnrollmentRow = {
  SapNo?: string;
  DeptId?: string;
  DeptCode?: string;
  DeptName?: string;
  FacId?: string;
  CrCode?: string;
  CrTitle?: string;
  Name?: string;
};

type DbEnrollmentContext = {
  departmentId: string | null;
  facultyId: string | null;
  courseId: string | null;
  courseTitle: string | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaAlertLevel: "warning" | "critical" | null;
};

function readEnrollmentForStudent(sapId: string): EnrollmentRow | null {
  const dataPath = path.join(process.cwd(), "public", "enrollment_data.json");
  if (!existsSync(dataPath)) return null;
  try {
    const raw = readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw) as EnrollmentRow[];
    const list = Array.isArray(data) ? data : [];
    const normalizedSap = String(sapId).trim();
    const normalizedNoZeros = normalizedSap.replace(/^0+/, "");

    const matchesSap = (r: EnrollmentRow): boolean => {
      const rawSap = String(r.SapNo ?? "").trim();
      if (!rawSap) return false;
      if (rawSap === normalizedSap) return true;
      const rawNoZeros = rawSap.replace(/^0+/, "");
      if (rawNoZeros === normalizedNoZeros) return true;
      const n1 = Number(rawSap);
      const n2 = Number(normalizedSap);
      return Number.isFinite(n1) && Number.isFinite(n2) && n1 === n2;
    };

    // Prefer a record that has both DeptId and FacId.
    let first =
      list.find((r) => matchesSap(r) && r.DeptId && r.FacId) ??
      list.find((r) => matchesSap(r));
    return first ?? null;
  } catch {
    return null;
  }
}

async function ensureDepartmentFromEnrollment(enrollment: EnrollmentRow): Promise<void> {
  if (!pool) return;
  const deptId = String(enrollment.DeptId ?? "").trim();
  const facId = String(enrollment.FacId ?? "").trim();
  if (!deptId || !facId) return;

  const deptCode = (enrollment.DeptCode ?? "").trim() || null;
  const deptName = (enrollment.DeptName ?? "").trim() || deptCode || deptId;

  // Ensure faculty exists (id = FacId from enrollment).
  await pool.query(
    `INSERT INTO faculties (id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, faculties.name),
       updated_at = NOW()`,
    [facId, `Faculty ${facId}`]
  );

  // Ensure department exists (id = DeptId from enrollment).
  await pool.query(
    `INSERT INTO departments (id, code, name, faculty_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       code = COALESCE(EXCLUDED.code, departments.code),
       name = COALESCE(EXCLUDED.name, departments.name),
       faculty_id = COALESCE(EXCLUDED.faculty_id, departments.faculty_id),
       updated_at = NOW()`,
    [deptId, deptCode, deptName, facId]
  );
}

async function getEnrollmentContextFromDb(
  sapId: string,
  focused?: {
    courseId?: string | null;
    sectionCode?: string | null;
    eventPackageId?: string | null;
  }
): Promise<DbEnrollmentContext | null> {
  if (!pool) return null;
  const res = await pool.query<{
    department_id: string | null;
    faculty_id: string | null;
    course_id: string | null;
    course_title: string | null;
    attendance_alert_level: "warning" | "critical" | null;
    gpa_alert_level: "warning" | "critical" | null;
  }>(
    `SELECT
       e.department_id,
       e.faculty_id,
       e.course_id,
       c.title AS course_title,
       a.attendance_alert_level,
       a.gpa_alert_level
     FROM student_enrollment_current e
     LEFT JOIN student_alert_current a
       ON a.sap_id = e.sap_id
      AND a.course_id = e.course_id
      AND a.section_code = e.section_code
      AND a.event_package_id = e.event_package_id
     LEFT JOIN courses c ON c.id = e.course_id
     WHERE e.sap_id = $1
     ORDER BY
       CASE
         WHEN $2::text <> ''
          AND e.course_id = $2::text
          AND COALESCE(e.section_code, '') = $3::text
          AND COALESCE(e.event_package_id, '') = $4::text
         THEN 0
         ELSE 1
       END ASC,
       CASE
         WHEN a.attendance_alert_level = 'critical' OR a.gpa_alert_level = 'critical' THEN 3
         WHEN a.attendance_alert_level = 'warning' OR a.gpa_alert_level = 'warning' THEN 2
         ELSE 1
       END DESC,
       e.course_id ASC
     LIMIT 1`,
    [
      sapId,
      String(focused?.courseId ?? "").trim(),
      String(focused?.sectionCode ?? "").trim(),
      String(focused?.eventPackageId ?? "").trim(),
    ]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    departmentId: row.department_id ?? null,
    facultyId: row.faculty_id ?? null,
    courseId: row.course_id ?? null,
    courseTitle: row.course_title ?? null,
    attendanceAlertLevel: row.attendance_alert_level ?? null,
    gpaAlertLevel: row.gpa_alert_level ?? null,
  };
}

function readStore(): InterventionRecord[] {
  const storePath = getStorePath();
  if (!existsSync(storePath)) return [];
  try {
    const raw = readFileSync(storePath, "utf-8");
    const data = JSON.parse(raw) as Partial<InterventionRecord>[];
    if (!Array.isArray(data)) return [];
    return data.map((r) => ({
      id: String(r.id ?? ""),
      student_sap_id: String(r.student_sap_id ?? ""),
      date: String(r.date ?? ""),
      intervention_type:
        r.intervention_type === "gpa"
          ? "gpa"
          : r.intervention_type === "both"
            ? "both"
            : "attendance",
      alert_level:
        r.alert_level === "critical"
          ? "critical"
          : r.alert_level === "warning"
            ? "warning"
            : null,
      outreach_mode: String(r.outreach_mode ?? ""),
      remarks: String(r.remarks ?? ""),
      status: String(r.status ?? ""),
      performed_at: String(r.performed_at ?? new Date().toISOString()),
      staff_id: String(r.staff_id ?? ""),
      uploader_name: null,
      uploader_email: null,
      uploader_pernr: null,
    }));
  } catch {
    return [];
  }
}

/** All interventions for a student, newest first. Uses DB when available, else file. */
export async function getInterventionsByStudentSapId(
  sapId: string
): Promise<InterventionRecord[]> {
  if (pool) {
    const rows = await getInterventionsByStudentSapIdFromDb(sapId);
    return rows as InterventionRecord[];
  }
  const stored = readStore();
  return stored
    .filter((r) => r.student_sap_id === sapId)
    .sort(
      (a, b) =>
        new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );
}

/** Latest intervention status for this student (for badge). Returns null when no intervention. */
export async function getLatestInterventionStatusForStudent(
  sapId: string
): Promise<string | null> {
  const list = await getInterventionsByStudentSapId(sapId);
  return list.length > 0 ? list[0].status : null;
}

/** Batch: latest intervention status per student. Use when rendering many students to avoid N async calls. */
export async function getLatestInterventionStatusMap(
  sapIds: string[]
): Promise<Map<string, string | null>> {
  if (pool && sapIds.length > 0) {
    return getLatestInterventionStatusMapFromDb(sapIds);
  }
  const stored = readStore();
  const latestBySapId = new Map<string, InterventionRecord>();
  for (const r of stored) {
    const existing = latestBySapId.get(r.student_sap_id);
    if (
      !existing ||
      new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()
    ) {
      latestBySapId.set(r.student_sap_id, r);
    }
  }
  const map = new Map<string, string | null>();
  for (const sapId of sapIds) {
    const record = latestBySapId.get(sapId);
    map.set(sapId, record?.status ?? null);
  }
  return map;
}

/** Latest intervention status for all students from DB/file. */
export async function getAllLatestInterventionStatuses(): Promise<
  Map<string, string | null>
> {
  const map = new Map<string, string | null>();

  if (pool) {
    const res = await pool.query<{
      student_sap_id: string;
      status: string | null;
    }>(`
      WITH latest AS (
        SELECT DISTINCT ON (student_sap_id)
          student_sap_id,
          status
        FROM interventions
        ORDER BY student_sap_id, performed_at DESC
      )
      SELECT student_sap_id, status FROM latest
    `);

    for (const row of res.rows) {
      map.set(row.student_sap_id, row.status ?? null);
    }
    return map;
  }

  // File-based fallback
  const stored = readStore();
  const latestBySapId = new Map<string, InterventionRecord>();
  for (const r of stored) {
    const existing = latestBySapId.get(r.student_sap_id);
    if (
      !existing ||
      new Date(r.performed_at).getTime() >
        new Date(existing.performed_at).getTime()
    ) {
      latestBySapId.set(r.student_sap_id, r);
    }
  }

  for (const [sapId, record] of latestBySapId.entries()) {
    map.set(sapId, record?.status ?? null);
  }

  return map;
}

export type InterventionStatsCounts = {
  notStarted: number;
  initiated: number;
  "in-progress": number;
  referred: number;
  resolved: number;
  noActionRequired: number;
};

export type InterventionRoleScopeStatsCounts = InterventionRoleScopeStats;

export async function getInterventionStatsForRoleScope(
  params: InterventionRoleScope
): Promise<InterventionRoleScopeStatsCounts> {
  if (pool) {
    return getInterventionStatsForRoleScopeFromDb(params);
  }

  // File fallback does not store faculty/department/staff scope columns,
  // so we can only approximate by intervention_type.
  const stored = readStore();
  // Pick latest intervention status per student for the requested type.
  // Then (optionally) filter those latest records by alert_level so the
  // behavior matches the DB implementation.
  const filtered = stored.filter((r) => r.intervention_type === params.interventionType);

  const latestByStudent = new Map<string, InterventionRecord>();
  for (const r of filtered) {
    const existing = latestByStudent.get(r.student_sap_id);
    if (!existing || new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()) {
      latestByStudent.set(r.student_sap_id, r);
    }
  }

  const latestRecords = Array.from(latestByStudent.values()).filter((r) => {
    if (params.alertLevel == null) return true;
    return r.alert_level === params.alertLevel;
  });

  const out = {
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
  };
  for (const r of latestRecords) {
    if (r.status === "initiated") out.initiated += 1;
    else if (r.status === "in-progress") out.inProgress += 1;
    else if (r.status === "referred") out.referred += 1;
    else if (r.status === "resolved") out.resolved += 1;
    else if (r.status === "no-action-required") out.noActionRequired += 1;
  }

  return {
    ...out,
    totalInterventionStudents:
      out.initiated +
      out.inProgress +
      out.referred +
      out.resolved +
      out.noActionRequired,
  };
}

/**
 * For a given set of student SAP IDs (e.g. all students in alert for the user),
 * returns counts per intervention status. "Not Started" = in alert but no action taken.
 * Sum of all counts equals sapIds.length.
 */
export async function getInterventionStatsForStudents(
  sapIds: string[]
): Promise<InterventionStatsCounts> {
  if (pool && sapIds.length > 0) {
    return getInterventionStatsForStudentsFromDb(sapIds);
  }
  const stored = readStore();
  const latestBySapId = new Map<string, InterventionRecord>();
  for (const r of stored) {
    const existing = latestBySapId.get(r.student_sap_id);
    if (
      !existing ||
      new Date(r.performed_at).getTime() > new Date(existing.performed_at).getTime()
    ) {
      latestBySapId.set(r.student_sap_id, r);
    }
  }
  let notStarted = 0;
  let initiated = 0;
  let inProgress = 0;
  let referred = 0;
  let resolved = 0;
  let noActionRequired = 0;
  for (const sapId of sapIds) {
    const record = latestBySapId.get(sapId);
    const status = record?.status ?? null;
    if (status === null) notStarted += 1;
    else if (status === "initiated") initiated += 1;
    else if (status === "in-progress") inProgress += 1;
    else if (status === "referred") referred += 1;
    else if (status === "resolved") resolved += 1;
    else if (status === "no-action-required") noActionRequired += 1;
    else notStarted += 1;
  }
  return {
    notStarted,
    initiated,
    "in-progress": inProgress,
    referred,
    resolved,
    noActionRequired,
  };
}

export async function recordIntervention(
  studentSapId: string,
  data: {
    date: string;
    intervention_type: "attendance" | "gpa" | "both";
    outreach_mode: string;
    remarks: string;
    status: string;
    focused_course_id?: string | null;
    focused_section_code?: string | null;
    focused_event_package_id?: string | null;
  }
): Promise<void> {
  if (pool) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("You must be signed in to record an intervention.");
    }
    const dbContext = await getEnrollmentContextFromDb(studentSapId, {
      courseId: data.focused_course_id ?? null,
      sectionCode: data.focused_section_code ?? null,
      eventPackageId: data.focused_event_package_id ?? null,
    });
    const alertLevel =
      data.intervention_type === "attendance"
        ? dbContext?.attendanceAlertLevel ?? null
        : data.intervention_type === "gpa"
          ? dbContext?.gpaAlertLevel ?? null
          : dbContext?.attendanceAlertLevel === "critical" ||
              dbContext?.gpaAlertLevel === "critical"
            ? "critical"
            : dbContext?.attendanceAlertLevel === "warning" ||
                dbContext?.gpaAlertLevel === "warning"
              ? "warning"
              : null;

    let departmentId: string | null = null;
    let facultyId: string | null = null;
    let courseId: string | null = null;
    let courseTitle: string | undefined;

    if (dbContext?.departmentId && dbContext?.facultyId) {
      departmentId = String(dbContext.departmentId).trim();
      facultyId = String(dbContext.facultyId).trim();
      courseId = String(dbContext.courseId ?? "").trim() || "unknown";
      courseTitle = dbContext.courseTitle ?? undefined;
    }

    if (!departmentId || !facultyId) {
      throw new Error(
        "Student context not found in database enrollment tables for this SAP ID."
      );
    }

    const finalCourseId = (courseId ?? "").trim() || "unknown";
    await ensureCourseExists(finalCourseId, {
      title: courseTitle,
      departmentId,
      facultyId,
    });
    const performedAt = new Date().toISOString();
    await insertIntervention({
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      student_sap_id: studentSapId,
      date: data.date,
      intervention_type: data.intervention_type,
      alert_level: alertLevel,
      outreach_mode: data.outreach_mode,
      remarks: data.remarks ?? "",
      status: data.status,
      performed_at: performedAt,
      staff_id: session.user.id,
      department_id: departmentId,
      course_id: finalCourseId,
      faculty_id: facultyId,
      section_code: String(data.focused_section_code ?? "").trim() || null,
      event_package_id: String(data.focused_event_package_id ?? "").trim() || null,
    });
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${studentSapId}`);
    return;
  }
  const student = await getStudentBySapId(studentSapId);
  const alertLevel =
    data.intervention_type === "attendance"
      ? student?.attendance?.alert_level ?? null
      : data.intervention_type === "gpa"
        ? student?.gpa?.alert_level ?? null
        : student?.attendance?.alert_level === "critical" ||
            student?.gpa?.alert_level === "critical"
          ? "critical"
          : student?.attendance?.alert_level === "warning" ||
              student?.gpa?.alert_level === "warning"
            ? "warning"
            : null;
  const stored = readStore();
  const record: InterventionRecord = {
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    student_sap_id: studentSapId,
    date: data.date,
    intervention_type: data.intervention_type,
    alert_level: alertLevel,
    outreach_mode: data.outreach_mode,
    remarks: data.remarks,
    status: data.status,
    performed_at: new Date().toISOString(),
  };
  stored.push(record);
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(stored, null, 2), "utf-8");
  revalidatePath("/");
  revalidatePath(`/students/${studentSapId}`);
}

/** Wellbeing-initiated external direct case. Creates intervention + wellbeing_direct_cases row. */
export async function recordDirectWellbeingIntervention(
  studentSapId: string,
  data: {
    date: string;
    intervention_type: "attendance" | "gpa" | "both";
    outreach_mode: string;
    remarks: string;
    status: string;
    case_type: "external";
    assignee_staff_id: string;
    external_notes?: string;
  }
): Promise<void> {
  if (!pool) {
    throw new Error("Database not configured.");
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("You must be signed in.");
  }
  const isWellbeingRole =
    session.user.role === "wellbeing" ||
    session.user.role === "wellbeing-head" ||
    session.user.role === "wellbeing-counseller";
  if (!isWellbeingRole && session.user.role !== "superadmin") {
    throw new Error("Only wellbeing staff can add direct cases.");
  }
  const dbContext = await getEnrollmentContextFromDb(studentSapId, {});
  if (!dbContext?.departmentId || !dbContext?.facultyId) {
    throw new Error(
      "Student context not found in enrollment. Check the SAP ID and try again."
    );
  }
  const departmentId = String(dbContext.departmentId).trim();
  const facultyId = String(dbContext.facultyId).trim();
  const courseId = String(dbContext.courseId ?? "").trim() || "unknown";
  await ensureCourseExists(courseId, {
    title: dbContext.courseTitle ?? undefined,
    departmentId,
    facultyId,
  });
  const performedAt = new Date().toISOString();
  const interventionId = `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const alertLevel =
    data.intervention_type === "attendance"
      ? dbContext.attendanceAlertLevel ?? null
      : data.intervention_type === "gpa"
        ? dbContext.gpaAlertLevel ?? null
        : dbContext.attendanceAlertLevel === "critical" ||
            dbContext.gpaAlertLevel === "critical"
          ? "critical"
          : dbContext.attendanceAlertLevel === "warning" ||
              dbContext.gpaAlertLevel === "warning"
            ? "warning"
            : null;

  await insertIntervention({
    id: interventionId,
    student_sap_id: studentSapId,
    date: data.date,
    intervention_type: data.intervention_type,
    alert_level: alertLevel,
    outreach_mode: data.outreach_mode,
    remarks: data.remarks ?? "",
    status: data.status,
    performed_at: performedAt,
    staff_id: session.user.id,
    department_id: departmentId,
    course_id: courseId,
    faculty_id: facultyId,
    section_code: null,
    event_package_id: null,
    case_type: data.case_type,
    assignee_staff_id: data.assignee_staff_id,
  });

  const created = await insertWellbeingDirectCase({
    studentSapId,
    interventionId,
    externalNotes: data.external_notes ?? "",
    createdByStaffId: session.user.id,
  });
  if (!created) {
    throw new Error("Failed to link direct wellbeing case (check DB migration).");
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wellbeing/counseller");
  revalidatePath(`/students/${studentSapId}`);
}

export async function deleteInterventionById(id: string): Promise<{ studentSapId: string | null }> {
  if (pool) {
    const deleted = await deleteInterventionByIdFromDb(id);
    if (!deleted) return { studentSapId: null };
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${deleted.student_sap_id}`);
    return { studentSapId: deleted.student_sap_id };
  }
  const stored = readStore();
  const idx = stored.findIndex((r) => r.id === id);
  if (idx === -1) return { studentSapId: null };
  const studentSapId = stored[idx].student_sap_id;
  stored.splice(idx, 1);
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(stored, null, 2), "utf-8");
  revalidatePath("/");
  revalidatePath(`/students/${studentSapId}`);
  return { studentSapId };
}

export async function getInterventionById(
  id: string
): Promise<InterventionRecord | null> {
  if (pool) {
    const row = await getInterventionByIdFromDb(id);
    return (row as InterventionRecord | null) ?? null;
  }
  const stored = readStore();
  return stored.find((r) => r.id === id) ?? null;
}

export async function updateInterventionById(
  id: string,
  data: {
    date: string;
    intervention_type: "attendance" | "gpa" | "both";
    outreach_mode: string;
    remarks: string;
    status: string;
  }
): Promise<{ studentSapId: string | null }> {
  if (pool) {
    const updated = await updateInterventionByIdFromDb(id, data);
    if (!updated) return { studentSapId: null };
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${updated.student_sap_id}`);
    return { studentSapId: updated.student_sap_id };
  }
  const stored = readStore();
  const idx = stored.findIndex((r) => r.id === id);
  if (idx === -1) return { studentSapId: null };
  const existing = stored[idx];
  const updatedRow: InterventionRecord = {
    ...existing,
    date: data.date,
    intervention_type: data.intervention_type,
    outreach_mode: data.outreach_mode,
    remarks: data.remarks,
    status: data.status,
  };
  stored[idx] = updatedRow;
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(stored, null, 2), "utf-8");
  revalidatePath("/");
  revalidatePath(`/students/${existing.student_sap_id}`);
  return { studentSapId: existing.student_sap_id };
}

export async function saveInterventionEmail(
  studentSapId: string,
  data: {
    template_key: "sos_check_in" | "student_referral";
    recipient_email: string;
    subject: string;
    body_html: string;
  }
): Promise<void> {
  if (!pool) return;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("You must be signed in to send email.");
  }

  const recipient = String(data.recipient_email ?? "").trim();
  if (!recipient) {
    throw new Error("Recipient email is required.");
  }

  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const secureRaw = process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromAddress = process.env.SMTP_FROM ?? "alert@student-alert.uol.edu.pk";
  if (!host || !portRaw || !user || !pass) {
    throw new Error("SMTP configuration is incomplete.");
  }
  if (recipient.toLowerCase() === fromAddress.toLowerCase()) {
    throw new Error("Recipient email must be different from sender email.");
  }

  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port: Number(portRaw),
    secure: String(secureRaw).toLowerCase() === "true",
    auth: { user, pass },
  });

  await transport.sendMail({
    from: fromAddress,
    to: recipient,
    subject: data.subject,
    html: data.body_html,
    replyTo: session.user.email ?? undefined,
  });

  await pool.query(
    `INSERT INTO intervention_emails (
      student_sap_id,
      template_key,
      recipient_email,
      subject,
      body_html,
      sender_staff_id,
      sender_name,
      sender_email,
      sender_pernr,
      received_at,
      sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [
      studentSapId,
      data.template_key,
      recipient,
      data.subject,
      data.body_html,
      session.user.id,
      session.user.name ?? null,
      fromAddress,
      (session.user as { pernr?: string | null }).pernr ?? null,
    ]
  );

  revalidatePath(`/students/${studentSapId}`);
}

export async function getInterventionEmailsByStudentSapId(
  studentSapId: string
): Promise<InterventionEmailRecord[]> {
  if (!pool) return [];
  const res = await pool.query<InterventionEmailRecord>(
    `SELECT
      id,
      student_sap_id,
      template_key,
      recipient_email,
      subject,
      body_html,
      sender_staff_id,
      sender_name,
      sender_email,
      sender_pernr,
      received_at::text,
      sent_at::text,
      created_at::text
    FROM intervention_emails
    WHERE student_sap_id = $1
    ORDER BY sent_at DESC`,
    [studentSapId]
  );
  return res.rows;
}
