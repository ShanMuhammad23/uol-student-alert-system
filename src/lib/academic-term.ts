/**
 * Current academic term is the same source of truth as student-sync / SAP
 * (`SAP_PYEAR` + `SAP_PSESS`). Session codes: 001 spring, 002 summer, 003 fall.
 */

export type AcademicTerm = {
  termYear: string;
  termSession: string;
};

const SESSION_LABELS: Record<string, string> = {
  "001": "Spring",
  "002": "Summer",
  "003": "Fall",
};

function sanitizeTermPart(raw: string, fallback: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits || fallback;
}

export function getCurrentAcademicTerm(): AcademicTerm {
  return {
    termYear: sanitizeTermPart(process.env.SAP_PYEAR ?? "2026", "2026"),
    termSession: sanitizeTermPart(process.env.SAP_PSESS ?? "002", "002").padStart(
      3,
      "0"
    ),
  };
}

export function normalizeTermSession(value?: string | null): string {
  return sanitizeTermPart(String(value ?? ""), "").padStart(3, "0");
}

export function isCurrentAcademicTerm(
  termYear?: string | null,
  termSession?: string | null
): boolean {
  const current = getCurrentAcademicTerm();
  const year = sanitizeTermPart(String(termYear ?? ""), "");
  const session = normalizeTermSession(termSession);
  return year === current.termYear && session === current.termSession;
}

function yyyymmddToIso(raw: string, fallback: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return fallback;
}

/** Inclusive calendar bounds for the configured SAP term (`SAP_BEGDA` / `SAP_ENDDA`). */
export function getCurrentTermDateBounds(): { start: string; end: string } {
  return {
    start: yyyymmddToIso(process.env.SAP_BEGDA ?? "20260601", "2026-06-01"),
    end: yyyymmddToIso(process.env.SAP_ENDDA ?? "20260920", "2026-09-20"),
  };
}

export function isIsoDateInRange(
  value: string | null | undefined,
  start: string,
  end: string
): boolean {
  const iso = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso >= start && iso <= end;
}

export function isDateInCurrentTerm(value?: string | null): boolean {
  const { start, end } = getCurrentTermDateBounds();
  return isIsoDateInRange(value, start, end);
}

export function formatAcademicTermLabel(
  termYear?: string | null,
  termSession?: string | null
): string | null {
  const year = sanitizeTermPart(String(termYear ?? ""), "");
  const session = normalizeTermSession(termSession);
  if (!year || session === "000") return null;
  const sessionLabel = SESSION_LABELS[session] ?? `Session ${session}`;
  return `${sessionLabel} ${year}`;
}

function qualify(alias: string | undefined, column: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}${column}`;
}

/** Active enrollment in the configured current semester (index-friendly predicates). */
export function enrolledInCurrentTermSql(alias = ""): string {
  const { termYear, termSession } = getCurrentAcademicTerm();
  const active = qualify(alias, "is_active");
  const yearCol = qualify(alias, "term_year");
  const sessionCol = qualify(alias, "term_session");
  // Accept both padded (`002`) and unpadded (`2`) values stored in DB.
  const unpadded = String(Number(termSession));
  const sessionList =
    unpadded === termSession || !Number.isFinite(Number(termSession))
      ? `'${termSession}'`
      : `'${termSession}', '${unpadded}'`;
  return `${active} = TRUE
    AND ${yearCol} = '${termYear}'
    AND ${sessionCol} IN (${sessionList})`;
}

/**
 * Cheap subject-linked intervention check for listing WHERE clauses.
 * Avoid REGEXP_REPLACE / normalizeSapId on every enrollment row (that caused 504s).
 */
export function cheapSubjectInterventionExistsSql(opts?: {
  interventionAlias?: string;
  enrollmentAlias?: string;
}): string {
  const i = opts?.interventionAlias ?? "ix";
  const e = opts?.enrollmentAlias ?? "e";
  return `EXISTS (
    SELECT 1
    FROM interventions ${i}
    WHERE ${i}.student_sap_id = ${e}.sap_id
      AND COALESCE(NULLIF(TRIM(${i}.course_id), ''), '') <> ''
      AND (
        ${i}.course_id = ${e}.course_id
        OR SPLIT_PART(${i}.course_id, '|', 1) = SPLIT_PART(${e}.course_id, '|', 1)
      )
  )`;
}

/**
 * Current-term active rows, or a subject that has a linked intervention.
 */
export function currentOrIntervenedEnrollmentSql(opts: {
  alias?: string;
  interventionExistsSql: string;
}): string {
  const alias = opts.alias ?? "e";
  return `(${enrolledInCurrentTermSql(alias)} OR (${opts.interventionExistsSql}))`;
}
