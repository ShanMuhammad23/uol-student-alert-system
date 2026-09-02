/**
 * Current academic term is the same source of truth as student-sync / SAP
 * (`SAP_PYEAR` + `SAP_PSESS`). Session codes: 001 spring, 002 summer, 003 fall.
 */

export type AcademicTerm = {
  termYear: string;
  termSession: string;
};

export type AcademicTermScope = "current" | "previous";

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

/** Previous session in the 001 spring / 002 summer / 003 fall cycle. */
export function getPreviousAcademicTerm(
  term: AcademicTerm = getCurrentAcademicTerm()
): AcademicTerm {
  const year = Number(term.termYear);
  if (term.termSession === "001") {
    return {
      termYear: String(Number.isFinite(year) ? year - 1 : term.termYear),
      termSession: "003",
    };
  }
  if (term.termSession === "002") {
    return { termYear: term.termYear, termSession: "001" };
  }
  return { termYear: term.termYear, termSession: "002" };
}

export function getAcademicTermForScope(scope: AcademicTermScope): AcademicTerm {
  return scope === "previous"
    ? getPreviousAcademicTerm()
    : getCurrentAcademicTerm();
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

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** Typical UOL windows used when a term has no SAP_BEGDA / SAP_ENDDA. */
function inferTypicalTermDateBounds(term: AcademicTerm): { start: string; end: string } {
  const year = Number(term.termYear);
  const y = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  if (term.termSession === "001") {
    return { start: `${y}-02-01`, end: `${y}-05-31` };
  }
  if (term.termSession === "002") {
    return { start: `${y}-06-01`, end: `${y}-08-31` };
  }
  return { start: `${y}-09-01`, end: `${y + 1}-01-31` };
}

/** Inclusive calendar bounds for the configured SAP term (`SAP_BEGDA` / `SAP_ENDDA`). */
export function getCurrentTermDateBounds(): { start: string; end: string } {
  return {
    start: yyyymmddToIso(process.env.SAP_BEGDA ?? "20260601", "2026-06-01"),
    end: yyyymmddToIso(process.env.SAP_ENDDA ?? "20260920", "2026-09-20"),
  };
}

/**
 * Inclusive bounds for any term. Current term uses SAP dates; previous term
 * uses the typical session window, clipped so it does not overlap the current term.
 */
export function getTermDateBounds(term: AcademicTerm): { start: string; end: string } {
  const current = getCurrentAcademicTerm();
  if (
    term.termYear === current.termYear &&
    term.termSession === current.termSession
  ) {
    return getCurrentTermDateBounds();
  }
  const inferred = inferTypicalTermDateBounds(term);
  const currentStart = getCurrentTermDateBounds().start;
  const clippedEnd =
    inferred.end >= currentStart ? addDaysIso(currentStart, -1) : inferred.end;
  const start =
    inferred.start <= clippedEnd ? inferred.start : addDaysIso(clippedEnd, -120);
  return { start, end: clippedEnd };
}

export function getAcademicTermDateBounds(
  scope: AcademicTermScope
): { start: string; end: string } {
  return getTermDateBounds(getAcademicTermForScope(scope));
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

export function getAcademicTermChartLabels(): {
  currentTermLabel: string;
  previousTermLabel: string;
} {
  const current = getCurrentAcademicTerm();
  const previous = getPreviousAcademicTerm();
  return {
    currentTermLabel:
      formatAcademicTermLabel(current.termYear, current.termSession) ??
      "Current semester",
    previousTermLabel:
      formatAcademicTermLabel(previous.termYear, previous.termSession) ??
      "Previous semester",
  };
}

function qualify(alias: string | undefined, column: string): string {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}${column}`;
}

/** Enrollment rows for a specific term (index-friendly predicates). */
export function enrolledInTermSql(
  alias = "",
  term: AcademicTerm = getCurrentAcademicTerm(),
  opts?: { requireActive?: boolean }
): string {
  const requireActive = opts?.requireActive ?? true;
  const termYear = sanitizeTermPart(term.termYear, "0");
  const termSession = normalizeTermSession(term.termSession);
  const active = qualify(alias, "is_active");
  const yearCol = qualify(alias, "term_year");
  const sessionCol = qualify(alias, "term_session");
  // Accept both padded (`002`) and unpadded (`2`) values stored in DB.
  const unpadded = String(Number(termSession));
  const sessionList =
    unpadded === termSession || !Number.isFinite(Number(termSession))
      ? `'${termSession}'`
      : `'${termSession}', '${unpadded}'`;
  const activeSql = requireActive ? `${active} = TRUE AND ` : "";
  return `${activeSql}${yearCol} = '${termYear}'
    AND ${sessionCol} IN (${sessionList})`;
}

/** Active enrollment in the configured current semester (index-friendly predicates). */
export function enrolledInCurrentTermSql(alias = ""): string {
  return enrolledInTermSql(alias, getCurrentAcademicTerm(), { requireActive: true });
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
