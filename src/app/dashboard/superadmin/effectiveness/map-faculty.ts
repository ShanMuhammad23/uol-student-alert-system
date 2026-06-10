import {
  computeSustainedScore,
  normalizeDateString,
  type EffectivenessScoreRow,
  type EffectivenessTrendPoint,
} from "@/lib/effectiveness-scoring";
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
  return {
    id: row.dimension_id,
    name: row.dimension_name,
    code: toFacultyCode(row.dimension_name),
    fei: Math.round(row.fei_score),
    grade: row.fei_rating,
    response: Math.round(row.response_score),
    wellbeing: Math.round(row.wellbeing_score),
    outcome: Math.round(row.outcome_score),
    readiness: Math.round(row.readiness_score),
    sustained: Math.round(
      computeSustainedScore(row.alert_recovery_pct, row.repeat_alert_pct)
    ),
    coverage: row.intervention_coverage_pct ?? 0,
    critCoverage: row.critical_coverage_pct ?? 0,
    ttfc: row.median_days_to_contact ?? 0,
    staleRate: row.stale_intervention_pct ?? 0,
    referralRate: row.referral_rate_pct ?? 0,
    wellbeingPct: row.wellbeing_uptake_pct ?? 0,
    recovery: row.alert_recovery_pct ?? 0,
    repeatAlert: row.repeat_alert_pct ?? 0,
    attendancePost: row.attendance_posting_pct ?? 0,
    alerted: row.alerted_students,
    intervened: row.intervened_students,
    referred: row.referred_students,
    recovered: row.recovered_students,
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
        return point ? Math.round(point.fei_score) : 0;
      })
    );
  }

  return { trendDates, trendByFaculty };
}
