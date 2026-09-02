import {
  enrolledInCurrentTermSql,
  enrolledInTermSql,
  formatAcademicTermLabel,
  getAcademicTermForScope,
  getCurrentAcademicTerm,
  getCurrentTermDateBounds,
  type AcademicTermScope,
} from "@/lib/academic-term";
import { pool } from "./index";

function normalizeSapId(value: string): string {
  const trimmed = String(value ?? "").trim();
  const noLeadingZeros = trimmed.replace(/^0+/, "");
  return noLeadingZeros || "0";
}

let hasInterventionTypeColumnCache: boolean | null = null;

async function hasInterventionTypeColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasInterventionTypeColumnCache !== null) return hasInterventionTypeColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'intervention_type'
    ) AS exists
    `
  );
  hasInterventionTypeColumnCache = Boolean(res.rows[0]?.exists);
  return hasInterventionTypeColumnCache;
}

let hasAlertLevelColumnCache: boolean | null = null;
let hasSectionCodeColumnCache: boolean | null = null;
let hasEventPackageIdColumnCache: boolean | null = null;

async function hasAlertLevelColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasAlertLevelColumnCache !== null) return hasAlertLevelColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'alert_level'
    ) AS exists
    `
  );
  hasAlertLevelColumnCache = Boolean(res.rows[0]?.exists);
  return hasAlertLevelColumnCache;
}

async function hasSectionCodeColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasSectionCodeColumnCache !== null) return hasSectionCodeColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'section_code'
    ) AS exists
    `
  );
  hasSectionCodeColumnCache = Boolean(res.rows[0]?.exists);
  return hasSectionCodeColumnCache;
}

async function hasEventPackageIdColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasEventPackageIdColumnCache !== null) return hasEventPackageIdColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'event_package_id'
    ) AS exists
    `
  );
  hasEventPackageIdColumnCache = Boolean(res.rows[0]?.exists);
  return hasEventPackageIdColumnCache;
}

let hasCaseTypeColumnCache: boolean | null = null;
let hasAssigneeStaffIdColumnCache: boolean | null = null;

export async function hasCaseTypeColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasCaseTypeColumnCache !== null) return hasCaseTypeColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'case_type'
    ) AS exists
    `
  );
  hasCaseTypeColumnCache = Boolean(res.rows[0]?.exists);
  return hasCaseTypeColumnCache;
}

export async function hasAssigneeStaffIdColumn(): Promise<boolean> {
  if (!pool) return false;
  if (hasAssigneeStaffIdColumnCache !== null) return hasAssigneeStaffIdColumnCache;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name = 'assignee_staff_id'
    ) AS exists
    `
  );
  hasAssigneeStaffIdColumnCache = Boolean(res.rows[0]?.exists);
  return hasAssigneeStaffIdColumnCache;
}

async function patchInterventionCaseAndAssignee(
  interventionId: string,
  opts: {
    case_type?: "referred" | "internal" | "external";
    assignee_staff_id?: string | null;
    status?: string;
  }
): Promise<void> {
  if (!pool) return;
  const hasCT = await hasCaseTypeColumn();
  const hasA = await hasAssigneeStaffIdColumn();
  if (!hasCT && !hasA) return;
  const parts: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (hasCT) {
    const derivedCaseType =
      opts.case_type ??
      (String(opts.status ?? "").trim().toLowerCase() === "referred"
        ? "referred"
        : "internal");
    parts.push(`case_type = $${i++}`);
    vals.push(derivedCaseType);
  }
  if (hasA) {
    parts.push(`assignee_staff_id = $${i++}`);
    vals.push(opts.assignee_staff_id ?? null);
  }
  vals.push(interventionId);
  await pool.query(
    `UPDATE interventions SET ${parts.join(", ")} WHERE id = $${i}`,
    vals
  );
}

/** Single intervention row as returned from DB (matches intervention-store InterventionRecord). */
export type InterventionRow = {
  id: string;
  student_sap_id: string;
  date: string;
  intervention_type: "attendance" | "gpa" | "both";
  course_id?: string | null;
  course_title?: string | null;
  section_code?: string | null;
  event_package_id?: string | null;
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at: string;
  created_at?: string | null;
  staff_id?: string | null;
  uploader_name?: string | null;
  uploader_email?: string | null;
  uploader_pernr?: string | null;
  case_type?: "referred" | "internal" | "external" | null;
  assignee_name?: string | null;
  assignee_pernr?: string | null;
  assignee_email?: string | null;
};

/** Ensure a course exists in the courses table (for intervention FK). Upserts by id. */
export async function ensureCourseExists(
  courseId: string,
  opts?: { title?: string; departmentId?: string; facultyId?: string }
): Promise<void> {
  if (!pool || !courseId.trim()) return;
  const title = opts?.title ?? null;
  const departmentId = opts?.departmentId ?? null;
  const facultyId = opts?.facultyId ?? null;
  await pool.query(
    `INSERT INTO courses (id, title, department_id, faculty_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = COALESCE(EXCLUDED.title, courses.title),
       department_id = COALESCE(EXCLUDED.department_id, courses.department_id),
       faculty_id = COALESCE(EXCLUDED.faculty_id, courses.faculty_id),
       updated_at = NOW()`,
    [courseId.trim(), title, departmentId, facultyId]
  );
}

/** Insert one intervention. Caller must ensure staff_id, department_id, course_id, faculty_id are valid. */
export function interventionIncludesSgpa(
  type?: string | null
): boolean {
  return type === "gpa" || type === "both";
}

export class DuplicateSgpaInterventionError extends Error {
  constructor(termLabel: string) {
    super(
      `An SGPA intervention already exists for this student in ${termLabel}. SGPA is student-level, so only one SGPA intervention can be initiated per semester — update the existing case instead of adding another against a subject.`
    );
    this.name = "DuplicateSgpaInterventionError";
  }
}

