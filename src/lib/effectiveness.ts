import { pool } from "@/lib/db";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import type { EiCriterionCode } from "@/lib/ei-metric-definitions";
import {
  type EffectivenessDimensionType,
  type EffectivenessRawRow,
  type EffectivenessScoreRow,
  type EffectivenessTrendPoint,
  type EiRating,
  normalizeDateString,
  scoreEffectivenessRow,
} from "@/lib/effectiveness-scoring";

export type {
  EffectivenessDimensionType,
  EffectivenessRawRow,
  EffectivenessScoreRow,
  EffectivenessTrendPoint,
  EiCriterionBreakdown,
  EiRating,
  FeiRating,
} from "@/lib/effectiveness-scoring";

export {
  computeEiRating,
  computeFeiRating,
  computeSustainedScore,
  normalizeDateString,
  scoreEffectivenessRow,
  scoreTimePenalty,
} from "@/lib/effectiveness-scoring";

type EffectivenessBuildOptions = {
  facultyIds?: string[];
};

const BUILD_EFFECTIVENESS_SQL = `
  WITH enrollment_dim AS (
    SELECT
      e.sap_id,
      'faculty'::text AS dimension_type,
      e.faculty_id AS dimension_id,
      COALESCE(NULLIF(TRIM(f.name), ''), e.faculty_id) AS dimension_name
    FROM student_enrollment_current e
    LEFT JOIN faculties f ON f.id = e.faculty_id
    WHERE e.is_active = TRUE
      AND e.faculty_id IS NOT NULL
      AND e.faculty_id <> ''
      AND e.faculty_id = ANY($2::text[])

    UNION ALL

    SELECT
      e.sap_id,
      'department'::text AS dimension_type,
      e.department_id AS dimension_id,
      COALESCE(NULLIF(TRIM(d.name), ''), e.department_id) AS dimension_name
    FROM student_enrollment_current e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.is_active = TRUE
      AND e.department_id IS NOT NULL
      AND e.department_id <> ''
      AND e.faculty_id = ANY($2::text[])

    UNION ALL

    SELECT
      e.sap_id,
      'instructor'::text AS dimension_type,
      e.instructor_pernr AS dimension_id,
      COALESCE(
        NULLIF(TRIM(s.name), ''),
        NULLIF(TRIM(e.instructor_name), ''),
        e.instructor_pernr
      ) AS dimension_name
    FROM student_enrollment_current e
    LEFT JOIN staff s ON s.pernr = e.instructor_pernr
    WHERE e.is_active = TRUE
      AND e.instructor_pernr IS NOT NULL
      AND e.instructor_pernr <> ''
      AND e.faculty_id = ANY($2::text[])
  ),
  dim_keys AS (
    SELECT DISTINCT dimension_type, dimension_id, dimension_name
    FROM enrollment_dim
  ),
  enrollment_match AS (
    SELECT
      p.dimension_type,
      p.dimension_id,
      e.sap_id,
      e.course_id,
      e.section_code,
      e.event_package_id
    FROM dim_keys p
    JOIN student_enrollment_current e
      ON e.is_active = TRUE
     AND e.sap_id IN (
       SELECT sap_id FROM enrollment_dim ed
       WHERE ed.dimension_type = p.dimension_type AND ed.dimension_id = p.dimension_id
     )
     AND (
          (p.dimension_type = 'faculty' AND e.faculty_id = p.dimension_id) OR
          (p.dimension_type = 'department' AND e.department_id = p.dimension_id) OR
          (p.dimension_type = 'instructor' AND e.instructor_pernr = p.dimension_id)
     )
  ),
  staff_scope AS (
    SELECT DISTINCT
      'faculty'::text AS dimension_type,
      f.id AS dimension_id,
      s.id AS staff_id,
      s.last_login_at
    FROM faculties f
    JOIN staff s ON s.faculty_id = f.id
    WHERE f.id = ANY($2::text[])
      AND s.role IN ('instructor', 'dean', 'hod')

    UNION

    SELECT DISTINCT
      'department'::text,
      d.id,
      s.id,
      s.last_login_at
    FROM departments d
    JOIN student_enrollment_current e
      ON e.department_id = d.id
     AND e.is_active = TRUE
     AND e.faculty_id = ANY($2::text[])
    JOIN staff s ON s.pernr = e.instructor_pernr
    WHERE d.faculty_id = ANY($2::text[])

    UNION

    SELECT DISTINCT
      'department'::text,
      sd.department_id,
      s.id,
      s.last_login_at
    FROM staff_departments sd
    JOIN departments d ON d.id = sd.department_id
    JOIN staff s ON s.id = sd.staff_id
    WHERE d.faculty_id = ANY($2::text[])

    UNION

    SELECT DISTINCT
      'instructor'::text,
      s.pernr,
      s.id,
      s.last_login_at
    FROM staff s
    JOIN student_enrollment_current e ON e.instructor_pernr = s.pernr
    WHERE e.is_active = TRUE
      AND e.faculty_id = ANY($2::text[])
      AND s.pernr IS NOT NULL
      AND s.pernr <> ''
  ),
  login_counts AS (
    SELECT
      dimension_type,
      dimension_id,
      COUNT(DISTINCT staff_id)::int AS login_total_users,
      COUNT(DISTINCT staff_id) FILTER (
        WHERE last_login_at IS NOT NULL
          AND last_login_at >= NOW() - INTERVAL '7 days'
      )::int AS login_users_meeting_pi
    FROM staff_scope
    GROUP BY dimension_type, dimension_id
  ),
  course_attendance AS (
    SELECT
      em.dimension_type,
      em.dimension_id,
      em.course_id,
      em.section_code,
      MAX(COALESCE(a.total_classes_held, 0))::int AS classes_held,
      MAX(COALESCE(a.attendance_marked_classes, 0))::int AS classes_posted
    FROM enrollment_match em
    LEFT JOIN student_alert_current a
      ON a.sap_id = em.sap_id
     AND a.course_id = em.course_id
     AND a.section_code = em.section_code
     AND a.event_package_id = em.event_package_id
    GROUP BY em.dimension_type, em.dimension_id, em.course_id, em.section_code
  ),
  attendance_agg AS (
    SELECT
      dimension_type,
      dimension_id,
      COALESCE(SUM(classes_held), 0)::int AS classes_held_total,
      COALESCE(SUM(classes_posted), 0)::int AS classes_posted_total
    FROM course_attendance
    GROUP BY dimension_type, dimension_id
  ),
  alerted AS (
    SELECT DISTINCT
      em.dimension_type,
      em.dimension_id,
      em.sap_id,
      em.course_id,
      em.section_code,
      em.event_package_id
    FROM enrollment_match em
    JOIN student_alert_current a
      ON a.sap_id = em.sap_id
     AND a.course_id = em.course_id
     AND a.section_code = em.section_code
     AND a.event_package_id = em.event_package_id
    WHERE a.overall_alert_level IN ('warning', 'critical')
  ),
  scoped_interventions AS (
    SELECT
      em.dimension_type,
      em.dimension_id,
      i.student_sap_id,
      i.status,
      i.case_type,
      i.performed_at,
      i.staff_id,
      i.course_id
    FROM interventions i
    JOIN enrollment_match em ON em.sap_id = i.student_sap_id
    WHERE
      em.dimension_type = 'faculty'
      OR (em.dimension_type = 'department' AND i.department_id = em.dimension_id)
      OR (
        em.dimension_type = 'instructor'
        AND (
          i.staff_id IN (SELECT id FROM staff WHERE pernr = em.dimension_id)
          OR i.course_id = em.course_id
        )
      )
  ),
  alerted_students AS (
    SELECT DISTINCT dimension_type, dimension_id, sap_id
    FROM alerted
  ),
  alert_counts AS (
    SELECT
      dimension_type,
      dimension_id,
      COUNT(*)::int AS total_alerts
    FROM alerted_students
    GROUP BY dimension_type, dimension_id
  ),
  first_alert AS (
    SELECT
      al.dimension_type,
      al.dimension_id,
      al.sap_id,
      al.course_id,
      al.section_code,
      al.event_package_id,
      COALESCE(
        (
          SELECT MIN(sad.snapshot_date)
          FROM student_alert_daily sad
          WHERE sad.sap_id = al.sap_id
            AND sad.course_id = al.course_id
            AND sad.section_code = al.section_code
            AND sad.event_package_id = al.event_package_id
            AND sad.overall_alert_level IN ('warning', 'critical')
            AND sad.snapshot_date > COALESCE(
              (
                SELECT MAX(sad_clear.snapshot_date)
                FROM student_alert_daily sad_clear
                WHERE sad_clear.sap_id = al.sap_id
                  AND sad_clear.course_id = al.course_id
                  AND sad_clear.section_code = al.section_code
                  AND sad_clear.event_package_id = al.event_package_id
                  AND sad_clear.overall_alert_level = 'none'
              ),
              '1970-01-01'::date
            )
        ),
        (
          SELECT (a.computed_at AT TIME ZONE 'UTC')::date
          FROM student_alert_current a
          WHERE a.sap_id = al.sap_id
            AND a.course_id = al.course_id
            AND a.section_code = al.section_code
            AND a.event_package_id = al.event_package_id
            AND a.overall_alert_level IN ('warning', 'critical')
        )
      ) AS first_alert_date
    FROM alerted al
  ),
  student_first_alert AS (
    SELECT
      dimension_type,
      dimension_id,
      sap_id,
      MIN(first_alert_date) AS first_alert_date
    FROM first_alert
    WHERE first_alert_date IS NOT NULL
    GROUP BY dimension_type, dimension_id, sap_id
  ),
  alerts_intervened AS (
    SELECT
      ast.dimension_type,
      ast.dimension_id,
      COUNT(*)::int AS alerts_with_intervention
    FROM alerted_students ast
    WHERE EXISTS (
      SELECT 1
      FROM scoped_interventions si
      WHERE si.dimension_type = ast.dimension_type
        AND si.dimension_id = ast.dimension_id
        AND si.student_sap_id = ast.sap_id
    )
    GROUP BY ast.dimension_type, ast.dimension_id
  ),
  student_first_action AS (
    SELECT
      sfa.dimension_type,
      sfa.dimension_id,
      sfa.sap_id,
      GREATEST(
        0,
        EXTRACT(
          EPOCH FROM (
            COALESCE(
              MIN(si.performed_at) FILTER (
                WHERE si.performed_at >= (sfa.first_alert_date::timestamp AT TIME ZONE 'UTC')
              ),
              MIN(si.performed_at)
            ) - (sfa.first_alert_date::timestamp AT TIME ZONE 'UTC')
          )
        ) / 86400.0
      ) AS days_to_action
    FROM student_first_alert sfa
    JOIN scoped_interventions si
      ON si.dimension_type = sfa.dimension_type
     AND si.dimension_id = sfa.dimension_id
     AND si.student_sap_id = sfa.sap_id
    GROUP BY
      sfa.dimension_type,
      sfa.dimension_id,
      sfa.sap_id,
      sfa.first_alert_date
  ),
  ttfa_median AS (
    SELECT
      dimension_type,
      dimension_id,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_action) AS median_days
    FROM student_first_action
    WHERE days_to_action IS NOT NULL
    GROUP BY dimension_type, dimension_id
  ),
  latest_case_status AS (
    SELECT DISTINCT ON (si.dimension_type, si.dimension_id, si.student_sap_id)
      si.dimension_type,
      si.dimension_id,
      si.student_sap_id,
      si.status
    FROM scoped_interventions si
    WHERE EXISTS (
      SELECT 1
      FROM alerted_students ast
      WHERE ast.dimension_type = si.dimension_type
        AND ast.dimension_id = si.dimension_id
        AND ast.sap_id = si.student_sap_id
    )
    ORDER BY si.dimension_type, si.dimension_id, si.student_sap_id, si.performed_at DESC
  ),
  faculty_case_counts AS (
    SELECT
      dimension_type,
      dimension_id,
      COUNT(DISTINCT student_sap_id)::int AS faculty_total_cases,
      COUNT(DISTINCT student_sap_id) FILTER (
        WHERE status IN ('referred', 'resolved', 'no-action-required')
      )::int AS faculty_cases_closed_or_referred,
      COUNT(DISTINCT student_sap_id) FILTER (
        WHERE status IN ('initiated', 'in-progress')
      )::int AS open_faculty_cases
    FROM latest_case_status
    GROUP BY dimension_type, dimension_id
  ),
  intervention_gaps AS (
    SELECT
      si.dimension_type,
      si.dimension_id,
      si.student_sap_id,
      si.performed_at,
      LAG(si.performed_at) OVER (
        PARTITION BY si.dimension_type, si.dimension_id, si.student_sap_id
        ORDER BY si.performed_at
      ) AS prev_at
    FROM scoped_interventions si
    WHERE EXISTS (
      SELECT 1
      FROM alerted_students ast
      WHERE ast.dimension_type = si.dimension_type
        AND ast.dimension_id = si.dimension_id
        AND ast.sap_id = si.student_sap_id
    )
  ),
  students_bad_gap AS (
    SELECT DISTINCT dimension_type, dimension_id, student_sap_id
    FROM intervention_gaps
    WHERE prev_at IS NOT NULL
      AND performed_at - prev_at > INTERVAL '10 days'
  ),
  faculty_progression AS (
    SELECT
      lcs.dimension_type,
      lcs.dimension_id,
      COUNT(DISTINCT lcs.student_sap_id) FILTER (
        WHERE lcs.status IN ('initiated', 'in-progress')
          AND NOT EXISTS (
            SELECT 1
            FROM students_bad_gap bg
            WHERE bg.dimension_type = lcs.dimension_type
              AND bg.dimension_id = lcs.dimension_id
              AND bg.student_sap_id = lcs.student_sap_id
          )
      )::int AS faculty_cases_progression_ok
    FROM latest_case_status lcs
    GROUP BY lcs.dimension_type, lcs.dimension_id
  ),
  referred_cases AS (
    SELECT DISTINCT
      si.dimension_type,
      si.dimension_id,
      si.student_sap_id,
      MIN(si.performed_at) AS referred_at
    FROM scoped_interventions si
    WHERE si.status = 'referred' OR si.case_type = 'referred'
    GROUP BY si.dimension_type, si.dimension_id, si.student_sap_id
  ),
  wb_referred_counts AS (
    SELECT
      dimension_type,
      dimension_id,
      COUNT(*)::int AS wb_referred_cases
    FROM referred_cases
    GROUP BY dimension_type, dimension_id
  ),
  wb_first_touch AS (
    SELECT
      rc.dimension_type,
      rc.dimension_id,
      rc.student_sap_id,
      EXTRACT(
        EPOCH FROM (
          LEAST(
            COALESCE((
              SELECT MIN(wc.opened_at)
              FROM wellbeing_cases wc
              WHERE wc.student_sap_id = rc.student_sap_id
                AND wc.opened_at >= rc.referred_at
            ), 'infinity'::timestamptz),
            COALESCE((
              SELECT MIN(wdc.created_at)
              FROM wellbeing_direct_cases wdc
              WHERE wdc.student_sap_id = rc.student_sap_id
                AND wdc.created_at >= rc.referred_at
            ), 'infinity'::timestamptz),
            COALESCE((
              SELECT MIN(i2.performed_at)
              FROM interventions i2
              JOIN staff ws ON ws.id = i2.staff_id
              WHERE i2.student_sap_id = rc.student_sap_id
                AND ws.role IN ('wellbeing', 'wellbeing-counseller', 'wellbeing-head')
                AND i2.performed_at >= rc.referred_at
            ), 'infinity'::timestamptz)
          ) - rc.referred_at
        )
      ) / 86400.0 AS days_to_uptake
    FROM referred_cases rc
  ),
  wb_uptake_median AS (
    SELECT
      dimension_type,
      dimension_id,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_uptake) AS median_days
    FROM wb_first_touch
    WHERE days_to_uptake IS NOT NULL
      AND days_to_uptake >= 0
      AND days_to_uptake < 100000
    GROUP BY dimension_type, dimension_id
  ),
  wb_staff_interventions AS (
    SELECT
      rc.dimension_type,
      rc.dimension_id,
      rc.student_sap_id,
      i.performed_at
    FROM referred_cases rc
    JOIN interventions i ON i.student_sap_id = rc.student_sap_id
    JOIN staff ws ON ws.id = i.staff_id
    WHERE ws.role IN ('wellbeing', 'wellbeing-counseller', 'wellbeing-head')
      AND i.performed_at >= rc.referred_at
  ),
  wb_intervention_gaps AS (
    SELECT
      dimension_type,
      dimension_id,
      student_sap_id,
      performed_at,
      LAG(performed_at) OVER (
        PARTITION BY dimension_type, dimension_id, student_sap_id
        ORDER BY performed_at
      ) AS prev_at
    FROM wb_staff_interventions
  ),
  wb_students_bad_gap AS (
    SELECT DISTINCT dimension_type, dimension_id, student_sap_id
    FROM wb_intervention_gaps
    WHERE prev_at IS NOT NULL
      AND performed_at - prev_at > INTERVAL '10 days'
  ),
  wb_latest_status AS (
    SELECT DISTINCT ON (rc.dimension_type, rc.dimension_id, rc.student_sap_id)
      rc.dimension_type,
      rc.dimension_id,
      rc.student_sap_id,
      COALESCE(wc.wellbeing_status, wdc.direct_case_status, 'open') AS wb_status
    FROM referred_cases rc
    LEFT JOIN wellbeing_cases wc ON wc.student_sap_id = rc.student_sap_id
    LEFT JOIN wellbeing_direct_cases wdc ON wdc.student_sap_id = rc.student_sap_id
    ORDER BY rc.dimension_type, rc.dimension_id, rc.student_sap_id, wc.updated_at DESC NULLS LAST
  ),
  wb_case_counts AS (
    SELECT
      rc.dimension_type,
      rc.dimension_id,
      COUNT(DISTINCT rc.student_sap_id) FILTER (
        WHERE wls.wb_status IN ('initiated', 'in-progress', 'open')
      )::int AS wb_open_cases,
      COUNT(DISTINCT rc.student_sap_id) FILTER (
        WHERE wls.wb_status IN ('closed', 'resolved', 'no-action-required')
      )::int AS wb_cases_closed
    FROM referred_cases rc
    LEFT JOIN wb_latest_status wls
      ON wls.dimension_type = rc.dimension_type
     AND wls.dimension_id = rc.dimension_id
     AND wls.student_sap_id = rc.student_sap_id
    GROUP BY rc.dimension_type, rc.dimension_id
  ),
  wb_progression AS (
    SELECT
      rc.dimension_type,
      rc.dimension_id,
      COUNT(DISTINCT rc.student_sap_id) FILTER (
        WHERE wls.wb_status IN ('initiated', 'in-progress', 'open')
          AND NOT EXISTS (
            SELECT 1
            FROM wb_students_bad_gap bg
            WHERE bg.dimension_type = rc.dimension_type
              AND bg.dimension_id = rc.dimension_id
              AND bg.student_sap_id = rc.student_sap_id
          )
      )::int AS wb_cases_progression_ok
    FROM referred_cases rc
    LEFT JOIN wb_latest_status wls
      ON wls.dimension_type = rc.dimension_type
     AND wls.dimension_id = rc.dimension_id
     AND wls.student_sap_id = rc.student_sap_id
    GROUP BY rc.dimension_type, rc.dimension_id
  ),
  pop_counts AS (
    SELECT dimension_type, dimension_id, COUNT(DISTINCT sap_id)::int AS total_students
    FROM enrollment_dim
    GROUP BY dimension_type, dimension_id
  )
  SELECT
    $1::date AS snapshot_date,
    dk.dimension_type::text AS dimension_type,
    dk.dimension_id::text AS dimension_id,
    dk.dimension_name::text AS dimension_name,
    COALESCE(pc.total_students, 0)::int AS total_students,
    COALESCE(lc.login_users_meeting_pi, 0)::int AS login_users_meeting_pi,
    COALESCE(lc.login_total_users, 0)::int AS login_total_users,
    COALESCE(aa.classes_held_total, 0)::int AS classes_held_total,
    COALESCE(aa.classes_posted_total, 0)::int AS classes_posted_total,
    COALESCE(ac.total_alerts, 0)::int AS total_alerts,
    COALESCE(ai.alerts_with_intervention, 0)::int AS alerts_with_intervention,
    tm.median_days::float AS median_days_to_first_action,
    COALESCE(fcc.open_faculty_cases, 0)::int AS open_faculty_cases,
    COALESCE(fp.faculty_cases_progression_ok, 0)::int AS faculty_cases_progression_ok,
    COALESCE(fcc.faculty_total_cases, 0)::int AS faculty_total_cases,
    COALESCE(fcc.faculty_cases_closed_or_referred, 0)::int AS faculty_cases_closed_or_referred,
    COALESCE(wrc.wb_referred_cases, 0)::int AS wb_referred_cases,
    wum.median_days::float AS median_days_to_wb_uptake,
    COALESCE(wcc.wb_open_cases, 0)::int AS wb_open_cases,
    COALESCE(wp.wb_cases_progression_ok, 0)::int AS wb_cases_progression_ok,
    COALESCE(wcc.wb_cases_closed, 0)::int AS wb_cases_closed
  FROM dim_keys dk
  LEFT JOIN pop_counts pc
    ON pc.dimension_type = dk.dimension_type AND pc.dimension_id = dk.dimension_id
  LEFT JOIN login_counts lc
    ON lc.dimension_type = dk.dimension_type AND lc.dimension_id = dk.dimension_id
  LEFT JOIN attendance_agg aa
    ON aa.dimension_type = dk.dimension_type AND aa.dimension_id = dk.dimension_id
  LEFT JOIN alert_counts ac
    ON ac.dimension_type = dk.dimension_type AND ac.dimension_id = dk.dimension_id
  LEFT JOIN alerts_intervened ai
    ON ai.dimension_type = dk.dimension_type AND ai.dimension_id = dk.dimension_id
  LEFT JOIN ttfa_median tm
    ON tm.dimension_type = dk.dimension_type AND tm.dimension_id = dk.dimension_id
  LEFT JOIN faculty_case_counts fcc
    ON fcc.dimension_type = dk.dimension_type AND fcc.dimension_id = dk.dimension_id
  LEFT JOIN faculty_progression fp
    ON fp.dimension_type = dk.dimension_type AND fp.dimension_id = dk.dimension_id
  LEFT JOIN wb_referred_counts wrc
    ON wrc.dimension_type = dk.dimension_type AND wrc.dimension_id = dk.dimension_id
  LEFT JOIN wb_uptake_median wum
    ON wum.dimension_type = dk.dimension_type AND wum.dimension_id = dk.dimension_id
  LEFT JOIN wb_case_counts wcc
    ON wcc.dimension_type = dk.dimension_type AND wcc.dimension_id = dk.dimension_id
  LEFT JOIN wb_progression wp
    ON wp.dimension_type = dk.dimension_type AND wp.dimension_id = dk.dimension_id
  ORDER BY dk.dimension_type, dk.dimension_name
`;

