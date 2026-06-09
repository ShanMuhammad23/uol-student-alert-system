import { pool } from "@/lib/db";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";

export type EffectivenessDimensionType = "faculty" | "department";

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

export type FeiRating = "A" | "B" | "C" | "D" | "E";

type EffectivenessBuildOptions = {
  facultyIds?: string[];
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

export function computeFeiRating(feiScore: number): FeiRating {
  if (feiScore >= 85) return "A";
  if (feiScore >= 70) return "B";
  if (feiScore >= 55) return "C";
  if (feiScore >= 40) return "D";
  return "E";
}

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

  const fei_score =
    Math.round(
      (0.3 * outcome_score +
        0.25 * wellbeing_score +
        0.25 * response_score +
        0.1 * readiness_score +
        0.1 *
          avg([
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
          ])) *
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

  const res = await pool.query<EffectivenessRawRow>(
    `
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
      ),
      pop AS (
        SELECT DISTINCT sap_id, dimension_type, dimension_id, dimension_name
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
        FROM pop p
        JOIN student_enrollment_current e
          ON e.is_active = TRUE
         AND e.sap_id = p.sap_id
         AND (
              (p.dimension_type = 'faculty' AND e.faculty_id = p.dimension_id) OR
              (p.dimension_type = 'department' AND e.department_id = p.dimension_id)
         )
      ),
      alerted AS (
        SELECT DISTINCT
          em.dimension_type,
          em.dimension_id,
          em.sap_id,
          MAX(
            CASE
              WHEN a.overall_alert_level = 'critical' THEN 1
              ELSE 0
            END
          ) AS is_critical
        FROM enrollment_match em
        JOIN student_alert_current a
          ON a.sap_id = em.sap_id
         AND a.course_id = em.course_id
         AND a.section_code = em.section_code
         AND a.event_package_id = em.event_package_id
        WHERE a.overall_alert_level IN ('warning', 'critical')
        GROUP BY em.dimension_type, em.dimension_id, em.sap_id
      ),
      latest_intervention AS (
        SELECT DISTINCT ON (i.student_sap_id, em.dimension_type, em.dimension_id)
          em.dimension_type,
          em.dimension_id,
          i.student_sap_id,
          i.status,
          i.performed_at,
          i.case_type
        FROM interventions i
        JOIN enrollment_match em
          ON em.sap_id = i.student_sap_id
         AND (
              (em.dimension_type = 'faculty' AND i.faculty_id = em.dimension_id) OR
              (em.dimension_type = 'department' AND i.department_id = em.dimension_id)
         )
        ORDER BY i.student_sap_id, em.dimension_type, em.dimension_id, i.performed_at DESC
      ),
      intervened AS (
        SELECT DISTINCT
          al.dimension_type,
          al.dimension_id,
          al.sap_id AS student_sap_id,
          al.is_critical AS was_critical
        FROM alerted al
        WHERE EXISTS (
          SELECT 1
          FROM interventions i
          WHERE i.student_sap_id = al.sap_id
            AND (
              (al.dimension_type = 'faculty' AND i.faculty_id = al.dimension_id) OR
              (al.dimension_type = 'department' AND i.department_id = al.dimension_id)
            )
        )
      ),
      referred AS (
        SELECT DISTINCT
          li.dimension_type,
          li.dimension_id,
          li.student_sap_id
        FROM latest_intervention li
        WHERE li.status = 'referred' OR li.case_type = 'referred'
      ),
      wellbeing_linked AS (
        SELECT DISTINCT
          r.dimension_type,
          r.dimension_id,
          r.student_sap_id
        FROM referred r
        WHERE EXISTS (
          SELECT 1
          FROM wellbeing_cases wc
          WHERE wc.student_sap_id = r.student_sap_id
        )
        OR EXISTS (
          SELECT 1
          FROM wellbeing_direct_cases wdc
          WHERE wdc.student_sap_id = r.student_sap_id
        )
      ),
      still_alerted AS (
        SELECT DISTINCT
          em.dimension_type,
          em.dimension_id,
          em.sap_id
        FROM enrollment_match em
        JOIN student_alert_current a
          ON a.sap_id = em.sap_id
         AND a.course_id = em.course_id
         AND a.section_code = em.section_code
         AND a.event_package_id = em.event_package_id
        WHERE a.overall_alert_level IN ('warning', 'critical')
      ),
      recovered AS (
        SELECT DISTINCT
          iv.dimension_type,
          iv.dimension_id,
          iv.student_sap_id AS sap_id
        FROM intervened iv
        WHERE NOT EXISTS (
          SELECT 1
          FROM still_alerted sa
          WHERE sa.dimension_type = iv.dimension_type
            AND sa.dimension_id = iv.dimension_id
            AND sa.sap_id = iv.student_sap_id
        )
      ),
      repeat_alert AS (
        SELECT DISTINCT
          al.dimension_type,
          al.dimension_id,
          al.sap_id
        FROM alerted al
        JOIN latest_intervention li
          ON li.dimension_type = al.dimension_type
         AND li.dimension_id = al.dimension_id
         AND li.student_sap_id = al.sap_id
        WHERE li.status IN ('resolved', 'no-action-required')
      ),
      open_interventions AS (
        SELECT
          li.dimension_type,
          li.dimension_id,
          COUNT(*)::int AS open_count,
          COUNT(*) FILTER (
            WHERE li.status IN ('initiated', 'in-progress')
              AND li.performed_at < NOW() - INTERVAL '14 days'
          )::int AS stale_count
        FROM latest_intervention li
        WHERE li.status IN ('initiated', 'in-progress', 'referred')
        GROUP BY li.dimension_type, li.dimension_id
      ),
      first_alert AS (
        SELECT
          em.dimension_type,
          em.dimension_id,
          em.sap_id,
          MIN(sad.snapshot_date) AS first_alert_date
        FROM enrollment_match em
        JOIN student_alert_daily sad
          ON sad.sap_id = em.sap_id
         AND sad.course_id = em.course_id
         AND sad.section_code = em.section_code
         AND sad.event_package_id = em.event_package_id
        WHERE sad.overall_alert_level IN ('warning', 'critical')
        GROUP BY em.dimension_type, em.dimension_id, em.sap_id
      ),
      first_contact AS (
        SELECT
          fa.dimension_type,
          fa.dimension_id,
          fa.sap_id,
          EXTRACT(
            EPOCH FROM (
              MIN(i.performed_at) - fa.first_alert_date::timestamptz
            )
          ) / 86400.0 AS days_to_contact
        FROM first_alert fa
        JOIN interventions i ON i.student_sap_id = fa.sap_id
        JOIN enrollment_match em
          ON em.sap_id = fa.sap_id
         AND em.dimension_type = fa.dimension_type
         AND em.dimension_id = fa.dimension_id
         AND (
              (fa.dimension_type = 'faculty' AND i.faculty_id = fa.dimension_id) OR
              (fa.dimension_type = 'department' AND i.department_id = fa.dimension_id)
         )
        GROUP BY fa.dimension_type, fa.dimension_id, fa.sap_id, fa.first_alert_date
      ),
      contact_median AS (
        SELECT
          dimension_type,
          dimension_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_contact) AS median_days
        FROM first_contact
        WHERE days_to_contact IS NOT NULL AND days_to_contact >= 0
        GROUP BY dimension_type, dimension_id
      ),
      attendance_posting AS (
        SELECT
          em.dimension_type,
          em.dimension_id,
          CASE
            WHEN SUM(COALESCE(a.total_classes_held, 0)) > 0 THEN
              100.0 * SUM(COALESCE(a.attendance_marked_classes, 0))
              / SUM(COALESCE(a.total_classes_held, 0))
            ELSE NULL
          END AS posting_pct
        FROM enrollment_match em
        JOIN student_alert_current a
          ON a.sap_id = em.sap_id
         AND a.course_id = em.course_id
         AND a.section_code = em.section_code
         AND a.event_package_id = em.event_package_id
        GROUP BY em.dimension_type, em.dimension_id
      ),
      dim_keys AS (
        SELECT DISTINCT dimension_type, dimension_id, dimension_name
        FROM pop
      ),
      pop_counts AS (
        SELECT dimension_type, dimension_id, COUNT(DISTINCT sap_id)::int AS total_students
        FROM pop
        GROUP BY dimension_type, dimension_id
      ),
      alerted_counts AS (
        SELECT
          dimension_type,
          dimension_id,
          COUNT(DISTINCT sap_id)::int AS alerted_students,
          COUNT(DISTINCT sap_id) FILTER (WHERE is_critical = 1)::int AS critical_alerted_students
        FROM alerted
        GROUP BY dimension_type, dimension_id
      ),
      intervened_counts AS (
        SELECT
          dimension_type,
          dimension_id,
          COUNT(DISTINCT student_sap_id)::int AS intervened_students,
          COUNT(DISTINCT student_sap_id) FILTER (WHERE was_critical = 1)::int AS critical_intervened_students
        FROM intervened
        GROUP BY dimension_type, dimension_id
      ),
      referred_counts AS (
        SELECT dimension_type, dimension_id, COUNT(DISTINCT student_sap_id)::int AS referred_students
        FROM referred
        GROUP BY dimension_type, dimension_id
      ),
      wellbeing_counts AS (
        SELECT dimension_type, dimension_id, COUNT(DISTINCT student_sap_id)::int AS wellbeing_linked_students
        FROM wellbeing_linked
        GROUP BY dimension_type, dimension_id
      ),
      recovered_counts AS (
        SELECT dimension_type, dimension_id, COUNT(DISTINCT sap_id)::int AS recovered_students
        FROM recovered
        GROUP BY dimension_type, dimension_id
      ),
      repeat_counts AS (
        SELECT dimension_type, dimension_id, COUNT(DISTINCT sap_id)::int AS repeat_alert_students
        FROM repeat_alert
        GROUP BY dimension_type, dimension_id
      )
      SELECT
        $1::date AS snapshot_date,
        dk.dimension_type::text AS dimension_type,
        dk.dimension_id::text AS dimension_id,
        dk.dimension_name::text AS dimension_name,
        COALESCE(pc.total_students, 0)::int AS total_students,
        COALESCE(ac.alerted_students, 0)::int AS alerted_students,
        COALESCE(ac.critical_alerted_students, 0)::int AS critical_alerted_students,
        COALESCE(ic.intervened_students, 0)::int AS intervened_students,
        COALESCE(ic.critical_intervened_students, 0)::int AS critical_intervened_students,
        COALESCE(rc.referred_students, 0)::int AS referred_students,
        COALESCE(wb.wellbeing_linked_students, 0)::int AS wellbeing_linked_students,
        COALESCE(rv.recovered_students, 0)::int AS recovered_students,
        COALESCE(rp.repeat_alert_students, 0)::int AS repeat_alert_students,
        COALESCE(oi.stale_count, 0)::int AS stale_interventions,
        COALESCE(oi.open_count, 0)::int AS open_interventions,
        cm.median_days::float AS median_days_to_contact,
        ap.posting_pct::float AS attendance_posting_pct
      FROM dim_keys dk
      LEFT JOIN pop_counts pc
        ON pc.dimension_type = dk.dimension_type AND pc.dimension_id = dk.dimension_id
      LEFT JOIN alerted_counts ac
        ON ac.dimension_type = dk.dimension_type AND ac.dimension_id = dk.dimension_id
      LEFT JOIN intervened_counts ic
        ON ic.dimension_type = dk.dimension_type AND ic.dimension_id = dk.dimension_id
      LEFT JOIN referred_counts rc
        ON rc.dimension_type = dk.dimension_type AND rc.dimension_id = dk.dimension_id
      LEFT JOIN wellbeing_counts wb
        ON wb.dimension_type = dk.dimension_type AND wb.dimension_id = dk.dimension_id
      LEFT JOIN recovered_counts rv
        ON rv.dimension_type = dk.dimension_type AND rv.dimension_id = dk.dimension_id
      LEFT JOIN repeat_counts rp
        ON rp.dimension_type = dk.dimension_type AND rp.dimension_id = dk.dimension_id
      LEFT JOIN open_interventions oi
        ON oi.dimension_type = dk.dimension_type AND oi.dimension_id = dk.dimension_id
      LEFT JOIN contact_median cm
        ON cm.dimension_type = dk.dimension_type AND cm.dimension_id = dk.dimension_id
      LEFT JOIN attendance_posting ap
        ON ap.dimension_type = dk.dimension_type AND ap.dimension_id = dk.dimension_id
      ORDER BY dk.dimension_type, dk.dimension_name
    `,
    [date, scopedFacultyIds]
  );

  return withResolvedEffectivenessNames(
    res.rows.map((row) =>
      scoreEffectivenessRow({
        ...row,
        total_students: Number(row.total_students ?? 0),
        alerted_students: Number(row.alerted_students ?? 0),
        critical_alerted_students: Number(row.critical_alerted_students ?? 0),
        intervened_students: Number(row.intervened_students ?? 0),
        critical_intervened_students: Number(row.critical_intervened_students ?? 0),
        referred_students: Number(row.referred_students ?? 0),
        wellbeing_linked_students: Number(row.wellbeing_linked_students ?? 0),
        recovered_students: Number(row.recovered_students ?? 0),
        repeat_alert_students: Number(row.repeat_alert_students ?? 0),
        stale_interventions: Number(row.stale_interventions ?? 0),
        open_interventions: Number(row.open_interventions ?? 0),
        median_days_to_contact:
          row.median_days_to_contact != null ? Number(row.median_days_to_contact) : null,
        attendance_posting_pct:
          row.attendance_posting_pct != null ? Number(row.attendance_posting_pct) : null,
      })
    )
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
        alerted_students,
        critical_alerted_students,
        intervened_students,
        critical_intervened_students,
        referred_students,
        wellbeing_linked_students,
        recovered_students,
        repeat_alert_students,
        stale_interventions,
        open_interventions,
        intervention_coverage_pct,
        critical_coverage_pct,
        median_days_to_contact,
        stale_intervention_pct,
        referral_rate_pct,
        wellbeing_uptake_pct,
        alert_recovery_pct,
        repeat_alert_pct,
        attendance_posting_pct,
        response_score,
        wellbeing_score,
        outcome_score,
        readiness_score,
        fei_score,
        fei_rating,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW()
      )
      ON CONFLICT (snapshot_date, dimension_type, dimension_id)
      DO UPDATE SET
        dimension_name = EXCLUDED.dimension_name,
        total_students = EXCLUDED.total_students,
        alerted_students = EXCLUDED.alerted_students,
        critical_alerted_students = EXCLUDED.critical_alerted_students,
        intervened_students = EXCLUDED.intervened_students,
        critical_intervened_students = EXCLUDED.critical_intervened_students,
        referred_students = EXCLUDED.referred_students,
        wellbeing_linked_students = EXCLUDED.wellbeing_linked_students,
        recovered_students = EXCLUDED.recovered_students,
        repeat_alert_students = EXCLUDED.repeat_alert_students,
        stale_interventions = EXCLUDED.stale_interventions,
        open_interventions = EXCLUDED.open_interventions,
        intervention_coverage_pct = EXCLUDED.intervention_coverage_pct,
        critical_coverage_pct = EXCLUDED.critical_coverage_pct,
        median_days_to_contact = EXCLUDED.median_days_to_contact,
        stale_intervention_pct = EXCLUDED.stale_intervention_pct,
        referral_rate_pct = EXCLUDED.referral_rate_pct,
        wellbeing_uptake_pct = EXCLUDED.wellbeing_uptake_pct,
        alert_recovery_pct = EXCLUDED.alert_recovery_pct,
        repeat_alert_pct = EXCLUDED.repeat_alert_pct,
        attendance_posting_pct = EXCLUDED.attendance_posting_pct,
        response_score = EXCLUDED.response_score,
        wellbeing_score = EXCLUDED.wellbeing_score,
        outcome_score = EXCLUDED.outcome_score,
        readiness_score = EXCLUDED.readiness_score,
        fei_score = EXCLUDED.fei_score,
        fei_rating = EXCLUDED.fei_rating,
        updated_at = NOW()
    `;

    for (const row of rows) {
      await pool.query(sql, [
        row.snapshot_date,
        row.dimension_type,
        row.dimension_id,
        row.dimension_name,
        row.total_students,
        row.alerted_students,
        row.critical_alerted_students,
        row.intervened_students,
        row.critical_intervened_students,
        row.referred_students,
        row.wellbeing_linked_students,
        row.recovered_students,
        row.repeat_alert_students,
        row.stale_interventions,
        row.open_interventions,
        row.intervention_coverage_pct,
        row.critical_coverage_pct,
        row.median_days_to_contact,
        row.stale_intervention_pct,
        row.referral_rate_pct,
        row.wellbeing_uptake_pct,
        row.alert_recovery_pct,
        row.repeat_alert_pct,
        row.attendance_posting_pct,
        row.response_score,
        row.wellbeing_score,
        row.outcome_score,
        row.readiness_score,
        row.fei_score,
        row.fei_rating,
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
      )
    `);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await pool.query<EffectivenessScoreRow>(
    `
      SELECT *
      FROM effectiveness_scores_by_dimension
      ${whereClause}
      ORDER BY dimension_type, fei_score DESC, dimension_name
    `,
    params
  );

  return withResolvedEffectivenessNames(
    res.rows.map((row) => ({
      ...row,
      total_students: Number(row.total_students ?? 0),
      alerted_students: Number(row.alerted_students ?? 0),
      critical_alerted_students: Number(row.critical_alerted_students ?? 0),
      intervened_students: Number(row.intervened_students ?? 0),
      critical_intervened_students: Number(row.critical_intervened_students ?? 0),
      referred_students: Number(row.referred_students ?? 0),
      wellbeing_linked_students: Number(row.wellbeing_linked_students ?? 0),
      recovered_students: Number(row.recovered_students ?? 0),
      repeat_alert_students: Number(row.repeat_alert_students ?? 0),
      stale_interventions: Number(row.stale_interventions ?? 0),
      open_interventions: Number(row.open_interventions ?? 0),
      median_days_to_contact:
        row.median_days_to_contact != null ? Number(row.median_days_to_contact) : null,
      attendance_posting_pct:
        row.attendance_posting_pct != null ? Number(row.attendance_posting_pct) : null,
      intervention_coverage_pct:
        row.intervention_coverage_pct != null ? Number(row.intervention_coverage_pct) : null,
      critical_coverage_pct:
        row.critical_coverage_pct != null ? Number(row.critical_coverage_pct) : null,
      stale_intervention_pct:
        row.stale_intervention_pct != null ? Number(row.stale_intervention_pct) : null,
      referral_rate_pct: row.referral_rate_pct != null ? Number(row.referral_rate_pct) : null,
      wellbeing_uptake_pct:
        row.wellbeing_uptake_pct != null ? Number(row.wellbeing_uptake_pct) : null,
      alert_recovery_pct:
        row.alert_recovery_pct != null ? Number(row.alert_recovery_pct) : null,
      repeat_alert_pct: row.repeat_alert_pct != null ? Number(row.repeat_alert_pct) : null,
      response_score: Number(row.response_score ?? 0),
      wellbeing_score: Number(row.wellbeing_score ?? 0),
      outcome_score: Number(row.outcome_score ?? 0),
      readiness_score: Number(row.readiness_score ?? 0),
      fei_score: Number(row.fei_score ?? 0),
      fei_rating: (row.fei_rating ?? "E") as FeiRating,
    }))
  );
}

export async function getLatestEffectivenessSnapshotDate(): Promise<string | null> {
  if (!pool) return null;
  try {
    const res = await pool.query<{ snapshot_date: string }>(
      `SELECT MAX(snapshot_date)::text AS snapshot_date FROM effectiveness_scores_by_dimension`
    );
    return res.rows[0]?.snapshot_date ?? null;
  } catch {
    return null;
  }
}