export async function assertUniqueSgpaInterventionForCurrentTerm(
  sapId: string,
  interventionType: string,
  opts?: { excludeId?: string }
): Promise<void> {
  if (!interventionIncludesSgpa(interventionType)) return;
  const term = getCurrentAcademicTerm();
  const termLabel =
    formatAcademicTermLabel(term.termYear, term.termSession) ?? "the current semester";
  if (!pool) return;
  const hasType = await hasInterventionTypeColumn();
  if (!hasType) return;

  const { start, end } = getCurrentTermDateBounds();
  const excludeId = String(opts?.excludeId ?? "").trim() || null;
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM interventions i
      WHERE i.student_sap_id = $1
        AND i.intervention_type IN ('gpa', 'both')
        AND ($4::text IS NULL OR i.id <> $4)
        AND COALESCE(i.date, (i.performed_at AT TIME ZONE 'UTC')::date)
          BETWEEN $2::date AND $3::date
    ) AS exists
    `,
    [sapId, start, end, excludeId]
  );
  if (res.rows[0]?.exists === true) {
    throw new DuplicateSgpaInterventionError(termLabel);
  }
}

/** Insert one intervention. Caller must ensure staff_id, department_id, course_id, faculty_id are valid. */
export async function insertIntervention(row: {
  id: string;
  student_sap_id: string;
  date: string;
  intervention_type: "attendance" | "gpa" | "both";
  alert_level?: "warning" | "critical" | null;
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at: string;
  staff_id: string;
  department_id: string;
  course_id: string;
  faculty_id: string;
  section_code?: string | null;
  event_package_id?: string | null;
  case_type?: "referred" | "internal" | "external";
  assignee_staff_id?: string | null;
}): Promise<void> {
  if (!pool) throw new Error("Database not configured");
  await assertUniqueSgpaInterventionForCurrentTerm(
    row.student_sap_id,
    row.intervention_type
  );
  const hasType = await hasInterventionTypeColumn();
  const hasAlertLevel = await hasAlertLevelColumn();
  const hasSectionCode = await hasSectionCodeColumn();
  const hasEventPackageId = await hasEventPackageIdColumn();
  const normalizedCaseType: "referred" | "internal" | "external" =
    row.case_type ??
    (String(row.status ?? "").trim().toLowerCase() === "referred"
      ? "referred"
      : "internal");

  if (hasType && hasAlertLevel && hasSectionCode && hasEventPackageId) {
    await pool.query(
      `INSERT INTO interventions (
        id, student_sap_id, date, intervention_type, outreach_mode, remarks, status, performed_at,
        staff_id, department_id, course_id, faculty_id, alert_level, section_code, event_package_id
      ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12, $13, $14, $15)`,
      [
        row.id,
        row.student_sap_id,
        row.date,
        row.intervention_type,
        row.outreach_mode,
        row.remarks ?? "",
        row.status,
        row.performed_at,
        row.staff_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        row.alert_level ?? null,
        row.section_code ?? null,
        row.event_package_id ?? null,
      ]
    );
    await patchInterventionCaseAndAssignee(row.id, {
      case_type: normalizedCaseType,
      assignee_staff_id: row.assignee_staff_id,
      status: row.status,
    });
    return;
  }

  if (hasType && !hasAlertLevel && hasSectionCode && hasEventPackageId) {
    await pool.query(
      `INSERT INTO interventions (
        id, student_sap_id, date, intervention_type, outreach_mode, remarks, status, performed_at,
        staff_id, department_id, course_id, faculty_id, section_code, event_package_id
      ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12, $13, $14)`,
      [
        row.id,
        row.student_sap_id,
        row.date,
        row.intervention_type,
        row.outreach_mode,
        row.remarks ?? "",
        row.status,
        row.performed_at,
        row.staff_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        row.section_code ?? null,
        row.event_package_id ?? null,
      ]
    );
    await patchInterventionCaseAndAssignee(row.id, {
      case_type: normalizedCaseType,
      assignee_staff_id: row.assignee_staff_id,
      status: row.status,
    });
    return;
  }

  if (!hasType && hasAlertLevel && hasSectionCode && hasEventPackageId) {
    await pool.query(
      `INSERT INTO interventions (
        id, student_sap_id, date, outreach_mode, remarks, status, performed_at,
        staff_id, department_id, course_id, faculty_id, alert_level, section_code, event_package_id
      ) VALUES ($1, $2, $3::date, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12, $13, $14)`,
      [
        row.id,
        row.student_sap_id,
        row.date,
        row.outreach_mode,
        row.remarks ?? "",
        row.status,
        row.performed_at,
        row.staff_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        row.alert_level ?? null,
        row.section_code ?? null,
        row.event_package_id ?? null,
      ]
    );
    await patchInterventionCaseAndAssignee(row.id, {
      case_type: normalizedCaseType,
      assignee_staff_id: row.assignee_staff_id,
      status: row.status,
    });
    return;
  }

  if (hasType && !hasAlertLevel) {
    await pool.query(
      `INSERT INTO interventions (
        id, student_sap_id, date, intervention_type, outreach_mode, remarks, status, performed_at,
        staff_id, department_id, course_id, faculty_id
      ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12)`,
      [
        row.id,
        row.student_sap_id,
        row.date,
        row.intervention_type,
        row.outreach_mode,
        row.remarks ?? "",
        row.status,
        row.performed_at,
        row.staff_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
      ]
    );
    await patchInterventionCaseAndAssignee(row.id, {
      case_type: normalizedCaseType,
      assignee_staff_id: row.assignee_staff_id,
      status: row.status,
    });
    return;
  }

  if (!hasType && hasAlertLevel) {
    await pool.query(
      `INSERT INTO interventions (
        id, student_sap_id, date, outreach_mode, remarks, status, performed_at,
        staff_id, department_id, course_id, faculty_id, alert_level
      ) VALUES ($1, $2, $3::date, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12)`,
      [
        row.id,
        row.student_sap_id,
        row.date,
        row.outreach_mode,
        row.remarks ?? "",
        row.status,
        row.performed_at,
        row.staff_id,
        row.department_id,
        row.course_id,
        row.faculty_id,
        row.alert_level ?? null,
      ]
    );
    await patchInterventionCaseAndAssignee(row.id, {
      case_type: normalizedCaseType,
      assignee_staff_id: row.assignee_staff_id,
      status: row.status,
    });
    return;
  }

  // !hasType && !hasAlertLevel
  await pool.query(
    `INSERT INTO interventions (
      id, student_sap_id, date, outreach_mode, remarks, status, performed_at,
      staff_id, department_id, course_id, faculty_id
    ) VALUES ($1, $2, $3::date, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11)`,
    [
      row.id,
      row.student_sap_id,
      row.date,
      row.outreach_mode,
      row.remarks ?? "",
      row.status,
      row.performed_at,
      row.staff_id,
      row.department_id,
      row.course_id,
      row.faculty_id,
    ]
  );
  await patchInterventionCaseAndAssignee(row.id, {
    case_type: normalizedCaseType,
    assignee_staff_id: row.assignee_staff_id,
    status: row.status,
  });
}

/** All interventions for a student from DB, newest first. */
export async function getInterventionsByStudentSapIdFromDb(
  sapId: string
): Promise<InterventionRow[]> {
  if (!pool) return [];
  const hasType = await hasInterventionTypeColumn();
  const hasCT = await hasCaseTypeColumn();
  const hasA = await hasAssigneeStaffIdColumn();
  const hasSectionCode = await hasSectionCodeColumn();
  const hasEventPackageId = await hasEventPackageIdColumn();
  const selectParts: string[] = [
    "i.id",
    "i.student_sap_id",
    "i.date",
    "i.course_id",
    "c.title AS course_title",
    "i.created_at",
  ];
  if (hasSectionCode) selectParts.push("i.section_code");
  if (hasEventPackageId) selectParts.push("i.event_package_id");
  if (hasType) selectParts.push("i.intervention_type");
  if (hasCT) selectParts.push("i.case_type");
  selectParts.push(
    "i.outreach_mode",
    "i.remarks",
    "i.status",
    "i.performed_at",
    "i.staff_id",
    "s.name AS uploader_name",
    "s.email AS uploader_email",
    "s.pernr AS uploader_pernr"
  );
  if (hasA) {
    selectParts.push(
      "asn.name AS assignee_name",
      "asn.pernr AS assignee_pernr",
      "asn.email AS assignee_email"
    );
  }
  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM interventions i
    LEFT JOIN courses c ON c.id = i.course_id
    LEFT JOIN staff s ON s.id = i.staff_id
    ${hasA ? "LEFT JOIN staff asn ON asn.id = i.assignee_staff_id" : ""}
    WHERE i.student_sap_id = $1
    ORDER BY i.performed_at DESC`;
  const res = await pool.query<{
    id: string;
    student_sap_id: string;
    date: string;
    course_id: string | null;
    course_title: string | null;
    created_at: Date | string | null;
    section_code?: string | null;
    event_package_id?: string | null;
    intervention_type?: "attendance" | "gpa" | "both" | null;
    case_type?: string | null;
    outreach_mode: string;
    remarks: string;
    status: string;
    performed_at: Date;
    staff_id: string | null;
    uploader_name: string | null;
    uploader_email: string | null;
    uploader_pernr: string | null;
    assignee_name?: string | null;
    assignee_pernr?: string | null;
    assignee_email?: string | null;
  }>(sql, [sapId]);
  return res.rows.map((r) => {
    const ct = r.case_type;
    const caseTypeNorm =
      ct === "internal" || ct === "external"
        ? ct
        : ct === "referred"
          ? "referred"
          : "referred";
    return {
      id: r.id,
      student_sap_id: r.student_sap_id,
      intervention_type:
        r.intervention_type === "gpa"
          ? "gpa"
          : r.intervention_type === "both"
            ? "both"
            : "attendance",
      course_id: r.course_id ?? null,
      course_title: r.course_title ?? null,
      section_code: hasSectionCode ? (r.section_code ?? null) : null,
      event_package_id: hasEventPackageId ? (r.event_package_id ?? null) : null,
      outreach_mode: r.outreach_mode,
      remarks: r.remarks,
      status: r.status,
      date:
        typeof r.date === "string"
          ? r.date
          : (r.date as unknown as Date).toISOString().slice(0, 10),
      created_at:
        r.created_at == null
          ? null
          : typeof r.created_at === "string"
            ? r.created_at
            : (r.created_at as Date).toISOString(),
      performed_at:
        typeof r.performed_at === "string"
          ? r.performed_at
          : (r.performed_at as Date).toISOString(),
      staff_id: r.staff_id ?? null,
      uploader_name: r.uploader_name ?? null,
      uploader_email: r.uploader_email ?? null,
      uploader_pernr: r.uploader_pernr ?? null,
      case_type: hasCT ? caseTypeNorm : null,
      assignee_name: hasA ? r.assignee_name ?? null : null,
      assignee_pernr: hasA ? r.assignee_pernr ?? null : null,
      assignee_email: hasA ? r.assignee_email ?? null : null,
    };
  });
}

