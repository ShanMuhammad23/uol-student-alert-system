import { enrolledInCurrentTermSql } from "@/lib/academic-term";
import { pool } from "@/lib/db";

export type InterventionReminderScope =
  | { role: "dean"; facultyId: string }
  | { role: "hod"; departmentIds: string[] }
  | { role: "instructor"; pernr: string };

export type InterventionOpenOutOfAlertCounts = {
  /** Intervened students who are out of alert but latest case is still open. */
  openOutOfAlertCount: number;
  /** Distinct students with at least one intervention in scope. */
  totalIntervenedCount: number;
};

export type InterventionOpenOutOfAlertRow = {
  sapId: string;
  studentName: string;
  addedByName: string;
  status: string;
};

export type InterventionOpenOutOfAlertData = InterventionOpenOutOfAlertCounts & {
  rows: InterventionOpenOutOfAlertRow[];
};

const OPEN_STATUSES = ["initiated", "in-progress", "referred"] as const;

function pushScopeParam(scope: InterventionReminderScope, params: unknown[]): number {
  if (scope.role === "dean") {
    params.push(scope.facultyId);
    return params.length;
  }
  if (scope.role === "hod") {
    params.push(scope.departmentIds);
    return params.length;
  }
  params.push(scope.pernr);
  return params.length;
}

function enrollmentScopeSql(scope: InterventionReminderScope, paramIdx: number): string {
  if (scope.role === "dean") {
    return `${enrolledInCurrentTermSql("e")} AND e.faculty_id = $${paramIdx}`;
  }
  if (scope.role === "hod") {
    return `${enrolledInCurrentTermSql("e")} AND e.department_id = ANY($${paramIdx}::text[])`;
  }
  return `${enrolledInCurrentTermSql("e")} AND e.instructor_pernr = $${paramIdx}`;
}

function alertEnrollmentScopeSql(
  scope: InterventionReminderScope,
  paramIdx: number,
  alias: string
): string {
  if (scope.role === "dean") {
    return `${alias}.faculty_id = $${paramIdx}`;
  }
  if (scope.role === "hod") {
    return `${alias}.department_id = ANY($${paramIdx}::text[])`;
  }
  return `${alias}.instructor_pernr = $${paramIdx}`;
}

export async function getIntervenedStudentsOpenOutOfAlertCounts(
  scope: InterventionReminderScope
): Promise<InterventionOpenOutOfAlertCounts> {
  const data = await getIntervenedStudentsOpenOutOfAlertData(scope);
  return {
    openOutOfAlertCount: data.openOutOfAlertCount,
    totalIntervenedCount: data.totalIntervenedCount,
  };
}

export async function getIntervenedStudentsOpenOutOfAlertData(
  scope: InterventionReminderScope
): Promise<InterventionOpenOutOfAlertData> {
  if (!pool) {
    return { openOutOfAlertCount: 0, totalIntervenedCount: 0, rows: [] };
  }

  const params: unknown[] = [];
  const scopeParamIdx = pushScopeParam(scope, params);
  params.push([...OPEN_STATUSES]);
  const openStatusIdx = params.length;

  const enrollmentScope = enrollmentScopeSql(scope, scopeParamIdx);
  const alertEnrollmentScope = alertEnrollmentScopeSql(scope, scopeParamIdx, "e2");

  const baseCte = `
      WITH scoped_students AS (
        SELECT DISTINCT e.sap_id
        FROM student_enrollment_current e
        WHERE ${enrollmentScope}
      ),
      latest_intervention AS (
        SELECT DISTINCT ON (i.student_sap_id)
          i.id,
          i.student_sap_id,
          i.status,
          i.staff_id,
          i.performed_at
        FROM interventions i
        JOIN scoped_students ss ON ss.sap_id = i.student_sap_id
        ORDER BY i.student_sap_id, i.performed_at DESC
      ),
      out_of_alert AS (
        SELECT ss.sap_id
        FROM scoped_students ss
        WHERE NOT EXISTS (
          SELECT 1
          FROM student_enrollment_current e2
          JOIN student_alert_current a
            ON a.sap_id = e2.sap_id
           AND a.course_id = e2.course_id
           AND a.section_code = e2.section_code
           AND a.event_package_id = e2.event_package_id
          WHERE ${enrolledInCurrentTermSql("e2")}
            AND e2.sap_id = ss.sap_id
            AND ${alertEnrollmentScope}
            AND a.overall_alert_level IN ('warning', 'critical')
        )
      )`;

  try {
    const countRes = await pool.query<{
      open_out_of_alert_count: number;
      total_intervened_count: number;
    }>(
      `
      ${baseCte}
      SELECT
        COUNT(*) FILTER (
          WHERE li.status = ANY($${openStatusIdx}::text[])
            AND oa.sap_id IS NOT NULL
        )::int AS open_out_of_alert_count,
        COUNT(*)::int AS total_intervened_count
      FROM latest_intervention li
      LEFT JOIN out_of_alert oa ON oa.sap_id = li.student_sap_id
      `,
      params
    );

    const listRes = await pool.query<{
      sap_id: string;
      student_name: string;
      added_by_name: string;
      status: string;
    }>(
      `
      ${baseCte},
      listed AS (
        SELECT
          li.student_sap_id AS sap_id,
          COALESCE(NULLIF(TRIM(st.full_name), ''), li.student_sap_id) AS student_name,
          COALESCE(NULLIF(TRIM(s.name), ''), '—') AS added_by_name,
          li.status,
          li.performed_at
        FROM latest_intervention li
        INNER JOIN out_of_alert oa ON oa.sap_id = li.student_sap_id
        LEFT JOIN students st ON st.sap_id = li.student_sap_id
        LEFT JOIN staff s ON s.id = li.staff_id
        WHERE li.status = ANY($${openStatusIdx}::text[])
      )
      SELECT sap_id, student_name, added_by_name, status
      FROM listed
      ORDER BY performed_at DESC
      `,
      params
    );

    const countRow = countRes.rows[0];
    const rows: InterventionOpenOutOfAlertRow[] = listRes.rows.map((r) => ({
      sapId: String(r.sap_id),
      studentName: String(r.student_name ?? r.sap_id),
      addedByName: String(r.added_by_name ?? "—"),
      status: String(r.status ?? ""),
    }));

    return {
      openOutOfAlertCount: Number(countRow?.open_out_of_alert_count ?? 0),
      totalIntervenedCount: Number(countRow?.total_intervened_count ?? 0),
      rows,
    };
  } catch {
    return { openOutOfAlertCount: 0, totalIntervenedCount: 0, rows: [] };
  }
}