export function resolveEffectivenessDimensionName(
  row: Pick<EffectivenessScoreRow, "dimension_type" | "dimension_id" | "dimension_name">
): string {
  if (row.dimension_type === "faculty") {
    return (
      resolveFacultyNameFromIdOrName(row.dimension_id, row.dimension_name) ??
      row.dimension_name
    );
  }
  return row.dimension_name;
}

export function withResolvedEffectivenessNames(
  rows: EffectivenessScoreRow[]
): EffectivenessScoreRow[] {
  return rows.map((row) => {
    const dimension_name = resolveEffectivenessDimensionName(row);
    return dimension_name === row.dimension_name ? row : { ...row, dimension_name };
  });
}

function normalizeRawRow(row: EffectivenessRawRow): EffectivenessRawRow {
  return {
    ...row,
    snapshot_date: normalizeDateString(row.snapshot_date),
    total_students: Number(row.total_students ?? 0),
    login_users_meeting_pi: Number(row.login_users_meeting_pi ?? 0),
    login_total_users: Number(row.login_total_users ?? 0),
    classes_held_total: Number(row.classes_held_total ?? 0),
    classes_posted_total: Number(row.classes_posted_total ?? 0),
    total_alerts: Number(row.total_alerts ?? 0),
    alerts_with_intervention: Number(row.alerts_with_intervention ?? 0),
    median_days_to_first_action:
      row.median_days_to_first_action != null
        ? Number(row.median_days_to_first_action)
        : null,
    open_faculty_cases: Number(row.open_faculty_cases ?? 0),
    faculty_cases_progression_ok: Number(row.faculty_cases_progression_ok ?? 0),
    faculty_total_cases: Number(row.faculty_total_cases ?? 0),
    faculty_cases_closed_or_referred: Number(
      row.faculty_cases_closed_or_referred ?? 0
    ),
    wb_referred_cases: Number(row.wb_referred_cases ?? 0),
    median_days_to_wb_uptake:
      row.median_days_to_wb_uptake != null ? Number(row.median_days_to_wb_uptake) : null,
    wb_open_cases: Number(row.wb_open_cases ?? 0),
    wb_cases_progression_ok: Number(row.wb_cases_progression_ok ?? 0),
    wb_cases_closed: Number(row.wb_cases_closed ?? 0),
  };
}

