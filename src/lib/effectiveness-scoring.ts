/** Pure EI types and scoring — safe to import from client components (no Node/pg). */

import {
  EI_CRITERION_BY_CODE,
  type EiCriterionCode,
  type EiCriterionDefinition,
} from "@/lib/ei-metric-definitions";

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

export type EffectivenessDimensionType = "faculty" | "department" | "instructor";

export type EiRating = "A" | "B" | "C" | "D";

/** @deprecated Use EiRating — kept for gradual UI migration */
export type FeiRating = EiRating;

export type EffectivenessRawRow = {
  snapshot_date: string;
  dimension_type: EffectivenessDimensionType;
  dimension_id: string;
  dimension_name: string;
  total_students: number;
  login_users_meeting_pi: number;
  login_total_users: number;
  classes_held_total: number;
  classes_posted_total: number;
  total_alerts: number;
  alerts_with_intervention: number;
  median_days_to_first_action: number | null;
  open_faculty_cases: number;
  faculty_cases_progression_ok: number;
  faculty_total_cases: number;
  faculty_cases_closed_or_referred: number;
  wb_referred_cases: number;
  median_days_to_wb_uptake: number | null;
  wb_open_cases: number;
  wb_cases_progression_ok: number;
  wb_cases_closed: number;
};

export type EiCriterionBreakdown = {
  code: EiCriterionCode;
  label: string;
  weight: number;
  piTarget: string;
  formula: string;
  tooltip: string;
  numerator: number;
  denominator: number;
  score: number;
  contribution: number;
};

export type EffectivenessScoreRow = EffectivenessRawRow & {
  criteria_breakdown: Record<EiCriterionCode, EiCriterionBreakdown>;
  ei_score: number;
  ei_rating: EiRating;
  /** Mirrors ei_score for legacy DB column / UI fields */
  fei_score: number;
  /** Mirrors ei_rating for legacy DB column / UI fields */
  fei_rating: EiRating;
  login_rate_pct: number | null;
  attendance_posting_pct: number | null;
  intervention_coverage_pct: number | null;
  faculty_case_progression_pct: number | null;
  faculty_resolution_pct: number | null;
  wb_uptake_days: number | null;
  wb_case_progression_pct: number | null;
  wb_resolution_pct: number | null;
};

export type EffectivenessTrendPoint = {
  snapshot_date: string;
  dimension_id: string;
  ei_score: number;
  /** @deprecated */
  fei_score: number;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round2((numerator / denominator) * 100);
}

function ratioScore(
  numerator: number,
  denominator: number,
  ifEmpty: "zero" | "full" = "zero"
): number {
  if (denominator <= 0) return ifEmpty === "full" ? 1 : 0;
  return round4(Math.min(1, Math.max(0, numerator / denominator)));
}

function scoreTtfa(
  totalAlerts: number,
  alertsWithIntervention: number,
  medianDays: number | null
): number {
  if (totalAlerts <= 0) return 1;
  if (alertsWithIntervention <= 0) return 0;
  if (medianDays == null || !Number.isFinite(medianDays)) return 0;
  return scoreTimePenalty(medianDays, 2);
}

function scoreWbUptake(referredCases: number, medianDays: number | null): number {
  if (referredCases <= 0) return 1;
  if (medianDays == null || !Number.isFinite(medianDays)) return 0;
  return scoreTimePenalty(medianDays, 2);
}

/** −20% per whole day over target (Excel guide). */
export function scoreTimePenalty(days: number | null, targetDays = 2): number {
  if (days == null || !Number.isFinite(days)) return 0;
  if (days <= targetDays) return 1;
  const daysOver = Math.ceil(days - targetDays);
  return round4(Math.max(0, 1 - 0.2 * daysOver));
}

function buildCriterion(
  code: EiCriterionCode,
  numerator: number,
  denominator: number,
  score: number,
  contribution: number
): EiCriterionBreakdown {
  const def: EiCriterionDefinition = EI_CRITERION_BY_CODE[code];
  return {
    code,
    label: def.label,
    weight: def.weight,
    piTarget: def.piTarget,
    formula: def.formula,
    tooltip: def.tooltip,
    numerator,
    denominator,
    score: round4(score),
    contribution: round4(contribution),
  };
}

export function computeEiRating(eiScore: number): EiRating {
  // Grade the integer shown in the UI (Math.round), so 89.5–89.9 displays as 90 · A.
  const score = Math.round(eiScore);
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 50) return "C";
  return "D";
}

/** @deprecated Use computeEiRating */
export function computeFeiRating(score: number): EiRating {
  return computeEiRating(score);
}

