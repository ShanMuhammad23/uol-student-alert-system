/** Pure FEI types and scoring — safe to import from client components (no Node/pg). */

/** Coerce pg DATE / ISO strings to YYYY-MM-DD for serialization and display. */
export function normalizeDateString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
}

export type EffectivenessDimensionType = "faculty" | "department";

export type FeiRating = "A" | "B" | "C" | "D" | "E";

export type EffectivenessRawRow = {
  snapshot_date: string;
  dimension_type: EffectivenessDimensionType;
  dimension_id: string;
  dimension_name: string;
  total_students: number;
  alerted_students: number;
  critical_alerted_students: number;
  intervened_students: number;
  critical_intervened_students: number;
  referred_students: number;
  wellbeing_linked_students: number;
  recovered_students: number;
  repeat_alert_students: number;
  stale_interventions: number;
  open_interventions: number;
  median_days_to_contact: number | null;
  attendance_posting_pct: number | null;
};

export type EffectivenessScoreRow = EffectivenessRawRow & {
  intervention_coverage_pct: number | null;
  critical_coverage_pct: number | null;
  stale_intervention_pct: number | null;
  referral_rate_pct: number | null;
  wellbeing_uptake_pct: number | null;
  alert_recovery_pct: number | null;
  repeat_alert_pct: number | null;
  response_score: number;
  wellbeing_score: number;
  outcome_score: number;
  readiness_score: number;
  fei_score: number;
  fei_rating: FeiRating;
};

export type EffectivenessTrendPoint = {
  snapshot_date: string;
  dimension_id: string;
  fei_score: number;
};

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function avg(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

function scoreHigherBetter(
  value: number | null,
  bands: { excellent: number; good: number; fair: number; poor: number }
): number {
  if (value == null) return 50;
  if (value >= bands.excellent) return 100;
  if (value >= bands.good) return 85;
  if (value >= bands.fair) return 70;
  if (value >= bands.poor) return 55;
  return 35;
}

function scoreLowerBetter(
  value: number | null,
  bands: { excellent: number; good: number; fair: number; poor: number }
): number {
  if (value == null) return 50;
  if (value <= bands.excellent) return 100;
  if (value <= bands.good) return 85;
  if (value <= bands.fair) return 70;
  if (value <= bands.poor) return 55;
  return 35;
}

export function computeSustainedScore(
  alertRecoveryPct: number | null,
  repeatAlertPct: number | null
): number {
  return avg([
    scoreHigherBetter(alertRecoveryPct, {
      excellent: 60,
      good: 45,
      fair: 30,
      poor: 15,
    }),
    scoreLowerBetter(repeatAlertPct, {
      excellent: 5,
      good: 10,
      fair: 20,
      poor: 30,
    }),
  ]);
}

export function computeFeiRating(feiScore: number): FeiRating {
  if (feiScore >= 85) return "A";
  if (feiScore >= 70) return "B";
  if (feiScore >= 55) return "C";
  if (feiScore >= 40) return "D";
  return "E";
}

export function scoreEffectivenessRow(raw: EffectivenessRawRow): EffectivenessScoreRow {
  const intervention_coverage_pct = pct(raw.intervened_students, raw.alerted_students);
  const critical_coverage_pct = pct(
    raw.critical_intervened_students,
    raw.critical_alerted_students
  );
  const stale_intervention_pct = pct(raw.stale_interventions, raw.open_interventions);
  const referral_rate_pct = pct(raw.referred_students, raw.intervened_students);
  const wellbeing_uptake_pct = pct(raw.wellbeing_linked_students, raw.referred_students);
  const alert_recovery_pct = pct(raw.recovered_students, raw.intervened_students);
  const repeat_alert_pct = pct(raw.repeat_alert_students, raw.alerted_students);

  const response_score = avg([
    scoreHigherBetter(intervention_coverage_pct, {
      excellent: 95,
      good: 85,
      fair: 70,
      poor: 50,
    }),
    scoreHigherBetter(critical_coverage_pct, {
      excellent: 95,
      good: 90,
      fair: 75,
      poor: 60,
    }),
    scoreLowerBetter(raw.median_days_to_contact, {
      excellent: 3,
      good: 7,
      fair: 14,
      poor: 21,
    }),
    scoreLowerBetter(stale_intervention_pct, {
      excellent: 10,
      good: 20,
      fair: 35,
      poor: 50,
    }),
  ]);

  const wellbeing_score = avg([
    scoreHigherBetter(referral_rate_pct, {
      excellent: 40,
      good: 25,
      fair: 15,
      poor: 8,
    }),
    scoreHigherBetter(wellbeing_uptake_pct, {
      excellent: 80,
      good: 65,
      fair: 50,
      poor: 35,
    }),
  ]);

  const outcome_score = avg([
    scoreHigherBetter(alert_recovery_pct, {
      excellent: 60,
      good: 45,
      fair: 30,
      poor: 15,
    }),
    scoreLowerBetter(repeat_alert_pct, {
      excellent: 5,
      good: 10,
      fair: 20,
      poor: 30,
    }),
  ]);

  const readiness_score = scoreHigherBetter(raw.attendance_posting_pct, {
    excellent: 95,
    good: 90,
    fair: 80,
    poor: 70,
  });

  const sustained_score = computeSustainedScore(alert_recovery_pct, repeat_alert_pct);

  const fei_score =
    Math.round(
      (0.3 * outcome_score +
        0.25 * wellbeing_score +
        0.25 * response_score +
        0.1 * readiness_score +
        0.1 * sustained_score) *
        100
    ) / 100;

  return {
    ...raw,
    intervention_coverage_pct,
    critical_coverage_pct,
    stale_intervention_pct,
    referral_rate_pct,
    wellbeing_uptake_pct,
    alert_recovery_pct,
    repeat_alert_pct,
    response_score,
    wellbeing_score,
    outcome_score,
    readiness_score,
    fei_score,
    fei_rating: computeFeiRating(fei_score),
  };
}
