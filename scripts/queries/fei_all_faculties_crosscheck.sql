-- =============================================================================
-- FEI / EI cross-check: all faculties, latest snapshot
-- Run in psql / pgAdmin against your student-alert database.
--
-- Compares:
--   • stored ei_score / fei_score vs SQL-recomputed score
--   • raw count columns vs criteria_breakdown JSON (if ETL has run)
-- =============================================================================

WITH latest_snapshot AS (
  SELECT MAX(snapshot_date) AS snapshot_date
  FROM effectiveness_scores_by_dimension
  WHERE dimension_type = 'faculty'
),
faculty_rows AS (
  SELECT
    e.*,
    e.dimension_id AS faculty_id,
    COALESCE(f.name, e.dimension_name) AS faculty_name
  FROM effectiveness_scores_by_dimension e
  CROSS JOIN latest_snapshot ls
  LEFT JOIN faculties f ON f.id = e.dimension_id
  WHERE e.dimension_type = 'faculty'
    AND e.snapshot_date = ls.snapshot_date
),
scored AS (
  SELECT
    fr.*,

    -- A: Log-in rate (15%)
    CASE
      WHEN fr.login_total_users <= 0 THEN 0::numeric
      ELSE LEAST(1, GREATEST(0, fr.login_users_meeting_pi::numeric / fr.login_total_users))
    END AS a_login_score,
    0.15 AS a_login_weight,

    -- B: Attendance posting (25%)
    CASE
      WHEN fr.classes_held_total <= 0 THEN 0::numeric
      ELSE LEAST(1, GREATEST(0, fr.classes_posted_total::numeric / fr.classes_held_total))
    END AS b_attendance_score,
    0.25 AS b_attendance_weight,

    -- C1: TTFA (10%) — median days ≤2 → 1.0; −20% per day over 2
    CASE
      WHEN fr.total_alerts <= 0 THEN 1::numeric
      WHEN fr.alerts_with_intervention <= 0 THEN 0::numeric
      WHEN fr.median_days_to_first_action IS NULL THEN 0::numeric
      WHEN fr.median_days_to_first_action <= 2 THEN 1::numeric
      ELSE GREATEST(
        0,
        1 - 0.2 * CEIL(fr.median_days_to_first_action - 2)
      )
    END AS c1_ttfa_score,
    0.10 AS c1_ttfa_weight,

    -- C2: Coverage (10%) × (100/95) normalization
    CASE
      WHEN fr.total_alerts <= 0 THEN 0::numeric
      ELSE LEAST(1, GREATEST(0, fr.alerts_with_intervention::numeric / fr.total_alerts))
    END AS c2_coverage_raw,
    0.10 * (100.0 / 95.0) AS c2_coverage_weight,

    -- C3: Case progression (10%) — no open cases → full
    CASE
      WHEN fr.open_faculty_cases <= 0 THEN 1::numeric
      ELSE LEAST(
        1,
        GREATEST(0, fr.faculty_cases_progression_ok::numeric / fr.open_faculty_cases)
      )
    END AS c3_progression_score,
    0.10 AS c3_progression_weight,

    -- C4: Resolution / referral (5%)
    CASE
      WHEN fr.faculty_total_cases <= 0 THEN 0::numeric
      ELSE LEAST(
        1,
        GREATEST(0, fr.faculty_cases_closed_or_referred::numeric / fr.faculty_total_cases)
      )
    END AS c4_resolution_score,
    0.05 AS c4_resolution_weight,

    -- D1: Wellbeing uptake (10%) — no referrals → full
    CASE
      WHEN fr.wb_referred_cases <= 0 THEN 1::numeric
      WHEN fr.wb_median_days_to_uptake IS NULL THEN 0::numeric
      WHEN fr.wb_median_days_to_uptake <= 2 THEN 1::numeric
      ELSE GREATEST(
        0,
        1 - 0.2 * CEIL(fr.wb_median_days_to_uptake - 2)
      )
    END AS d1_wb_uptake_score,
    0.10 AS d1_wb_uptake_weight,

    -- D2: WB progression (10%) — no referrals → full
    CASE
      WHEN fr.wb_referred_cases <= 0 THEN 1::numeric
      WHEN fr.wb_open_cases <= 0 THEN 1::numeric
      ELSE LEAST(
        1,
        GREATEST(0, fr.wb_cases_progression_ok::numeric / fr.wb_open_cases)
      )
    END AS d2_wb_progression_score,
    0.10 AS d2_wb_progression_weight,

    -- D3: WB resolution (5%) — no referrals → full
    CASE
      WHEN fr.wb_referred_cases <= 0 THEN 1::numeric
      ELSE LEAST(
        1,
        GREATEST(0, fr.wb_cases_closed::numeric / fr.wb_referred_cases)
      )
    END AS d3_wb_resolution_score,
    0.05 AS d3_wb_resolution_weight

  FROM faculty_rows fr
),
with_ei AS (
  SELECT
    s.*,
    ROUND(
      (
        s.a_login_score * s.a_login_weight
        + s.b_attendance_score * s.b_attendance_weight
        + s.c1_ttfa_score * s.c1_ttfa_weight
        + s.c2_coverage_raw * s.c2_coverage_weight
        + s.c3_progression_score * s.c3_progression_weight
        + s.c4_resolution_score * s.c4_resolution_weight
        + s.d1_wb_uptake_score * s.d1_wb_uptake_weight
        + s.d2_wb_progression_score * s.d2_wb_progression_weight
        + s.d3_wb_resolution_score * s.d3_wb_resolution_weight
      ) * 100,
      2
    ) AS ei_recomputed,
    CASE
      WHEN (
        s.a_login_score * s.a_login_weight
        + s.b_attendance_score * s.b_attendance_weight
        + s.c1_ttfa_score * s.c1_ttfa_weight
        + s.c2_coverage_raw * s.c2_coverage_weight
        + s.c3_progression_score * s.c3_progression_weight
        + s.c4_resolution_score * s.c4_resolution_weight
        + s.d1_wb_uptake_score * s.d1_wb_uptake_weight
        + s.d2_wb_progression_score * s.d2_wb_progression_weight
        + s.d3_wb_resolution_score * s.d3_wb_resolution_weight
      ) * 100 >= 90 THEN 'A'
      WHEN (
        s.a_login_score * s.a_login_weight
        + s.b_attendance_score * s.b_attendance_weight
        + s.c1_ttfa_score * s.c1_ttfa_weight
        + s.c2_coverage_raw * s.c2_coverage_weight
        + s.c3_progression_score * s.c3_progression_weight
        + s.c4_resolution_score * s.c4_resolution_weight
        + s.d1_wb_uptake_score * s.d1_wb_uptake_weight
        + s.d2_wb_progression_score * s.d2_wb_progression_weight
        + s.d3_wb_resolution_score * s.d3_wb_resolution_weight
      ) * 100 >= 75 THEN 'B'
      WHEN (
        s.a_login_score * s.a_login_weight
        + s.b_attendance_score * s.b_attendance_weight
        + s.c1_ttfa_score * s.c1_ttfa_weight
        + s.c2_coverage_raw * s.c2_coverage_weight
        + s.c3_progression_score * s.c3_progression_weight
        + s.c4_resolution_score * s.c4_resolution_weight
        + s.d1_wb_uptake_score * s.d1_wb_uptake_weight
        + s.d2_wb_progression_score * s.d2_wb_progression_weight
        + s.d3_wb_resolution_score * s.d3_wb_resolution_weight
      ) * 100 >= 50 THEN 'C'
      ELSE 'D'
    END AS ei_rating_recomputed
  FROM scored s
)
SELECT
  w.snapshot_date,
  w.faculty_id,
  w.faculty_name,

  -- Stored vs recomputed
  w.ei_score AS stored_ei,
  w.fei_score AS stored_fei,
  w.ei_recomputed,
  w.ei_rating AS stored_rating,
  w.ei_rating_recomputed,
  ROUND((w.ei_recomputed - COALESCE(w.ei_score, w.fei_score))::numeric, 2) AS ei_delta,

  -- Volume
  w.total_students,
  w.total_alerts AS alerted_students,
  w.alerts_with_intervention AS students_intervened,

  -- A: Login
  w.login_users_meeting_pi,
  w.login_total_users,
  ROUND((w.a_login_score * 100)::numeric, 2) AS login_pct,
  ROUND((w.a_login_score * w.a_login_weight * 100)::numeric, 2) AS a_login_pts,

  -- B: Attendance
  w.classes_posted_total,
  w.classes_held_total,
  w.attendance_posting_pct AS stored_attendance_pct,
  ROUND((w.b_attendance_score * 100)::numeric, 2) AS attendance_pct,
  ROUND((w.b_attendance_score * w.b_attendance_weight * 100)::numeric, 2) AS b_attendance_pts,

  -- C1: TTFA
  w.median_days_to_first_action AS ttfa_median_days,
  ROUND((w.c1_ttfa_score * 100)::numeric, 2) AS c1_score_pct,
  ROUND((w.c1_ttfa_score * w.c1_ttfa_weight * 100)::numeric, 2) AS c1_ttfa_pts,

  -- C2: Coverage
  ROUND((w.c2_coverage_raw * 100)::numeric, 2) AS coverage_pct,
  w.intervention_coverage_pct AS stored_coverage_pct,
  ROUND((w.c2_coverage_raw * w.c2_coverage_weight * 100)::numeric, 2) AS c2_coverage_pts,

  -- C3: Case progression
  w.faculty_cases_progression_ok,
  w.open_faculty_cases,
  ROUND((w.c3_progression_score * 100)::numeric, 2) AS c3_score_pct,
  ROUND((w.c3_progression_score * w.c3_progression_weight * 100)::numeric, 2) AS c3_progression_pts,

  -- C4: Resolution
  w.faculty_cases_closed_or_referred,
  w.faculty_total_cases,
  ROUND((w.c4_resolution_score * 100)::numeric, 2) AS c4_score_pct,
  ROUND((w.c4_resolution_score * w.c4_resolution_weight * 100)::numeric, 2) AS c4_resolution_pts,

  -- D1: WB uptake
  w.wb_referred_cases,
  w.wb_median_days_to_uptake AS wb_uptake_median_days,
  ROUND((w.d1_wb_uptake_score * 100)::numeric, 2) AS d1_score_pct,
  ROUND((w.d1_wb_uptake_score * w.d1_wb_uptake_weight * 100)::numeric, 2) AS d1_uptake_pts,

  -- D2: WB progression
  w.wb_cases_progression_ok,
  w.wb_open_cases,
  ROUND((w.d2_wb_progression_score * 100)::numeric, 2) AS d2_score_pct,
  ROUND((w.d2_wb_progression_score * w.d2_wb_progression_weight * 100)::numeric, 2) AS d2_wb_prog_pts,

  -- D3: WB resolution
  w.wb_cases_closed,
  ROUND((w.d3_wb_resolution_score * 100)::numeric, 2) AS d3_score_pct,
  ROUND((w.d3_wb_resolution_score * w.d3_wb_resolution_weight * 100)::numeric, 2) AS d3_wb_res_pts,

  -- Category totals (pts out of max)
  ROUND((w.a_login_score * w.a_login_weight * 100)::numeric, 2) AS cat_a_pts,
  ROUND((w.b_attendance_score * w.b_attendance_weight * 100)::numeric, 2) AS cat_b_pts,
  ROUND((
    w.c1_ttfa_score * w.c1_ttfa_weight
    + w.c2_coverage_raw * w.c2_coverage_weight
    + w.c3_progression_score * w.c3_progression_weight
    + w.c4_resolution_score * w.c4_resolution_weight
  ) * 100, 2) AS cat_c_pts,
  ROUND((
    w.d1_wb_uptake_score * w.d1_wb_uptake_weight
    + w.d2_wb_progression_score * w.d2_wb_progression_weight
    + w.d3_wb_resolution_score * w.d3_wb_resolution_weight
  ) * 100, 2) AS cat_d_pts,

  -- Stored JSON breakdown (per-criterion contribution from last ETL)
  (w.criteria_breakdown -> 'A_login' ->> 'contribution')::numeric * 100 AS json_a_login_pts,
  (w.criteria_breakdown -> 'B_attendance' ->> 'contribution')::numeric * 100 AS json_b_attendance_pts,
  (w.criteria_breakdown -> 'C1_ttfa' ->> 'contribution')::numeric * 100 AS json_c1_pts,
  (w.criteria_breakdown -> 'C2_coverage' ->> 'contribution')::numeric * 100 AS json_c2_pts,
  (w.criteria_breakdown -> 'C3_case_progression' ->> 'contribution')::numeric * 100 AS json_c3_pts,
  (w.criteria_breakdown -> 'C4_resolution' ->> 'contribution')::numeric * 100 AS json_c4_pts,
  (w.criteria_breakdown -> 'D1_uptake' ->> 'contribution')::numeric * 100 AS json_d1_pts,
  (w.criteria_breakdown -> 'D2_wb_progression' ->> 'contribution')::numeric * 100 AS json_d2_pts,
  (w.criteria_breakdown -> 'D3_wb_resolution' ->> 'contribution')::numeric * 100 AS json_d3_pts

FROM with_ei w
ORDER BY w.ei_recomputed DESC, w.faculty_name;


-- =============================================================================
-- Optional: single faculty deep-dive (replace faculty id)
-- =============================================================================
/*
SELECT
  snapshot_date,
  dimension_name,
  criteria_breakdown
FROM effectiveness_scores_by_dimension
WHERE dimension_type = 'faculty'
  AND dimension_id = 'YOUR_FACULTY_ID'
ORDER BY snapshot_date DESC
LIMIT 5;
*/


-- =============================================================================
-- Optional: all snapshot dates for trend cross-check
-- =============================================================================
/*
SELECT
  snapshot_date,
  dimension_name,
  ei_score,
  ei_rating,
  total_alerts,
  alerts_with_intervention,
  median_days_to_first_action,
  open_faculty_cases,
  faculty_cases_progression_ok,
  wb_referred_cases
FROM effectiveness_scores_by_dimension
WHERE dimension_type = 'faculty'
ORDER BY dimension_name, snapshot_date DESC;
*/
