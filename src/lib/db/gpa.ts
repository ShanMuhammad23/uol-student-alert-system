import { pool } from "@/lib/db";

export type StudentGpaProfileRow = {
  sap_id: string;
  cgpa_fall_2025: number | null;
};

export async function getCgpaBySapId(
  sapId: string
): Promise<number | null> {
  if (!pool) return null;
  const res = await pool.query<{ cgpa_fall_2025: number | string | null }>(
    `SELECT cgpa_fall_2025
     FROM student_gpa_profiles
     WHERE sap_id = $1
     LIMIT 1`,
    [sapId]
  );
  const raw = res.rows[0]?.cgpa_fall_2025;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function getCgpaMapBySapIds(
  sapIds: string[]
): Promise<Record<string, number>> {
  if (!pool || !sapIds.length) return {};
  const deduped = Array.from(new Set(sapIds.map((s) => s.trim()).filter(Boolean)));
  if (!deduped.length) return {};
  const res = await pool.query<StudentGpaProfileRow>(
    `SELECT sap_id, cgpa_fall_2025
     FROM student_gpa_profiles
     WHERE sap_id = ANY($1::varchar[])`,
    [deduped]
  );
  const out: Record<string, number> = {};
  for (const row of res.rows) {
    const value = row.cgpa_fall_2025 == null ? NaN : Number(row.cgpa_fall_2025);
    if (!Number.isFinite(value)) continue;
    out[row.sap_id] = value;
  }
  return out;
}
