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

/** Single intervention row as returned from DB (matches intervention-store InterventionRecord). */
export type InterventionRow = {
  id: string;
  student_sap_id: string;
  date: string;
  intervention_type: "attendance" | "gpa";
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at: string;
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
export async function insertIntervention(row: {
  id: string;
  student_sap_id: string;
  date: string;
  intervention_type: "attendance" | "gpa";
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at: string;
  staff_id: string;
  department_id: string;
  course_id: string;
  faculty_id: string;
}): Promise<void> {
  if (!pool) throw new Error("Database not configured");
  const hasType = await hasInterventionTypeColumn();
  if (hasType) {
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
    return;
  }
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
}

/** All interventions for a student from DB, newest first. */
export async function getInterventionsByStudentSapIdFromDb(
  sapId: string
): Promise<InterventionRow[]> {
  if (!pool) return [];
  const hasType = await hasInterventionTypeColumn();
  const res = await pool.query<{
    id: string;
    student_sap_id: string;
    date: string;
    intervention_type?: "attendance" | "gpa" | null;
    outreach_mode: string;
    remarks: string;
    status: string;
    performed_at: Date;
  }>(
    hasType
      ? `SELECT id, student_sap_id, date, intervention_type, outreach_mode, remarks, status, performed_at
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY performed_at DESC`
      : `SELECT id, student_sap_id, date, outreach_mode, remarks, status, performed_at
         FROM interventions
         WHERE student_sap_id = $1
         ORDER BY performed_at DESC`,
    [sapId]
  );
  return res.rows.map((r) => ({
    ...r,
    intervention_type: r.intervention_type === "gpa" ? "gpa" : "attendance",
    date: typeof r.date === "string" ? r.date : (r.date as unknown as Date).toISOString().slice(0, 10),
    performed_at:
      typeof r.performed_at === "string"
        ? r.performed_at
        : (r.performed_at as Date).toISOString(),
  }));
}

export async function deleteInterventionByIdFromDb(id: string): Promise<{ student_sap_id: string } | null> {
  if (!pool) return null;
  const res = await pool.query<{ student_sap_id: string }>(
    `DELETE FROM interventions WHERE id = $1 RETURNING student_sap_id`,
    [id]
  );
  return res.rows[0] ?? null;
}

export type InterventionStatsCounts = {
  notStarted: number;
  initiated: number;
  "in-progress": number;
  referred: number;
  resolved: number;
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
    else notStarted += 1;
  }

  return {
    notStarted,
    initiated,
    "in-progress": inProgress,
    referred,
    resolved,
  };
}