function dbRowToRaw(row: Record<string, unknown>): EffectivenessRawRow {
  return normalizeRawRow({
    snapshot_date: String(row.snapshot_date ?? ""),
    dimension_type: row.dimension_type as EffectivenessRawRow["dimension_type"],
    dimension_id: String(row.dimension_id ?? ""),
    dimension_name: String(row.dimension_name ?? ""),
    total_students: Number(row.total_students ?? 0),
    login_users_meeting_pi: Number(row.login_users_meeting_pi ?? 0),
    login_total_users: Number(row.login_total_users ?? 0),
    classes_held_total: Number(row.classes_held_total ?? 0),
    classes_posted_total: Number(row.classes_posted_total ?? 0),
    total_alerts: Number(row.total_alerts ?? row.alerted_students ?? 0),
    alerts_with_intervention: Number(
      row.alerts_with_intervention ?? row.intervened_students ?? 0
    ),
    median_days_to_first_action:
      row.median_days_to_first_action != null
        ? Number(row.median_days_to_first_action)
        : row.median_days_to_contact != null
          ? Number(row.median_days_to_contact)
          : null,
    open_faculty_cases: Number(row.open_faculty_cases ?? row.open_interventions ?? 0),
    faculty_cases_progression_ok: Number(row.faculty_cases_progression_ok ?? 0),
    faculty_total_cases: Number(row.faculty_total_cases ?? row.intervened_students ?? 0),
    faculty_cases_closed_or_referred: Number(
      row.faculty_cases_closed_or_referred ?? row.concluded_students ?? 0
    ),
    wb_referred_cases: Number(row.wb_referred_cases ?? row.referred_students ?? 0),
    median_days_to_wb_uptake:
      row.wb_median_days_to_uptake != null
        ? Number(row.wb_median_days_to_uptake)
        : null,
    wb_open_cases: Number(row.wb_open_cases ?? 0),
    wb_cases_progression_ok: Number(row.wb_cases_progression_ok ?? 0),
    wb_cases_closed: Number(row.wb_cases_closed ?? 0),
  });
}

