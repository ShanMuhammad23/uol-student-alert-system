import { pool } from "@/lib/db";

export type StudentGpaProfileRow = {
  sap_id: string;
  cgpa_fall_2025: number | null;
  cgpa_semesters?: unknown;
  sgpa_semesters?: unknown;
};

export type GpaTrendLevel = "warning" | "critical" | null;

export type StudentGpaTrend = {
  current: number | null;
  previous: number | null;
  change: number | null;
  level: GpaTrendLevel;
};

export type StudentGpaProfile = StudentGpaTrend & {
  semesters: Array<{ key: string; label: string; value: number }>;
  cgpaSemesters: Array<{ key: string; label: string; value: number }>;
};

const TERM_RANK: Record<string, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
};

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getSemesterSortRank(key: string): number | null {
  const m = /^([a-zA-Z]+)_(\d{4})$/.exec(String(key).trim());
  if (!m) return null;
  const term = m[1].toLowerCase();
  const year = Number(m[2]);
  const termRank = TERM_RANK[term];
  if (!Number.isFinite(year) || !termRank) return null;
  return year * 10 + termRank;
}

/** SGPA/CGPA of 0 is treated as incomplete placeholder data, not a real semester result. */
function isUsableGpaValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function deriveTrendFromSemesters(
  semestersRaw: unknown,
  fallbackCurrent: number | null
): StudentGpaTrend {
  const entries: Array<{ rank: number; value: number }> = [];

  if (
    semestersRaw &&
    typeof semestersRaw === "object" &&
    !Array.isArray(semestersRaw)
  ) {
    for (const [k, raw] of Object.entries(semestersRaw as Record<string, unknown>)) {
      const rank = getSemesterSortRank(k);
      const value = parseNumeric(raw);
      if (rank == null || value == null || !isUsableGpaValue(value)) continue;
      entries.push({ rank, value });
    }
  }

  entries.sort((a, b) => b.rank - a.rank);

  const fallback =
    fallbackCurrent != null && isUsableGpaValue(fallbackCurrent)
      ? fallbackCurrent
      : null;
  const current = entries[0]?.value ?? fallback ?? null;
  const previous = entries[1]?.value ?? null;

  if (current == null || previous == null) {
    return {
      current,
      previous,
      change: null,
      level: null,
    };
  }

  const change = Number((current - previous).toFixed(2));
  const drop = previous - current;
  // Keep thresholds aligned with student-sync SGPA alert rules.
  let level: GpaTrendLevel = null;
  if (drop >= 1.5) level = "critical";
  else if (drop >= 1.0) level = "warning";

  return {
    current,
    previous,
    change,
    level,
  };
}

function deriveSemesterPoints(
  semestersRaw: unknown
): Array<{ key: string; label: string; value: number }> {
  const entries: Array<{ key: string; rank: number; value: number }> = [];
  if (
    semestersRaw &&
    typeof semestersRaw === "object" &&
    !Array.isArray(semestersRaw)
  ) {
    for (const [k, raw] of Object.entries(semestersRaw as Record<string, unknown>)) {
      const rank = getSemesterSortRank(k);
      const value = parseNumeric(raw);
      if (rank == null || value == null) continue;
      entries.push({ key: k, rank, value });
    }
  }
  entries.sort((a, b) => a.rank - b.rank);
  return entries.map((e) => ({
    key: e.key,
    label: e.key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: e.value,
  }));
}

export async function getCgpaBySapId(
  sapId: string
): Promise<number | null> {
  if (!pool) return null;
  const res = await pool.query<{
    cgpa_fall_2025: number | string | null;
    cgpa_semesters: unknown;
  }>(
    `SELECT cgpa_fall_2025, cgpa_semesters
     FROM student_gpa_profiles
     WHERE sap_id = $1
     LIMIT 1`,
    [sapId]
  );
  const row = res.rows[0];
  if (!row) return null;
  const fallback = parseNumeric(row.cgpa_fall_2025);
  const trend = deriveTrendFromSemesters(row.cgpa_semesters, fallback);
  return trend.current;
}

export async function getCgpaMapBySapIds(
  sapIds: string[]
): Promise<Record<string, number>> {
  if (!pool || !sapIds.length) return {};
  const deduped = Array.from(new Set(sapIds.map((s) => s.trim()).filter(Boolean)));
  if (!deduped.length) return {};
  const res = await pool.query<StudentGpaProfileRow>(
    `SELECT sap_id, cgpa_fall_2025, cgpa_semesters
     FROM student_gpa_profiles
     WHERE sap_id = ANY($1::varchar[])`,
    [deduped]
  );
  const out: Record<string, number> = {};
  for (const row of res.rows) {
    const fallback = parseNumeric(row.cgpa_fall_2025);
    const trend = deriveTrendFromSemesters(row.cgpa_semesters, fallback);
    if (trend.current == null) continue;
    out[row.sap_id] = trend.current;
  }
  return out;
}

export async function getGpaTrendMapBySapIds(
  sapIds: string[]
): Promise<Record<string, StudentGpaTrend>> {
  if (!pool || !sapIds.length) return {};
  const deduped = Array.from(new Set(sapIds.map((s) => s.trim()).filter(Boolean)));
  if (!deduped.length) return {};

  const res = await pool.query<StudentGpaProfileRow>(
    `SELECT sap_id, cgpa_fall_2025, sgpa_semesters
     FROM student_gpa_profiles
     WHERE sap_id = ANY($1::varchar[])`,
    [deduped]
  );

  const out: Record<string, StudentGpaTrend> = {};
  for (const row of res.rows) {
    out[row.sap_id] = deriveTrendFromSemesters(row.sgpa_semesters, null);
  }
  return out;
}

export async function getStudentGpaProfileBySapId(
  sapId: string
): Promise<StudentGpaProfile | null> {
  if (!pool) return null;
  const id = String(sapId ?? "").trim();
  if (!id) return null;
  const res = await pool.query<StudentGpaProfileRow>(
    `SELECT sap_id, cgpa_fall_2025, cgpa_semesters, sgpa_semesters
     FROM student_gpa_profiles
     WHERE sap_id = $1
     LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  const trend = deriveTrendFromSemesters(row.sgpa_semesters, null);
  const fallback = parseNumeric(row.cgpa_fall_2025);
  const semesters = deriveSemesterPoints(row.sgpa_semesters);
  const cgpaSemesters = deriveSemesterPoints(row.cgpa_semesters);
  if (!cgpaSemesters.length && fallback != null) {
    cgpaSemesters.push({
      key: "current",
      label: "Current",
      value: fallback,
    });
  }
  return { ...trend, semesters, cgpaSemesters };
}
