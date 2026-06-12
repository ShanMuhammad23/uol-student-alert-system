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
  concluded_students: number;
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
  conclusion_rate_pct: number | null;
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

function scoreAbsolute(value: number | null): number {
  if (value == null) return 50;
  return Math.round(Math.min(100, Math.max(0, value)));
}

function scoreInverted(value: number | null): number {
  if (value == null) return 50;
  return Math.round(Math.min(100, Math.max(0, 100 - value)));
}

function scoreTTFC(days: number | null, maxDays = 30): number {
  if (days == null) return 50;
  return Math.round(Math.max(0, 100 - (days / maxDays) * 100));
}

function scoreAttendance(value: number | null): number {
  if (value == null) return 50;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** No interventions means inaction — do not treat missing TTFC as neutral. */
function scoreTtfc(medianDays: number | null, intervenedStudents: number): number {
  if (intervenedStudents === 0) return 0;
  return scoreTTFC(medianDays);
}

/** Low repeat alerts without any prior intervention is not a success signal. */
function scoreRepeatAlert(
  repeatAlertPct: number | null,
  intervenedStudents: number
): number {
  if (intervenedStudents === 0) return scoreInverted(100);
  return scoreInverted(repeatAlertPct);
}

/** Recovery dominates outcome; repeat-alert control is a secondary signal. */
function weightedOutcomeScore(
  recoveryPct: number | null,
  repeatAlertPct: number | null,
  intervenedStudents: number
): number {
  const recovery_score = scoreAbsolute(recoveryPct);
  const repeat_alert_score = scoreRepeatAlert(repeatAlertPct, intervenedStudents);
  return Math.round((0.8 * recovery_score + 0.2 * repeat_alert_score) * 100) / 100;
}

/** Faculties reaching fewer than 1 in 10 alerted students cannot score well on Response. */
function applyResponseCoverageFloor(
  responseScore: number,
  coveragePct: number | null,
  alertedStudents: number
): number {
  if (alertedStudents > 0 && (coveragePct == null || coveragePct < 10)) {
    return Math.min(responseScore, 40);
  }
  return responseScore;
}

/** Alerted students with zero interventions cannot exceed Grade D. */
function applyInactionFeiCap(
  feiScore: number,
  intervenedStudents: number,
  alertedStudents: number
): number {
  if (intervenedStudents === 0 && alertedStudents > 0) {
    return Math.min(feiScore, 40);
  }
  return feiScore;
}

export function computeSustainedScore(
  alertRecoveryPct: number | null,
  repeatAlertPct: number | null,
  intervenedStudents: number
): number {
  return weightedOutcomeScore(alertRecoveryPct, repeatAlertPct, intervenedStudents);
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
  const conclusion_rate_pct = pct(raw.concluded_students, raw.intervened_students);
  const wellbeing_uptake_pct = pct(raw.wellbeing_linked_students, raw.concluded_students);
  const alert_recovery_pct = pct(raw.recovered_students, raw.intervened_students);
  const repeat_alert_pct = pct(raw.repeat_alert_students, raw.alerted_students);

  let response_score = avg([
    scoreAbsolute(intervention_coverage_pct),
    scoreAbsolute(critical_coverage_pct),
    scoreTtfc(raw.median_days_to_contact, raw.intervened_students),
    scoreInverted(stale_intervention_pct),
  ]);
  response_score = applyResponseCoverageFloor(
    response_score,
    intervention_coverage_pct,
    raw.alerted_students
  );

  const wellbeing_score = avg([
    scoreAbsolute(conclusion_rate_pct),
    scoreAbsolute(wellbeing_uptake_pct),
  ]);

  const outcome_score = weightedOutcomeScore(
    alert_recovery_pct,
    repeat_alert_pct,
    raw.intervened_students
  );

  const readiness_score = scoreAttendance(raw.attendance_posting_pct);

  const sustained_score = computeSustainedScore(
    alert_recovery_pct,
    repeat_alert_pct,
    raw.intervened_students
  );

  const fei_score = applyInactionFeiCap(
    Math.round(
      (0.3 * outcome_score +
        0.25 * wellbeing_score +
        0.25 * response_score +
        0.1 * readiness_score +
        0.1 * sustained_score) *
        100
    ) / 100,
    raw.intervened_students,
    raw.alerted_students
  );

  return {
    ...raw,
    intervention_coverage_pct,
    critical_coverage_pct,
    stale_intervention_pct,
    conclusion_rate_pct,
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
