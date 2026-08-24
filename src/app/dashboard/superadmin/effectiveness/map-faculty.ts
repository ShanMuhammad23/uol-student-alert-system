import {
  computeEiRating,
  normalizeDateString,
  type EffectivenessScoreRow,
  type EffectivenessTrendPoint,
} from "@/lib/effectiveness-scoring";
import { EI_CRITERION_DEFINITIONS } from "@/lib/ei-metric-definitions";
import type { FacultyEffectivenessView } from "./types";

export function toFacultyCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "—";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

export function mapRowToFacultyView(
  row: EffectivenessScoreRow,
  trend: number[] = []
): FacultyEffectivenessView {
  const criteria = EI_CRITERION_DEFINITIONS.map(
    (def) => row.criteria_breakdown[def.code]
  );

  return {
    id: row.dimension_id,
    name: row.dimension_name,
    code: toFacultyCode(row.dimension_name),
    dimensionType: row.dimension_type,
    ei: Math.round(row.ei_score),
    grade: computeEiRating(row.ei_score),
    criteria,
    loginRate: row.login_rate_pct ?? 0,
    attendancePost: row.attendance_posting_pct ?? 0,
    coverage: row.intervention_coverage_pct ?? 0,
    ttfa: row.median_days_to_first_action ?? 0,
    caseProgression: row.faculty_case_progression_pct ?? 0,
    resolution: row.faculty_resolution_pct ?? 0,
    wbUptake: row.wb_uptake_days ?? 0,
    wbProgression: row.wb_case_progression_pct ?? 0,
    wbResolution: row.wb_resolution_pct ?? 0,
    alerted: row.total_alerts,
    intervened: row.alerts_with_intervention,
    referred: row.wb_referred_cases,
    concluded: row.faculty_cases_closed_or_referred,
    nTotal: row.total_students,
    trend,
  };
}

export function buildTrendByFaculty(
  trendPoints: EffectivenessTrendPoint[],
  facultyIds: string[]
): { trendDates: string[]; trendByFaculty: Map<string, number[]> } {
  const trendDates = [
    ...new Set(trendPoints.map((p) => normalizeDateString(p.snapshot_date))),
  ]
    .filter(Boolean)
    .sort();
  const trendByFaculty = new Map<string, number[]>();

  for (const id of facultyIds) {
    trendByFaculty.set(
      id,
      trendDates.map((date) => {
        const point = trendPoints.find(
          (p) =>
            p.dimension_id === id && normalizeDateString(p.snapshot_date) === date
        );
        return point ? Math.round(point.ei_score) : 0;
      })
    );
  }

  return { trendDates, trendByFaculty };
}