function hydrateScoreRow(row: Record<string, unknown>): EffectivenessScoreRow {
  return scoreEffectivenessRow(dbRowToRaw(row));
}

export async function buildEffectivenessRows(
  snapshotDate?: string,
  options?: EffectivenessBuildOptions
): Promise<EffectivenessScoreRow[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const date = snapshotDate ?? new Date().toISOString().slice(0, 10);
  const scopedFacultyIds = Array.from(
    new Set((options?.facultyIds ?? []).map((v) => String(v).trim()).filter(Boolean))
  );
  if (!scopedFacultyIds.length) {
    throw new Error(
      "facultyIds is required for effectiveness scores (global scores are disabled)."
    );
  }

  const res = await pool.query<EffectivenessRawRow>(BUILD_EFFECTIVENESS_SQL, [
    date,
    scopedFacultyIds,
  ]);

  return withResolvedEffectivenessNames(
    res.rows.map((row) => scoreEffectivenessRow(normalizeRawRow(row)))
  );
}

export async function upsertEffectivenessRows(rows: EffectivenessScoreRow[]): Promise<number> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  if (!rows.length) return 0;

  await pool.query("BEGIN");
  try {
    const sql = `
      INSERT INTO effectiveness_scores_by_dimension (
        snapshot_date,
        dimension_type,
        dimension_id,
        dimension_name,
        total_students,
        login_users_meeting_pi,
        login_total_users,
        classes_held_total,
        classes_posted_total,
        total_alerts,
        alerts_with_intervention,
        median_days_to_first_action,
        open_faculty_cases,
        faculty_cases_progression_ok,
        faculty_total_cases,
        faculty_cases_closed_or_referred,
        wb_referred_cases,
        wb_median_days_to_uptake,
        wb_open_cases,
        wb_cases_progression_ok,
        wb_cases_closed,
        intervention_coverage_pct,
        attendance_posting_pct,
        ei_score,
        ei_rating,
        fei_score,
        fei_rating,
        criteria_breakdown,
        alerted_students,
        intervened_students,
        referred_students,
        concluded_students,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,$31,$32,NOW()
      )
      ON CONFLICT (snapshot_date, dimension_type, dimension_id)
      DO UPDATE SET
        dimension_name = EXCLUDED.dimension_name,
        total_students = EXCLUDED.total_students,
        login_users_meeting_pi = EXCLUDED.login_users_meeting_pi,
        login_total_users = EXCLUDED.login_total_users,
        classes_held_total = EXCLUDED.classes_held_total,
        classes_posted_total = EXCLUDED.classes_posted_total,
        total_alerts = EXCLUDED.total_alerts,
        alerts_with_intervention = EXCLUDED.alerts_with_intervention,
        median_days_to_first_action = EXCLUDED.median_days_to_first_action,
        open_faculty_cases = EXCLUDED.open_faculty_cases,
        faculty_cases_progression_ok = EXCLUDED.faculty_cases_progression_ok,
        faculty_total_cases = EXCLUDED.faculty_total_cases,
        faculty_cases_closed_or_referred = EXCLUDED.faculty_cases_closed_or_referred,
        wb_referred_cases = EXCLUDED.wb_referred_cases,
        wb_median_days_to_uptake = EXCLUDED.wb_median_days_to_uptake,
        wb_open_cases = EXCLUDED.wb_open_cases,
        wb_cases_progression_ok = EXCLUDED.wb_cases_progression_ok,
        wb_cases_closed = EXCLUDED.wb_cases_closed,
        intervention_coverage_pct = EXCLUDED.intervention_coverage_pct,
        attendance_posting_pct = EXCLUDED.attendance_posting_pct,
        ei_score = EXCLUDED.ei_score,
        ei_rating = EXCLUDED.ei_rating,
        fei_score = EXCLUDED.fei_score,
        fei_rating = EXCLUDED.fei_rating,
        criteria_breakdown = EXCLUDED.criteria_breakdown,
        alerted_students = EXCLUDED.alerted_students,
        intervened_students = EXCLUDED.intervened_students,
        referred_students = EXCLUDED.referred_students,
        concluded_students = EXCLUDED.concluded_students,
        updated_at = NOW()
    `;

    for (const row of rows) {
      await pool.query(sql, [
        row.snapshot_date,
        row.dimension_type,
        row.dimension_id,
        row.dimension_name,
        row.total_students,
        row.login_users_meeting_pi,
        row.login_total_users,
        row.classes_held_total,
        row.classes_posted_total,
        row.total_alerts,
        row.alerts_with_intervention,
        row.median_days_to_first_action,
        row.open_faculty_cases,
        row.faculty_cases_progression_ok,
        row.faculty_total_cases,
        row.faculty_cases_closed_or_referred,
        row.wb_referred_cases,
        row.median_days_to_wb_uptake,
        row.wb_open_cases,
        row.wb_cases_progression_ok,
        row.wb_cases_closed,
        row.intervention_coverage_pct,
        row.attendance_posting_pct,
        row.ei_score,
        row.ei_rating,
        row.fei_score,
        row.fei_rating,
        JSON.stringify(row.criteria_breakdown),
        row.total_alerts,
        row.alerts_with_intervention,
        row.wb_referred_cases,
        row.faculty_cases_closed_or_referred,
      ]);
    }

    await pool.query("COMMIT");
    return rows.length;
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export type EffectivenessQueryOptions = {
  snapshotDate?: string;
  dimensionType?: EffectivenessDimensionType;
  facultyIds?: string[];
  departmentIds?: string[];
  instructorPernrs?: string[];
  live?: boolean;
};

export async function getEffectivenessScores(
  options?: EffectivenessQueryOptions
): Promise<EffectivenessScoreRow[]> {
  if (!pool) return [];

  if (options?.live && options.facultyIds?.length) {
    return buildEffectivenessRows(options.snapshotDate, {
      facultyIds: options.facultyIds,
    });
  }

  const params: unknown[] = [];
  const where: string[] = [];

  if (options?.snapshotDate) {
    params.push(options.snapshotDate);
    where.push(`snapshot_date = $${params.length}::date`);
  } else {
    where.push(
      `snapshot_date = (SELECT MAX(snapshot_date) FROM effectiveness_scores_by_dimension)`
    );
  }

  if (options?.dimensionType) {
    params.push(options.dimensionType);
    where.push(`dimension_type = $${params.length}`);
  }

  if (options?.departmentIds?.length) {
    params.push(options.departmentIds);
    where.push(`(dimension_type <> 'department' OR dimension_id = ANY($${params.length}::text[]))`);
  }

  if (options?.instructorPernrs?.length) {
    params.push(options.instructorPernrs);
    where.push(
      `(dimension_type <> 'instructor' OR dimension_id = ANY($${params.length}::text[]))`
    );
  }

  if (options?.facultyIds?.length) {
    params.push(options.facultyIds);
    where.push(`
      (
        (dimension_type = 'faculty' AND dimension_id = ANY($${params.length}::text[]))
        OR (
          dimension_type = 'department'
          AND dimension_id IN (
            SELECT id FROM departments WHERE faculty_id = ANY($${params.length}::text[])
          )
        )
        OR (
          dimension_type = 'instructor'
          AND dimension_id IN (
            SELECT DISTINCT instructor_pernr
            FROM student_enrollment_current
            WHERE faculty_id = ANY($${params.length}::text[])
              AND instructor_pernr IS NOT NULL
              AND instructor_pernr <> ''
          )
        )
      )
    `);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await pool.query(
    `
      SELECT *
      FROM effectiveness_scores_by_dimension
      ${whereClause}
      ORDER BY dimension_type, COALESCE(ei_score, fei_score) DESC, dimension_name
    `,
    params
  );

  return withResolvedEffectivenessNames(res.rows.map((row) => hydrateScoreRow(row)));
}

export async function getEffectivenessTrend(
  facultyIds: string[],
  snapshotLimit = 5
): Promise<EffectivenessTrendPoint[]> {
  if (!pool || !facultyIds.length) return [];

  const res = await pool.query<EffectivenessTrendPoint>(
    `
      WITH ranked_dates AS (
        SELECT DISTINCT snapshot_date
        FROM effectiveness_scores_by_dimension
        WHERE dimension_type = 'faculty'
          AND dimension_id = ANY($1::text[])
        ORDER BY snapshot_date DESC
        LIMIT $2
      )
      SELECT
        e.snapshot_date::text AS snapshot_date,
        e.dimension_id::text AS dimension_id,
        COALESCE(e.ei_score, e.fei_score)::float AS ei_score,
        COALESCE(e.ei_score, e.fei_score)::float AS fei_score
      FROM effectiveness_scores_by_dimension e
      JOIN ranked_dates d ON d.snapshot_date = e.snapshot_date
      WHERE e.dimension_type = 'faculty'
        AND e.dimension_id = ANY($1::text[])
      ORDER BY e.snapshot_date ASC, e.dimension_name ASC
    `,
    [facultyIds, snapshotLimit]
  );

  return res.rows.map((row) => ({
    ...row,
    snapshot_date: normalizeDateString(row.snapshot_date),
    ei_score: Number(row.ei_score ?? 0),
    fei_score: Number(row.fei_score ?? row.ei_score ?? 0),
  }));
}

export async function getLatestEffectivenessSnapshotDate(): Promise<string | null> {
  if (!pool) return null;
  try {
    const res = await pool.query<{ snapshot_date: string }>(
      `SELECT MAX(snapshot_date)::text AS snapshot_date FROM effectiveness_scores_by_dimension`
    );
    const raw = res.rows[0]?.snapshot_date;
    return raw != null ? normalizeDateString(raw) : null;
  } catch {
    return null;
  }
}

export type { EiCriterionCode };
