import { pool } from "./index";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";

const KNOWN_CATEGORIES = [
  "Counselling",
  "Monitoring",
  "Flex (Academic)",
  "Flex (Financial)",
] as const;

const SLOT_COUNT = KNOWN_CATEGORIES.length + 1; // + Others

function normalizeWellbeingCategory(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "Others";
  if (raw === "counselling") return "Counselling";
  if (raw === "monitoring") return "Monitoring";
  if (
    raw === "flex (academic)" ||
    raw === "flex (acad)" ||
    raw === "flex-academic" ||
    raw === "flex academic"
  ) {
    return "Flex (Academic)";
  }
  if (
    raw === "flex (financial)" ||
    raw === "flex (fin)" ||
    raw === "flex-financial" ||
    raw === "flex financial"
  ) {
    return "Flex (Financial)";
  }
  return "Others";
}

/** Wellbeing open/closed counts per category for a set of students. */
export async function getWellbeingChartDataForStudents(
  sapIds: string[]
): Promise<StatusStackedChartData> {
  const open = Array<number>(SLOT_COUNT).fill(0);
  const closed = Array<number>(SLOT_COUNT).fill(0);

  if (!pool || !sapIds.length) return { open, closed };

  const res = await pool.query<{
    student_sap_id: string;
    category: string;
    wellbeing_status: string;
  }>(
    `
    SELECT DISTINCT ON (student_sap_id, category)
      student_sap_id,
      category,
      wellbeing_status
    FROM wellbeing_cases
    WHERE student_sap_id = ANY($1)
    ORDER BY student_sap_id, category, updated_at DESC, opened_at DESC, id DESC
    `,
    [sapIds]
  );

  const othersIndex = KNOWN_CATEGORIES.length;

  for (const row of res.rows) {
    const normalizedCategory = normalizeWellbeingCategory(row.category);
    const idx = KNOWN_CATEGORIES.indexOf(
      normalizedCategory as (typeof KNOWN_CATEGORIES)[number]
    );
    const slot = idx === -1 ? othersIndex : idx;

    const isClosed = String(row.wellbeing_status ?? "").trim().toLowerCase() === "closed";

    if (isClosed) closed[slot] += 1;
    else open[slot] += 1;
  }

  return { open, closed };
}

export type WellbeingCaseRecord = {
  id: string;
  studentSapId: string;
  category: string;
  wellbeingStatus: "open" | "closed";
  remarks: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  staffId: string | null;
  staffName: string | null;
  staffPernr: string | null;
};

export async function getWellbeingCasesByStudentSapId(
  sapId: string
): Promise<WellbeingCaseRecord[]> {
  if (!pool) return [];
  const res = await pool.query<{
    id: string;
    student_sap_id: string;
    category: string;
    wellbeing_status: "open" | "closed";
    remarks: string | null;
    opened_at: string;
    updated_at: string;
    resolved_at: string | null;
    staff_id: string | null;
    staff_name: string | null;
    staff_pernr: string | null;
  }>(
    `SELECT
       wb.id::text AS id,
       wb.student_sap_id,
       wb.category,
       wb.wellbeing_status,
       wb.remarks,
       wb.opened_at::text,
       wb.updated_at::text,
       wb.resolved_at::text,
       wb.staff_id::text,
       s.name AS staff_name,
       s.pernr AS staff_pernr
     FROM wellbeing_cases wb
     LEFT JOIN staff s ON s.id = wb.staff_id
     WHERE wb.student_sap_id = $1
     ORDER BY wb.updated_at DESC`,
    [sapId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    studentSapId: row.student_sap_id,
    category: row.category,
    wellbeingStatus: row.wellbeing_status,
    remarks: String(row.remarks ?? ""),
    openedAt: row.opened_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    staffId: row.staff_id,
    staffName: row.staff_name,
    staffPernr: row.staff_pernr,
  }));
}

export async function insertWellbeingCase(input: {
  studentSapId: string;
  category: "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
  wellbeingStatus: "open" | "closed";
  remarks: string;
  staffId: string;
}): Promise<string | null> {
  if (!pool) return null;
  const res = await pool.query<{ id: string }>(
    `INSERT INTO wellbeing_cases (
       student_sap_id,
       category,
       wellbeing_status,
       remarks,
       opened_at,
       updated_at,
       resolved_at,
       staff_id
     ) VALUES (
       $1, $2, $3::varchar, $4, NOW(), NOW(),
       CASE WHEN $3::varchar = 'closed' THEN NOW() ELSE NULL END,
       $5
     )
     RETURNING id::text`,
    [
      input.studentSapId,
      input.category,
      input.wellbeingStatus,
      input.remarks ?? "",
      input.staffId,
    ]
  );
  return res.rows[0]?.id ?? null;
}

export async function updateWellbeingCaseById(
  id: string,
  input: {
    category: "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
    wellbeingStatus: "open" | "closed";
    remarks: string;
  }
): Promise<{ id: string; studentSapId: string } | null> {
  if (!pool) return null;
  const res = await pool.query<{ id: string; student_sap_id: string }>(
    `UPDATE wellbeing_cases
     SET
       category = $2,
       wellbeing_status = $3,
       remarks = $4,
       updated_at = NOW(),
       resolved_at = CASE WHEN $3 = 'closed' THEN COALESCE(resolved_at, NOW()) ELSE NULL END
     WHERE id = $1::uuid
     RETURNING id::text, student_sap_id`,
    [id, input.category, input.wellbeingStatus, input.remarks ?? ""]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { id: row.id, studentSapId: row.student_sap_id };
}