/** All interventions created by a staff user from DB, newest first. */
export async function getInterventionsByStaffIdFromDb(
  staffId: string
): Promise<InterventionRow[]> {
  if (!pool) return [];
  const hasType = await hasInterventionTypeColumn();
  const hasCT = await hasCaseTypeColumn();
  const hasA = await hasAssigneeStaffIdColumn();
  const selectParts: string[] = [
    "i.id",
    "i.student_sap_id",
    "i.date",
  ];
  if (hasType) selectParts.push("i.intervention_type");
  if (hasCT) selectParts.push("i.case_type");
  selectParts.push(
    "i.outreach_mode",
    "i.remarks",
    "i.status",
    "i.performed_at",
    "i.staff_id",
    "s.name AS uploader_name",
    "s.email AS uploader_email",
    "s.pernr AS uploader_pernr"
  );
  if (hasA) {
    selectParts.push(
      "asn.name AS assignee_name",
      "asn.pernr AS assignee_pernr",
      "asn.email AS assignee_email"
    );
  }
  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM interventions i
    LEFT JOIN staff s ON s.id = i.staff_id
    ${hasA ? "LEFT JOIN staff asn ON asn.id = i.assignee_staff_id" : ""}
    WHERE i.staff_id = $1::uuid
    ORDER BY i.performed_at DESC`;
  const res = await pool.query<{
    id: string;
    student_sap_id: string;
    date: string;
    intervention_type?: "attendance" | "gpa" | "both" | null;
    case_type?: string | null;
    outreach_mode: string;
    remarks: string;
    status: string;
    performed_at: Date;
    staff_id: string | null;
    uploader_name: string | null;
    uploader_email: string | null;
    uploader_pernr: string | null;
    assignee_name?: string | null;
    assignee_pernr?: string | null;
    assignee_email?: string | null;
  }>(sql, [staffId]);
  return res.rows.map((r) => {
    const ct = r.case_type;
    const caseTypeNorm =
      ct === "internal" || ct === "external"
        ? ct
        : ct === "referred"
          ? "referred"
          : "referred";
    return {
      id: r.id,
      student_sap_id: r.student_sap_id,
      intervention_type:
        r.intervention_type === "gpa"
          ? "gpa"
          : r.intervention_type === "both"
            ? "both"
            : "attendance",
      outreach_mode: r.outreach_mode,
      remarks: r.remarks,
      status: r.status,
      date:
        typeof r.date === "string"
          ? r.date
          : (r.date as unknown as Date).toISOString().slice(0, 10),
      performed_at:
        typeof r.performed_at === "string"
          ? r.performed_at
          : (r.performed_at as Date).toISOString(),
      staff_id: r.staff_id ?? null,
      uploader_name: r.uploader_name ?? null,
      uploader_email: r.uploader_email ?? null,
      uploader_pernr: r.uploader_pernr ?? null,
      case_type: hasCT ? caseTypeNorm : null,
      assignee_name: hasA ? r.assignee_name ?? null : null,
      assignee_pernr: hasA ? r.assignee_pernr ?? null : null,
      assignee_email: hasA ? r.assignee_email ?? null : null,
    };
  });
}

export async function deleteInterventionByIdFromDb(id: string): Promise<{ student_sap_id: string } | null> {
  if (!pool) return null;
  const res = await pool.query<{ student_sap_id: string }>(
    `DELETE FROM interventions WHERE id = $1 RETURNING student_sap_id`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function getInterventionByIdFromDb(
  id: string
): Promise<InterventionRow | null> {
  if (!pool) return null;
  const hasType = await hasInterventionTypeColumn();
  const res = await pool.query<{
    id: string;
    student_sap_id: string;
    date: string;
    intervention_type?: "attendance" | "gpa" | "both" | null;
    outreach_mode: string;
    remarks: string;
    status: string;
    performed_at: Date;
    staff_id: string | null;
    uploader_name: string | null;
    uploader_email: string | null;
    uploader_pernr: string | null;
  }>(
    hasType
      ? `SELECT i.id, i.student_sap_id, i.date, i.intervention_type, i.outreach_mode, i.remarks, i.status, i.performed_at, i.staff_id, s.name AS uploader_name, s.email AS uploader_email, s.pernr AS uploader_pernr
         FROM interventions i
         LEFT JOIN staff s ON s.id = i.staff_id
         WHERE i.id = $1
         LIMIT 1`
      : `SELECT i.id, i.student_sap_id, i.date, i.outreach_mode, i.remarks, i.status, i.performed_at, i.staff_id, s.name AS uploader_name, s.email AS uploader_email, s.pernr AS uploader_pernr
         FROM interventions i
         LEFT JOIN staff s ON s.id = i.staff_id
         WHERE i.id = $1
         LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    intervention_type:
      row.intervention_type === "gpa"
        ? "gpa"
        : row.intervention_type === "both"
          ? "both"
          : "attendance",
    date: typeof row.date === "string" ? row.date : (row.date as unknown as Date).toISOString().slice(0, 10),
    performed_at:
      typeof row.performed_at === "string"
        ? row.performed_at
        : (row.performed_at as Date).toISOString(),
    staff_id: row.staff_id ?? null,
    uploader_name: row.uploader_name ?? null,
    uploader_email: row.uploader_email ?? null,
    uploader_pernr: row.uploader_pernr ?? null,
  };
}

export async function updateInterventionByIdFromDb(
  id: string,
  data: {
    date: string;
    intervention_type: "attendance" | "gpa" | "both";
    outreach_mode: string;
    remarks: string;
    status: string;
  }
): Promise<{ student_sap_id: string } | null> {
  if (!pool) return null;
  const existing = await pool.query<{ student_sap_id: string }>(
    `SELECT student_sap_id FROM interventions WHERE id = $1 LIMIT 1`,
    [id]
  );
  const sapId = existing.rows[0]?.student_sap_id;
  if (!sapId) return null;
  await assertUniqueSgpaInterventionForCurrentTerm(sapId, data.intervention_type, {
    excludeId: id,
  });
  const hasType = await hasInterventionTypeColumn();
  const res = await pool.query<{ student_sap_id: string }>(
    hasType
      ? `UPDATE interventions
         SET
           date = $2::date,
           intervention_type = $3,
           outreach_mode = $4,
           remarks = $5,
           status = $6
         WHERE id = $1
         RETURNING student_sap_id`
      : `UPDATE interventions
         SET
           date = $2::date,
           outreach_mode = $4,
           remarks = $5,
           status = $6
         WHERE id = $1
         RETURNING student_sap_id`,
    [id, data.date, data.intervention_type, data.outreach_mode, data.remarks, data.status]
  );
  return res.rows[0] ?? null;
}

export type InterventionStatsCounts = {
  notStarted: number;
  initiated: number;
  "in-progress": number;
  referred: number;
  resolved: number;
  noActionRequired: number;
};