export function scoreEffectivenessRow(raw: EffectivenessRawRow): EffectivenessScoreRow {
  const loginScore = ratioScore(raw.login_users_meeting_pi, raw.login_total_users);
  const loginContribution = loginScore * EI_CRITERION_BY_CODE.A_login.weight;

  const attendanceScore = ratioScore(raw.classes_posted_total, raw.classes_held_total);
  const attendanceContribution = attendanceScore * EI_CRITERION_BY_CODE.B_attendance.weight;

  const ttfaScore = scoreTtfa(
    raw.total_alerts,
    raw.alerts_with_intervention,
    raw.median_days_to_first_action
  );
  const ttfaContribution = ttfaScore * EI_CRITERION_BY_CODE.C1_ttfa.weight;

  const coverageRaw = ratioScore(raw.alerts_with_intervention, raw.total_alerts);
  const coverageContribution =
    coverageRaw * EI_CRITERION_BY_CODE.C2_coverage.weight * (100 / 95);

  const progressionScore = ratioScore(
    raw.faculty_cases_progression_ok,
    raw.open_faculty_cases,
    "full"
  );
  const progressionContribution =
    progressionScore * EI_CRITERION_BY_CODE.C3_case_progression.weight;

  const resolutionScore = ratioScore(
    raw.faculty_cases_closed_or_referred,
    raw.faculty_total_cases
  );
  const resolutionContribution =
    resolutionScore * EI_CRITERION_BY_CODE.C4_resolution.weight;

  const wbUptakeScore = scoreWbUptake(
    raw.wb_referred_cases,
    raw.median_days_to_wb_uptake
  );
  const wbUptakeContribution = wbUptakeScore * EI_CRITERION_BY_CODE.D1_uptake.weight;

  const wbProgressionScore =
    raw.wb_referred_cases <= 0
      ? 1
      : ratioScore(raw.wb_cases_progression_ok, raw.wb_open_cases, "full");
  const wbProgressionContribution =
    wbProgressionScore * EI_CRITERION_BY_CODE.D2_wb_progression.weight;

  const wbResolutionScore =
    raw.wb_referred_cases <= 0
      ? 1
      : ratioScore(raw.wb_cases_closed, raw.wb_referred_cases);
  const wbResolutionContribution =
    wbResolutionScore * EI_CRITERION_BY_CODE.D3_wb_resolution.weight;

  const criteria_breakdown: Record<EiCriterionCode, EiCriterionBreakdown> = {
    A_login: buildCriterion(
      "A_login",
      raw.login_users_meeting_pi,
      raw.login_total_users,
      loginScore,
      loginContribution
    ),
    B_attendance: buildCriterion(
      "B_attendance",
      raw.classes_posted_total,
      raw.classes_held_total,
      attendanceScore,
      attendanceContribution
    ),
    C1_ttfa: buildCriterion(
      "C1_ttfa",
      raw.median_days_to_first_action != null
        ? Math.round(raw.median_days_to_first_action * 10) / 10
        : raw.alerts_with_intervention,
      raw.median_days_to_first_action != null ? 2 : Math.max(raw.alerts_with_intervention, 1),
      ttfaScore,
      ttfaContribution
    ),
    C2_coverage: buildCriterion(
      "C2_coverage",
      raw.alerts_with_intervention,
      raw.total_alerts,
      coverageRaw,
      coverageContribution
    ),
    C3_case_progression: buildCriterion(
      "C3_case_progression",
      raw.faculty_cases_progression_ok,
      raw.open_faculty_cases,
      progressionScore,
      progressionContribution
    ),
    C4_resolution: buildCriterion(
      "C4_resolution",
      raw.faculty_cases_closed_or_referred,
      raw.faculty_total_cases,
      resolutionScore,
      resolutionContribution
    ),
    D1_uptake: buildCriterion(
      "D1_uptake",
      raw.wb_referred_cases <= 0
        ? 0
        : raw.median_days_to_wb_uptake != null
          ? Math.round(raw.median_days_to_wb_uptake * 10) / 10
          : raw.wb_referred_cases,
      raw.wb_referred_cases <= 0 ? 0 : 2,
      wbUptakeScore,
      wbUptakeContribution
    ),
    D2_wb_progression: buildCriterion(
      "D2_wb_progression",
      raw.wb_cases_progression_ok,
      raw.wb_open_cases,
      wbProgressionScore,
      wbProgressionContribution
    ),
    D3_wb_resolution: buildCriterion(
      "D3_wb_resolution",
      raw.wb_cases_closed,
      raw.wb_referred_cases,
      wbResolutionScore,
      wbResolutionContribution
    ),
  };

  const ei_score = round2(
    (loginContribution +
      attendanceContribution +
      ttfaContribution +
      coverageContribution +
      progressionContribution +
      resolutionContribution +
      wbUptakeContribution +
      wbProgressionContribution +
      wbResolutionContribution) *
      100
  );

  const ei_rating = computeEiRating(ei_score);

  return {
    ...raw,
    criteria_breakdown,
    ei_score,
    ei_rating,
    fei_score: ei_score,
    fei_rating: ei_rating,
    login_rate_pct: pct(raw.login_users_meeting_pi, raw.login_total_users),
    attendance_posting_pct: pct(raw.classes_posted_total, raw.classes_held_total),
    intervention_coverage_pct: pct(raw.alerts_with_intervention, raw.total_alerts),
    faculty_case_progression_pct: pct(
      raw.faculty_cases_progression_ok,
      raw.open_faculty_cases
    ),
    faculty_resolution_pct: pct(
      raw.faculty_cases_closed_or_referred,
      raw.faculty_total_cases
    ),
    wb_uptake_days: raw.median_days_to_wb_uptake,
    wb_case_progression_pct: pct(raw.wb_cases_progression_ok, raw.wb_open_cases),
    wb_resolution_pct: pct(raw.wb_cases_closed, raw.wb_referred_cases),
  };
}

/** @deprecated EI no longer uses sustained score */
export function computeSustainedScore(): number {
  return 0;
}

export type { EiCriterionCode, EiCriterionDefinition };
