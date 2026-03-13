import { pool } from "./index";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";

const CATEGORIES = [
  "Counselling",
  "Monitoring",
  "Flex (Academic)",
  "Flex (Financial)",
] as const;

/** Wellbeing open/closed counts per category for a set of students. */
export async function getWellbeingChartDataForStudents(
  sapIds: string[]
): Promise<StatusStackedChartData> {
  const open = Array(CATEGORIES.length).fill(0);
  const closed = Array(CATEGORIES.length).fill(0);

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

  for (const row of res.rows) {
    const idx = CATEGORIES.indexOf(row.category as (typeof CATEGORIES)[number]);
    if (idx === -1) continue;

    const isClosed =
      row.wellbeing_status === "closed" || row.resolution_status === "resolved";

    if (isClosed) closed[idx] += 1;
    else open[idx] += 1;
  }

  return { open, closed };
}