/** Batch: latest intervention status per student from DB. */
export async function getLatestInterventionStatusMapFromDb(
  sapIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!pool || !sapIds.length) {
    sapIds.forEach((id) => map.set(id, null));
    return map;
  }
  const normalizedSapIds = Array.from(new Set(sapIds.map(normalizeSapId)));
  const res = await pool.query<{ student_sap_id_norm: string; status: string }>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (normalize_sap_id) normalize_sap_id AS student_sap_id_norm, status
      FROM interventions
      CROSS JOIN LATERAL (
        SELECT COALESCE(NULLIF(REGEXP_REPLACE(TRIM(student_sap_id), '^0+', ''), ''), '0') AS normalize_sap_id
      ) norm
      WHERE normalize_sap_id = ANY($1)
      ORDER BY normalize_sap_id, performed_at DESC
    )
    SELECT student_sap_id_norm, status FROM latest
    `,
    [normalizedSapIds]
  );
  const latest = new Map(res.rows.map((r) => [r.student_sap_id_norm, r.status]));
  for (const id of sapIds) {
    map.set(id, latest.get(normalizeSapId(id)) ?? null);
  }
  return map;
}

/** Latest intervention status per student from the interventions table. */
export async function getInterventionStatsForStudentsFromDb(
  sapIds: string[]
): Promise<InterventionStatsCounts> {
  const base: InterventionStatsCounts = {
    notStarted: sapIds.length,
    initiated: 0,
    "in-progress": 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
  };

  if (!pool || !sapIds.length) return base;

  const normalizedSapIds = Array.from(new Set(sapIds.map(normalizeSapId)));
  const res = await pool.query<{
    student_sap_id_norm: string;
    status: string | null;
  }>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (student_sap_id_norm)
        COALESCE(NULLIF(REGEXP_REPLACE(TRIM(student_sap_id), '^0+', ''), ''), '0') AS student_sap_id_norm,
        status
      FROM interventions
      WHERE COALESCE(NULLIF(REGEXP_REPLACE(TRIM(student_sap_id), '^0+', ''), ''), '0') = ANY($1)
      ORDER BY student_sap_id_norm, performed_at DESC
    )
    SELECT student_sap_id_norm, status
    FROM latest
    `,
    [normalizedSapIds]
  );

  const latest = new Map(res.rows.map((r) => [r.student_sap_id_norm, r.status]));

  let notStarted = 0;
  let initiated = 0;
  let inProgress = 0;
  let referred = 0;
  let resolved = 0;
  let noActionRequired = 0;

  for (const id of sapIds) {
    const status = latest.get(normalizeSapId(id));
    if (!status) {
      notStarted += 1;
      continue;
    }
    if (status === "initiated") initiated += 1;
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

export type InterventionRoleScope = {
  role: "dean" | "hod" | "teacher" | "superadmin";
  interventionType: "attendance" | "gpa" | "all";
  alertLevel?: "warning" | "critical" | null;
  facultyId?: string | null;
  departmentIds?: string[] | null;
  courseIds?: string[] | null;
  instructorIds?: string[] | null; // instructor_pernr values from enrollment
  staffId?: string | null; // staff.id (UUID) for instructors
  /** When set, count only interventions linked to that semester's enrollment. */
  term?: AcademicTermScope | null;
};

export type InterventionRoleScopeStats = {
  notStarted: number;
  initiated: number;
  inProgress: number;
  referred: number;
  resolved: number;
  noActionRequired: number;
  totalInterventionStudents: number;
};

function isAcademicTermScope(
  value: AcademicTermScope | null | undefined
): value is AcademicTermScope {
  return value === "current" || value === "previous";
}

/**
 * Scope interventions to a semester via enrollment term_year + term_session
 * (SAP_PYEAR / SAP_PSESS), not the intervention calendar date.
 *
 * Current-term leftover protection: if the same student+course also exists in an
 * earlier term, the row belongs to that earlier offering (Fall re-enrolment of a
 * Spring/Summer course must not pull old interventions into Fall).
 */
function appendInterventionTermScopeSql(
  alias: string,
  term?: AcademicTermScope | null
): string {
  if (!isAcademicTermScope(term)) return "";
  const i = alias || "interventions";
  const academicTerm = getAcademicTermForScope(term);
  const sapMatch = normalizeSapIdCompareSql(
    `${i}.student_sap_id`,
    "e_term.sap_id"
  );
  const courseMatch = interventionCourseMatchesEnrollmentSql({
    interventionAlias: i,
    enrollmentAlias: "e_term",
  });
  const termPred = enrolledInTermSql("e_term", academicTerm, {
    requireActive: false,
  });

  let sql = ` AND EXISTS (
    SELECT 1
    FROM student_enrollment_current e_term
    WHERE ${termPred}
      AND ${sapMatch}
      AND ${courseMatch}
  )`;

  if (term === "current") {
    const currentPred = enrolledInTermSql("e_prev", academicTerm, {
      requireActive: false,
    });
    const sapPrev = normalizeSapIdCompareSql(
      `${i}.student_sap_id`,
      "e_prev.sap_id"
    );
    const coursePrev = interventionCourseMatchesEnrollmentSql({
      interventionAlias: i,
      enrollmentAlias: "e_prev",
    });
    sql += ` AND NOT EXISTS (
      SELECT 1
      FROM student_enrollment_current e_prev
      WHERE ${sapPrev}
        AND ${coursePrev}
        AND NOT (${currentPred})
    )`;
  }

  return sql;
}

/**
 * DB-backed counts using only role scope columns.
 * Latest intervention status is calculated per student via performed_at DESC.
 */
export async function getInterventionStatsForRoleScopeFromDb(
  params: InterventionRoleScope
): Promise<InterventionRoleScopeStats> {
  const hasType = await hasInterventionTypeColumn();
  const hasAlertLevel = await hasAlertLevelColumn();
  const wantsGpa = params.interventionType === "gpa";
  const usesTypeParam = hasType && params.interventionType !== "all";

  // Old DBs may not have intervention_type; treat missing column as 'attendance'.
  if (!hasType && wantsGpa) {
    return {
      notStarted: 0,
      initiated: 0,
      inProgress: 0,
      referred: 0,
      resolved: 0,
      noActionRequired: 0,
      totalInterventionStudents: 0,
    };
  }

  if (!pool) {
    return {
      notStarted: 0,
      initiated: 0,
      inProgress: 0,
      referred: 0,
      resolved: 0,
      noActionRequired: 0,
      totalInterventionStudents: 0,
    };
  }

  const wantsAlertFilterGlobal =
    hasAlertLevel && params.alertLevel != null ? true : false;

  /**
   * Superadmin counts across latest intervention status per student.
   * Unlike legacy behavior, optional master-filter scope params (department/course/instructor/faculty)
   * are applied so dashboard instructor/course filters stay consistent with overview cards.
   */
  if (params.role === "superadmin") {
    const typeWhereSql = usesTypeParam
      ? params.interventionType === "gpa"
        ? "(intervention_type = $1 OR intervention_type = 'both')"
        : "(COALESCE(intervention_type, 'attendance') = $1 OR intervention_type = 'both')"
      : "TRUE";
    const argsSuper: any[] = usesTypeParam ? [params.interventionType] : [];
    const wherePartsSuper: string[] = [];

    const facultyId = String(params.facultyId ?? "").trim();
    if (facultyId) {
      argsSuper.push(facultyId);
      wherePartsSuper.push(`faculty_id = $${argsSuper.length}`);
    }
    const departmentIds = (params.departmentIds ?? []).filter(Boolean);
    if (departmentIds.length) {
      argsSuper.push(departmentIds);
      wherePartsSuper.push(`department_id = ANY($${argsSuper.length}::text[])`);
    }
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      argsSuper.push(courseIds);
      wherePartsSuper.push(`course_id = ANY($${argsSuper.length}::text[])`);
    }
    const instructorIds = (params.instructorIds ?? []).filter(Boolean);
    if (instructorIds.length) {
      argsSuper.push(instructorIds);
      wherePartsSuper.push(
        `EXISTS (
          SELECT 1
          FROM student_enrollment_current e
          WHERE e.is_active = TRUE
            AND e.sap_id = interventions.student_sap_id
            AND e.course_id = interventions.course_id
            AND e.instructor_pernr = ANY($${argsSuper.length}::text[])
        )`
      );
    }

    const scopedWhereSuper = wherePartsSuper.length
      ? `${typeWhereSql} AND ${wherePartsSuper.join(" AND ")}`
      : typeWhereSql;
    const termSqlSuper = appendInterventionTermScopeSql("", params.term);
    const outerIdx = argsSuper.length + 1;

    const resSuper = await pool.query<{
      status: string;
      cnt: string;
    }>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (student_sap_id)
          student_sap_id,
          status${wantsAlertFilterGlobal ? ", alert_level" : ""}
        FROM interventions
        WHERE ${scopedWhereSuper}${termSqlSuper}
        ORDER BY student_sap_id, performed_at DESC
      )
      SELECT status, COUNT(*)::int AS cnt
      FROM latest
      ${wantsAlertFilterGlobal ? `WHERE alert_level = $${outerIdx}` : ""}
      GROUP BY status
      `,
      wantsAlertFilterGlobal
        ? [...argsSuper, params.alertLevel as any]
        : argsSuper,
    );

    const countsSuper = {
      notStarted: 0,
      initiated: 0,
      inProgress: 0,
      referred: 0,
      resolved: 0,
      noActionRequired: 0,
    };
    for (const row of resSuper.rows) {
      const n = Number(row.cnt) || 0;
      if (row.status === "not_started" || row.status === "not-started") {
        countsSuper.notStarted = n;
      } else if (row.status === "initiated") countsSuper.initiated = n;
      else if (row.status === "in-progress") countsSuper.inProgress = n;
      else if (row.status === "referred") countsSuper.referred = n;
      else if (row.status === "resolved") countsSuper.resolved = n;
      else if (row.status === "no-action-required")
        countsSuper.noActionRequired = n;
    }
    const totalSuper =
      countsSuper.notStarted +
      countsSuper.initiated +
      countsSuper.inProgress +
      countsSuper.referred +
      countsSuper.resolved +
      countsSuper.noActionRequired;
    return { ...countsSuper, totalInterventionStudents: totalSuper };
  }

  const whereParts: string[] = [];
  let args: any[] = usesTypeParam ? [params.interventionType] : [];
  const FACULTY_ID_TO_ENROLLMENT_FAC_ID: Record<string, string> = {
    FAC_ENG: "50000172",
    FAC_MGT: "50000172",
  };

  if (params.role === "dean") {
    if (!params.facultyId) {
      return EMPTY_ROLE_SCOPE_STATS;
    }
    const mappedFacultyId =
      FACULTY_ID_TO_ENROLLMENT_FAC_ID[params.facultyId] ?? params.facultyId;
    args = [...args, mappedFacultyId];
    whereParts.push(`faculty_id = $${args.length}`);
  } else if (params.role === "hod") {
    const deptIds = params.departmentIds ?? [];
    if (!deptIds.length) {
      return EMPTY_ROLE_SCOPE_STATS;
    }
    args = [...args, deptIds];
    whereParts.push(`department_id = ANY($${args.length})`);
  } else {
    // teacher
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      args = [...args, courseIds];
      whereParts.push(`course_id = ANY($${args.length})`);
    } else if (!params.staffId) {
      return EMPTY_ROLE_SCOPE_STATS;
    } else {
      // Backward-compatible fallback if course IDs are unavailable.
      args = [...args, params.staffId];
      whereParts.push(`staff_id = $${args.length}`);
    }
  }

  const departmentIds = (params.departmentIds ?? []).filter(Boolean);
  if (departmentIds.length && params.role !== "hod") {
    args = [...args, departmentIds];
    whereParts.push(`department_id = ANY($${args.length})`);
  }

  const courseIds = (params.courseIds ?? []).filter(Boolean);
  if (courseIds.length && params.role !== "teacher") {
    args = [...args, courseIds];
    whereParts.push(`course_id = ANY($${args.length})`);
  }

  const instructorIds = (params.instructorIds ?? []).filter(Boolean);
  if (instructorIds.length) {
    args = [...args, instructorIds];
    whereParts.push(
      `EXISTS (
        SELECT 1
        FROM student_enrollment_current e
        WHERE e.is_active = TRUE
          AND e.sap_id = interventions.student_sap_id
          AND e.course_id = interventions.course_id
          AND e.instructor_pernr = ANY($${args.length}::text[])
      )`
    );
  }

  const whereSql = whereParts.length ? whereParts.join(" AND ") : "TRUE";

  // Include `intervention_type = 'both'` (from Intervention-Form) in attendance and GPA buckets.
  const interventionTypeFilterSql = usesTypeParam
    ? params.interventionType === "gpa"
      ? "(intervention_type = $1 OR intervention_type = 'both') AND "
      : "(COALESCE(intervention_type, 'attendance') = $1 OR intervention_type = 'both') AND "
    : "";

  const wantsAlertFilter =
    hasAlertLevel && params.alertLevel != null ? true : false;

  const termSql = appendInterventionTermScopeSql("", params.term);
  const outerPlaceholderIndex = args.length + 1;

  const res = await pool.query<{
    status: string;
    cnt: string;
  }>(
    `
    WITH latest AS (
      SELECT DISTINCT ON (student_sap_id)
        student_sap_id,
        status${
          wantsAlertFilter ? ", alert_level" : ""
        }
      FROM interventions
      WHERE ${interventionTypeFilterSql}${whereSql}${termSql}
      ORDER BY student_sap_id, performed_at DESC
    )
    SELECT status, COUNT(*)::int AS cnt
    FROM latest
    ${wantsAlertFilter ? `WHERE alert_level = $${outerPlaceholderIndex}` : ""}
    GROUP BY status
    `,
    wantsAlertFilter ? [...args, params.alertLevel as any] : args
  );

  return roleScopeCountsFromStatusRows(res.rows);
}

function roleScopeCountsFromStatusRows(
  rows: { status: string; cnt: string | number }[]
): InterventionRoleScopeStats {
  const counts = {
    notStarted: 0,
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
  };
  for (const row of rows) {
    const n = Number(row.cnt) || 0;
    if (row.status === "not_started" || row.status === "not-started") {
      counts.notStarted = n;
    } else if (row.status === "initiated") counts.initiated = n;
    else if (row.status === "in-progress") counts.inProgress = n;
    else if (row.status === "referred") counts.referred = n;
    else if (row.status === "resolved") counts.resolved = n;
    else if (row.status === "no-action-required") counts.noActionRequired = n;
  }
  const totalInterventionStudents =
    counts.notStarted +
    counts.initiated +
    counts.inProgress +
    counts.referred +
    counts.resolved +
    counts.noActionRequired;
  return { ...counts, totalInterventionStudents };
}

const EMPTY_ROLE_SCOPE_STATS: InterventionRoleScopeStats = {
  notStarted: 0,
  initiated: 0,
  inProgress: 0,
  referred: 0,
  resolved: 0,
  noActionRequired: 0,
  totalInterventionStudents: 0,
};

/**
 * Counts every intervention row by status (matches superadmin interventions list).
 * Unlike `getInterventionStatsForRoleScopeFromDb`, does not dedupe to latest per student.
 */
export async function getInterventionRecordStatsForRoleScopeFromDb(
  params: InterventionRoleScope
): Promise<InterventionRoleScopeStats> {
  const hasType = await hasInterventionTypeColumn();
  const hasAlertLevel = await hasAlertLevelColumn();
  const wantsGpa = params.interventionType === "gpa";
  const usesTypeParam = hasType && params.interventionType !== "all";

  if (!hasType && wantsGpa) return EMPTY_ROLE_SCOPE_STATS;
  if (!pool) return EMPTY_ROLE_SCOPE_STATS;

  const wantsAlertFilterGlobal =
    hasAlertLevel && params.alertLevel != null ? true : false;

  if (params.role === "superadmin") {
    const typeWhereSql = usesTypeParam
      ? params.interventionType === "gpa"
        ? "(intervention_type = $1 OR intervention_type = 'both')"
        : "(COALESCE(intervention_type, 'attendance') = $1 OR intervention_type = 'both')"
      : "TRUE";
    const argsSuper: unknown[] = usesTypeParam ? [params.interventionType] : [];
    const wherePartsSuper: string[] = [];

    const facultyId = String(params.facultyId ?? "").trim();
    if (facultyId) {
      argsSuper.push(facultyId);
      wherePartsSuper.push(`faculty_id = $${argsSuper.length}`);
    }
    const departmentIds = (params.departmentIds ?? []).filter(Boolean);
    if (departmentIds.length) {
      argsSuper.push(departmentIds);
      wherePartsSuper.push(`department_id = ANY($${argsSuper.length}::text[])`);
    }
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      argsSuper.push(courseIds);
      wherePartsSuper.push(`course_id = ANY($${argsSuper.length}::text[])`);
    }
    const instructorIds = (params.instructorIds ?? []).filter(Boolean);
    if (instructorIds.length) {
      argsSuper.push(instructorIds);
      wherePartsSuper.push(
        `EXISTS (
          SELECT 1
          FROM student_enrollment_current e
          WHERE e.is_active = TRUE
            AND e.sap_id = interventions.student_sap_id
            AND e.course_id = interventions.course_id
            AND e.instructor_pernr = ANY($${argsSuper.length}::text[])
        )`
      );
    }

    const scopedWhereSuper = wherePartsSuper.length
      ? `${typeWhereSql} AND ${wherePartsSuper.join(" AND ")}`
      : typeWhereSql;
    const termSqlSuper = appendInterventionTermScopeSql("", params.term);
    const outerIdx = argsSuper.length + 1;
    const alertSql = wantsAlertFilterGlobal
      ? ` AND alert_level = $${outerIdx}`
      : "";

    const resSuper = await pool.query<{ status: string; cnt: string }>(
      `
      SELECT status, COUNT(*)::int AS cnt
      FROM interventions
      WHERE ${scopedWhereSuper}${termSqlSuper}${alertSql}
      GROUP BY status
      `,
      wantsAlertFilterGlobal
        ? [...argsSuper, params.alertLevel as string]
        : argsSuper
    );

    return roleScopeCountsFromStatusRows(resSuper.rows);
  }

  const whereParts: string[] = [];
  let args: unknown[] = usesTypeParam ? [params.interventionType] : [];
  const FACULTY_ID_TO_ENROLLMENT_FAC_ID: Record<string, string> = {
    FAC_ENG: "50000172",
    FAC_MGT: "50000172",
  };

  if (params.role === "dean") {
    if (!params.facultyId) return EMPTY_ROLE_SCOPE_STATS;
    const mappedFacultyId =
      FACULTY_ID_TO_ENROLLMENT_FAC_ID[params.facultyId] ?? params.facultyId;
    args = [...args, mappedFacultyId];
    whereParts.push(`faculty_id = $${args.length}`);
  } else if (params.role === "hod") {
    const deptIds = params.departmentIds ?? [];
    if (!deptIds.length) return EMPTY_ROLE_SCOPE_STATS;
    args = [...args, deptIds];
    whereParts.push(`department_id = ANY($${args.length})`);
  } else {
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      args = [...args, courseIds];
      whereParts.push(`course_id = ANY($${args.length})`);
    } else if (!params.staffId) {
      return EMPTY_ROLE_SCOPE_STATS;
    } else {
      args = [...args, params.staffId];
      whereParts.push(`staff_id = $${args.length}`);
    }
  }

  const departmentIds = (params.departmentIds ?? []).filter(Boolean);
  if (departmentIds.length && params.role !== "hod") {
    args = [...args, departmentIds];
    whereParts.push(`department_id = ANY($${args.length})`);
  }

  const courseIds = (params.courseIds ?? []).filter(Boolean);
  if (courseIds.length && params.role !== "teacher") {
    args = [...args, courseIds];
    whereParts.push(`course_id = ANY($${args.length})`);
  }

  const instructorIds = (params.instructorIds ?? []).filter(Boolean);
  if (instructorIds.length) {
    args = [...args, instructorIds];
    whereParts.push(
      `EXISTS (
        SELECT 1
        FROM student_enrollment_current e
        WHERE e.is_active = TRUE
          AND e.sap_id = interventions.student_sap_id
          AND e.course_id = interventions.course_id
          AND e.instructor_pernr = ANY($${args.length}::text[])
      )`
    );
  }

  const whereSql = whereParts.length ? whereParts.join(" AND ") : "TRUE";
  const interventionTypeFilterSql = usesTypeParam
    ? params.interventionType === "gpa"
      ? "(intervention_type = $1 OR intervention_type = 'both') AND "
      : "(COALESCE(intervention_type, 'attendance') = $1 OR intervention_type = 'both') AND "
    : "";
  const wantsAlertFilter =
    hasAlertLevel && params.alertLevel != null ? true : false;
  const termSql = appendInterventionTermScopeSql("", params.term);
  const outerPlaceholderIndex = args.length + 1;
  const alertSql = wantsAlertFilter
    ? ` AND alert_level = $${outerPlaceholderIndex}`
    : "";

  const res = await pool.query<{ status: string; cnt: string }>(
    `
    SELECT status, COUNT(*)::int AS cnt
    FROM interventions
    WHERE ${interventionTypeFilterSql}${whereSql}${termSql}${alertSql}
    GROUP BY status
    `,
    wantsAlertFilter ? [...args, params.alertLevel as string] : args
  );

  return roleScopeCountsFromStatusRows(res.rows);
}

const FACULTY_ID_TO_INTERVENTION_FAC_ID: Record<string, string> = {
  FAC_ENG: "50000172",
  FAC_MGT: "50000172",
};

/** Role + master-filter scope for matching rows in `interventions` (chart record counts). */
export function buildInterventionRecordScopeSql(
  alias: string,
  params: Omit<InterventionRoleScope, "interventionType" | "alertLevel">,
  args: unknown[]
): string | null {
  const col = (name: string) => `${alias}.${name}`;
  const parts: string[] = [];

  if (params.role === "dean") {
    if (!params.facultyId) return null;
    const mappedFacultyId =
      FACULTY_ID_TO_INTERVENTION_FAC_ID[params.facultyId] ?? params.facultyId;
    args.push(mappedFacultyId);
    parts.push(`${col("faculty_id")} = $${args.length}`);
  } else if (params.role === "hod") {
    const deptIds = params.departmentIds ?? [];
    if (!deptIds.length) return null;
    args.push(deptIds);
    parts.push(`${col("department_id")} = ANY($${args.length}::text[])`);
  } else if (params.role === "teacher") {
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      args.push(courseIds);
      parts.push(`${col("course_id")} = ANY($${args.length}::text[])`);
    } else if (!params.staffId) {
      return null;
    } else {
      args.push(params.staffId);
      parts.push(`${col("staff_id")} = $${args.length}`);
    }
  } else if (params.role === "superadmin") {
    const facultyId = String(params.facultyId ?? "").trim();
    if (facultyId) {
      args.push(facultyId);
      parts.push(`${col("faculty_id")} = $${args.length}`);
    }
    const departmentIds = (params.departmentIds ?? []).filter(Boolean);
    if (departmentIds.length) {
      args.push(departmentIds);
      parts.push(`${col("department_id")} = ANY($${args.length}::text[])`);
    }
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (courseIds.length) {
      args.push(courseIds);
      parts.push(`${col("course_id")} = ANY($${args.length}::text[])`);
    }
    if (!parts.length) return "TRUE";
  } else {
    return null;
  }

  const departmentIds = (params.departmentIds ?? []).filter(Boolean);
  if (departmentIds.length && params.role !== "hod") {
    args.push(departmentIds);
    parts.push(`${col("department_id")} = ANY($${args.length}::text[])`);
  }

  const courseIds = (params.courseIds ?? []).filter(Boolean);
  if (courseIds.length && params.role !== "teacher") {
    args.push(courseIds);
    parts.push(`${col("course_id")} = ANY($${args.length}::text[])`);
  }

  const instructorIds = (params.instructorIds ?? []).filter(Boolean);
  if (instructorIds.length) {
    args.push(instructorIds);
    parts.push(
      `EXISTS (
        SELECT 1
        FROM student_enrollment_current e_scope
        WHERE ${enrolledInCurrentTermSql("e_scope")}
          AND e_scope.sap_id = ${col("student_sap_id")}
          AND e_scope.course_id = ${col("course_id")}
          AND e_scope.instructor_pernr = ANY($${args.length}::text[])
      )`
    );
  }

  return parts.length ? parts.join(" AND ") : "TRUE";
}

export function normalizeSapIdCompareSql(left: string, right: string): string {
  return `COALESCE(NULLIF(REGEXP_REPLACE(TRIM(${left}), '^0+', ''), ''), '0')
      = COALESCE(NULLIF(REGEXP_REPLACE(TRIM(${right}), '^0+', ''), ''), '0')`;
}

/** Course match allowing optional `|program` suffix (e.g. ISL04203|11 ↔ ISL04203). */
export function interventionCourseMatchesEnrollmentSql(opts: {
  interventionAlias?: string;
  enrollmentAlias?: string;
}): string {
  const i = opts.interventionAlias ?? "i";
  const e = opts.enrollmentAlias ?? "e";
  const iBase = `SPLIT_PART(COALESCE(NULLIF(TRIM(${i}.course_id), ''), ''), '|', 1)`;
  const eBase = `SPLIT_PART(COALESCE(NULLIF(TRIM(${e}.course_id), ''), ''), '|', 1)`;
  return `(
    COALESCE(NULLIF(TRIM(${i}.course_id), ''), '') = ''
    OR ${i}.course_id = ${e}.course_id
    OR ${iBase} = ${eBase}
  )`;
}

/** True when this enrollment row is a student+course that has an intervention. */
export function subjectLinkedInterventionExistsSql(opts: {
  hasSectionCode: boolean;
  interventionAlias?: string;
  enrollmentAlias?: string;
}): string {
  const i = opts.interventionAlias ?? "ix";
  const e = opts.enrollmentAlias ?? "e";
  const matchSql = interventionMatchesAlertedEnrollmentSql({
    hasSectionCode: opts.hasSectionCode,
    interventionAlias: i,
    enrollmentAlias: e,
  });
  return `EXISTS (
    SELECT 1
    FROM interventions ${i}
    WHERE ${matchSql}
      AND COALESCE(NULLIF(TRIM(${i}.course_id), ''), '') <> ''
  )`;
}

/** Intervention row tied to the enrollment/alert course (listing join semantics). */
export function interventionMatchesAlertedEnrollmentSql(opts: {
  hasSectionCode: boolean;
  interventionAlias?: string;
  enrollmentAlias?: string;
}): string {
  const i = opts.interventionAlias ?? "i";
  const e = opts.enrollmentAlias ?? "e";
  const sectionSql = opts.hasSectionCode
    ? `AND (
         COALESCE(NULLIF(TRIM(${i}.section_code), ''), '') = ''
         OR COALESCE(${i}.section_code, '') = COALESCE(${e}.section_code, '')
       )`
    : "";
  return `${normalizeSapIdCompareSql(`${i}.student_sap_id`, `${e}.sap_id`)}
      AND ${interventionCourseMatchesEnrollmentSql({ interventionAlias: i, enrollmentAlias: e })}
      ${sectionSql}`;
}

/** Same student + course (+ section); used for table filters so rows match displayed status. */
export function strictInterventionEnrollmentMatchSql(opts: {
  hasSectionCode: boolean;
  interventionAlias?: string;
  enrollmentAlias?: string;
}): string {
  const i = opts.interventionAlias ?? "i";
  const e = opts.enrollmentAlias ?? "e";
  const sectionSql = opts.hasSectionCode
    ? `AND COALESCE(${i}.section_code, '') = COALESCE(${e}.section_code, '')`
    : "";
  return `${normalizeSapIdCompareSql(`${i}.student_sap_id`, `${e}.sap_id`)}
      AND ${i}.course_id = ${e}.course_id
      ${sectionSql}`;
}

function buildAlertRowFilterSql(
  params: InterventionRoleScope
): string {
  if (params.interventionType === "gpa") {
    if (params.alertLevel === "warning") {
      return "a.gpa_alert_level = 'warning'";
    }
    if (params.alertLevel === "critical") {
      return "a.gpa_alert_level = 'critical'";
    }
    return "a.gpa_alert_level IS NOT NULL";
  }
  if (params.interventionType === "attendance") {
    if (params.alertLevel === "warning") {
      return "a.attendance_alert_level = 'warning'";
    }
    if (params.alertLevel === "critical") {
      return "a.attendance_alert_level = 'critical'";
    }
    return "a.attendance_alert_level IS NOT NULL";
  }
  if (params.alertLevel === "warning") {
    return "(a.gpa_alert_level = 'warning' OR a.attendance_alert_level = 'warning')";
  }
  if (params.alertLevel === "critical") {
    return "(a.gpa_alert_level = 'critical' OR a.attendance_alert_level = 'critical')";
  }
  return "(a.gpa_alert_level IS NOT NULL OR a.attendance_alert_level IS NOT NULL)";
}

function buildInterventionExistsScopeSql(
  params: InterventionRoleScope,
  args: unknown[]
): string | null {
  return buildInterventionRecordScopeSql("i", params, args);
}

function buildEnrollmentScopeSql(
  params: InterventionRoleScope,
  args: unknown[]
): string | null {
  const term = isAcademicTermScope(params.term) ? params.term : "current";
  const parts = [
    enrolledInTermSql("e", getAcademicTermForScope(term), {
      requireActive: term !== "previous",
    }),
  ];
  if (params.role === "dean") {
    if (!params.facultyId) return null;
    const mappedFacultyId =
      FACULTY_ID_TO_INTERVENTION_FAC_ID[params.facultyId] ?? params.facultyId;
    args.push(mappedFacultyId);
    parts.push(`e.faculty_id = $${args.length}`);
  } else if (params.role === "hod") {
    const deptIds = params.departmentIds ?? [];
    if (!deptIds.length) return null;
    args.push(deptIds);
    parts.push(`e.department_id = ANY($${args.length}::text[])`);
  } else if (params.role === "teacher") {
    const courseIds = (params.courseIds ?? []).filter(Boolean);
    if (!courseIds.length) return null;
    args.push(courseIds);
    parts.push(`e.course_id = ANY($${args.length}::text[])`);
  }

  const departmentIds = (params.departmentIds ?? []).filter(Boolean);
  if (departmentIds.length && params.role !== "hod") {
    args.push(departmentIds);
    parts.push(`e.department_id = ANY($${args.length}::text[])`);
  }
  const courseIds = (params.courseIds ?? []).filter(Boolean);
  if (courseIds.length && params.role !== "teacher") {
    args.push(courseIds);
    parts.push(`e.course_id = ANY($${args.length}::text[])`);
  }
  const instructorIds = (params.instructorIds ?? []).filter(Boolean);
  if (instructorIds.length) {
    args.push(instructorIds);
    parts.push(`e.instructor_pernr = ANY($${args.length}::text[])`);
  }

  return parts.join(" AND ");
}

/**
 * Distinct students in the latest alert snapshot with at least one alert and no
 * intervention recorded against that alerted course (scoped to role/master filters).
 */
export async function getAlertedWithoutInterventionCountForRoleScopeFromDb(
  params: InterventionRoleScope
): Promise<number> {
  if (!pool) return 0;

  const hasSectionCode = await hasSectionCodeColumn();
  const args: unknown[] = [];
  const enrollmentScope = buildEnrollmentScopeSql(params, args);
  const interventionScope = buildInterventionRecordScopeSql("i", params, args);
  if (!enrollmentScope || !interventionScope) return 0;

  const alertFilter = buildAlertRowFilterSql(params);
  const courseMatchSql = interventionMatchesAlertedEnrollmentSql({
    hasSectionCode,
    interventionAlias: "i",
    enrollmentAlias: "e",
  });
  const termDateSql = appendInterventionTermScopeSql("i", params.term);
  const res = await pool.query<{ cnt: string }>(
    `
    SELECT COUNT(DISTINCT e.sap_id)::int AS cnt
    FROM student_enrollment_current e
    INNER JOIN student_alert_current a
      ON a.sap_id = e.sap_id
     AND a.course_id = e.course_id
     AND a.section_code = e.section_code
     AND a.event_package_id = e.event_package_id
    WHERE ${enrollmentScope}
      AND ${alertFilter}
      AND NOT EXISTS (
        SELECT 1
        FROM interventions i
        WHERE ${courseMatchSql}
          AND (${interventionScope})
          ${termDateSql}
      )
    `,
    args
  );

  return Number(res.rows[0]?.cnt ?? 0);
}

export type InterventionListFilters = {
  facultyId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  courseId?: string | null;
  status?: string | null;
};

export type InterventionListItem = {
  id: string;
  student_sap_id: string;
  student_name: string | null;
  date: string;
  intervention_type: "attendance" | "gpa" | "both";
  alert_level: "warning" | "critical" | null;
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at: string;
  faculty_id: string | null;
  faculty_name: string | null;
  department_id: string | null;
  department_name: string | null;
  course_id: string | null;
  course_title: string | null;
  program_id: string | null;
  program_title: string | null;
  uploader_name: string | null;
  case_type: "referred" | "internal" | "external" | null;
};

export type InterventionListStats = {
  total: number;
  initiated: number;
  inProgress: number;
  referred: number;
  resolved: number;
  noActionRequired: number;
};

function buildInterventionListWhere(
  filters: InterventionListFilters,
  alias = "i"
): { sql: string; args: unknown[] } {
  const parts: string[] = [];
  const args: unknown[] = [];

  const facultyId = String(filters.facultyId ?? "").trim();
  if (facultyId) {
    args.push(facultyId);
    parts.push(`${alias}.faculty_id = $${args.length}`);
  }

  const departmentId = String(filters.departmentId ?? "").trim();
  if (departmentId) {
    args.push(departmentId);
    parts.push(`${alias}.department_id = $${args.length}`);
  }

  const programId = String(filters.programId ?? "").trim();
  if (programId) {
    args.push(programId);
    parts.push(`EXISTS (
      SELECT 1
      FROM courses c_prog
      WHERE c_prog.id = ${alias}.course_id
        AND c_prog.program_id = $${args.length}
    )`);
  }

  const courseId = String(filters.courseId ?? "").trim();
  if (courseId) {
    args.push(courseId);
    parts.push(`${alias}.course_id = $${args.length}`);
  }

  const status = String(filters.status ?? "").trim();
  if (status && status !== "all") {
    args.push(status);
    parts.push(`${alias}.status = $${args.length}`);
  }

  return {
    sql: parts.length ? parts.join(" AND ") : "TRUE",
    args,
  };
}

function mapInterventionListRow(
  r: Record<string, unknown>,
  hasCaseType: boolean
): InterventionListItem {
  const interventionType = r.intervention_type;
  const caseType = r.case_type;
  const date = r.date;
  const performedAt = r.performed_at;

  return {
    id: String(r.id),
    student_sap_id: String(r.student_sap_id),
    student_name: r.student_name != null ? String(r.student_name) : null,
    date:
      typeof date === "string"
        ? date
        : date instanceof Date
          ? date.toISOString().slice(0, 10)
          : String(date ?? ""),
    intervention_type:
      interventionType === "gpa"
        ? "gpa"
        : interventionType === "both"
          ? "both"
          : "attendance",
    alert_level:
      r.alert_level === "warning" || r.alert_level === "critical"
        ? r.alert_level
        : null,
    outreach_mode: String(r.outreach_mode ?? ""),
    remarks: String(r.remarks ?? ""),
    status: String(r.status ?? ""),
    performed_at:
      typeof performedAt === "string"
        ? performedAt
        : performedAt instanceof Date
          ? performedAt.toISOString()
          : String(performedAt ?? ""),
    faculty_id: r.faculty_id != null ? String(r.faculty_id) : null,
    faculty_name: r.faculty_name != null ? String(r.faculty_name) : null,
    department_id: r.department_id != null ? String(r.department_id) : null,
    department_name: r.department_name != null ? String(r.department_name) : null,
    course_id: r.course_id != null ? String(r.course_id) : null,
    course_title: r.course_title != null ? String(r.course_title) : null,
    program_id: r.program_id != null ? String(r.program_id) : null,
    program_title: r.program_title != null ? String(r.program_title) : null,
    uploader_name: r.uploader_name != null ? String(r.uploader_name) : null,
    case_type: hasCaseType
      ? caseType === "internal" || caseType === "external"
        ? caseType
        : caseType === "referred"
          ? "referred"
          : null
      : null,
  };
}

/** Paginated intervention list for superadmin directory (newest first). */
export async function getInterventionsListFromDb(
  filters: InterventionListFilters,
  opts?: { page?: number; pageSize?: number }
): Promise<{ rows: InterventionListItem[]; total: number }> {
  if (!pool) return { rows: [], total: 0 };

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const hasType = await hasInterventionTypeColumn();
  const hasAlertLevel = await hasAlertLevelColumn();
  const hasCT = await hasCaseTypeColumn();
  const { sql: whereSql, args } = buildInterventionListWhere(filters);

  const countRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::int AS total FROM interventions i WHERE ${whereSql}`,
    args
  );
  const total = Number(countRes.rows[0]?.total) || 0;

  const selectParts = [
    "i.id",
    "i.student_sap_id",
    "st.full_name AS student_name",
    "i.date",
  ];
  if (hasType) selectParts.push("i.intervention_type");
  if (hasAlertLevel) selectParts.push("i.alert_level");
  if (hasCT) selectParts.push("i.case_type");
  selectParts.push(
    "i.outreach_mode",
    "i.remarks",
    "i.status",
    "i.performed_at",
    "i.faculty_id",
    "f.name AS faculty_name",
    "i.department_id",
    "d.name AS department_name",
    "i.course_id",
    "c.title AS course_title",
    "c.program_id",
    "p.title AS program_title",
    "s.name AS uploader_name"
  );

  const listArgs = [...args, pageSize, offset];
  const limitIdx = args.length + 1;
  const offsetIdx = args.length + 2;

  const res = await pool.query(
    `
    SELECT ${selectParts.join(", ")}
    FROM interventions i
    LEFT JOIN students st ON st.sap_id = i.student_sap_id
    LEFT JOIN faculties f ON f.id = i.faculty_id
    LEFT JOIN departments d ON d.id = i.department_id
    LEFT JOIN courses c ON c.id = i.course_id
    LEFT JOIN programs p ON p.id = c.program_id
    LEFT JOIN staff s ON s.id = i.staff_id
    WHERE ${whereSql}
    ORDER BY i.performed_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listArgs
  );

  return {
    rows: res.rows.map((row) => mapInterventionListRow(row, hasCT)),
    total,
  };
}

/** Status breakdown for superadmin intervention list filters. */
export async function getInterventionListStatsFromDb(
  filters: InterventionListFilters
): Promise<InterventionListStats> {
  const empty: InterventionListStats = {
    total: 0,
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
  };
  if (!pool) return empty;

  const { sql: whereSql, args } = buildInterventionListWhere(filters);

  const res = await pool.query<{ status: string; cnt: string }>(
    `
    SELECT status, COUNT(*)::int AS cnt
    FROM interventions i
    WHERE ${whereSql}
    GROUP BY status
    `,
    args
  );

  const stats = { ...empty };
  for (const row of res.rows) {
    const n = Number(row.cnt) || 0;
    stats.total += n;
    if (row.status === "initiated") stats.initiated = n;
    else if (row.status === "in-progress") stats.inProgress = n;
    else if (row.status === "referred") stats.referred = n;
    else if (row.status === "resolved") stats.resolved = n;
    else if (row.status === "no-action-required") stats.noActionRequired = n;
  }

  return stats;
}

