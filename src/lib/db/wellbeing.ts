import { pool } from "./index";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";

const KNOWN_CATEGORIES = [
  "Counselling",
  "Monitoring",
  "Flex (Academic)",
  "Flex (Financial)",
] as const;

const SLOT_COUNT = KNOWN_CATEGORIES.length + 1; // + Others

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
    resolution_status: string | null;
  }>(
    `
    SELECT student_sap_id, category, wellbeing_status, resolution_status
    FROM wellbeing_cases
    WHERE student_sap_id = ANY($1)
    `,
    [sapIds]
  );

  const othersIndex = KNOWN_CATEGORIES.length;

  for (const row of res.rows) {
    const idx = KNOWN_CATEGORIES.indexOf(
      row.category as (typeof KNOWN_CATEGORIES)[number]
    );
    const slot = idx === -1 ? othersIndex : idx;

    const isClosed =
      row.wellbeing_status === "closed" || row.resolution_status === "resolved";

    if (isClosed) closed[slot] += 1;
    else open[slot] += 1;
  }

  return { open, closed };
}

