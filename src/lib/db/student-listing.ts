import { pool } from "@/lib/db";
import {
  WELLBEING_RESOLUTION_BY_VALUE,
  WELLBEING_RESOLUTION_OPTIONS,
  type WellbeingResolutionValue,
} from "@/lib/wellbeing-resolution-options";

export type AlertDimensionFilter = "all" | "red" | "yellow" | "good";

export type ListingFilters = {
  department_ids?: string[];
  programs?: string[];
  instructor_ids?: string[];
  course_ids?: string[];
  attendanceFilters?: AlertDimensionFilter[];
  classStatusFilters?: string[];
  gpaFilters?: AlertDimensionFilter[];
  interventionFilters?: string[];
  /** Wellbeing resolution keys (see `WELLBEING_RESOLUTION_OPTIONS`). */
  resolutionFilters?: string[];
  search?: string;
};

export type ListingSortKey =
  | "name"
  | "department"
  | "program"
  | "course"
  | "teacher"
  | "classesHeld"
  | "attendanceStats"
  | "attendance"
  | "gpa"
  | "intervention";

export type ListingSortDirection = "asc" | "desc";

export type ListingRequest = {
  filters?: ListingFilters;
  page?: number;
  pageSize?: number;
  sortKey?: ListingSortKey;
  sortDirection?: ListingSortDirection;
  /** When true, pagination/total is based on distinct students (sap_id). */
  uniqueStudents?: boolean;
  /** When true, also return distinct-student total without changing row shape. */
  uniqueStudentsForTotal?: boolean;
};

export type SessionScope = {
  role: "superadmin" | "dean" | "hod" | "instructor" | "wellbeing";
  faculty_id?: string | null;
  department_ids?: string[] | null;
  pernr?: string | null;
};

export type StudentListingRow = {
  sapId: string;
  studentName: string;
  departmentName: string;
  programTitle: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  sectionCode: string | null;
  eventPackageId: string | null;
  totalClassesHeld: number;
  /** Sessions with attendance posted (SAP Att); denominator for attendance %. */
  attendanceMarkedClasses: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaPrevious: number | null;
  gpaChange: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  latestInterventionStatus: string | null;
  latestWellbeingStatus: "open" | "closed" | null;
  latestWellbeingCategory: string | null;
  courseStudentCount: number;
  isActive: boolean;
};

export type StudentListingResult = {
  rows: StudentListingRow[];
  total: number;
  /** Distinct student count (sap_id), when requested. */
  totalUniqueStudents?: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100000;
const NOT_STARTED_INTERVENTION_STATUSES = ["not_started", "not-started"] as const;
const INTERVENTION_ELIGIBLE_SQL =
  "(a.gpa_alert_level IS NOT NULL OR a.attendance_alert_level IS NOT NULL)";
type InterventionContextColumns = {
  hasSectionCode: boolean;
  hasEventPackageId: boolean;
};
let interventionContextColumnsCache: InterventionContextColumns | null = null;

function toArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function normalizeInterventionFilters(filters?: string[]): string[] | undefined {
  const allowed = new Set([
    "not_started",
    "initiated",
    "in_progress",
    "referred",
    "resolved",
    "no_action_required",
  ]);
  const mapped = (filters ?? [])
    .map((v) => String(v).trim().toLowerCase())
    .map((v) => {
      if (v === "in_progress") return "in-progress";
      if (v === "no_action_required") return "no-action-required";
      return v;
    })
    .filter((v) =>
      allowed.has(
        v === "in-progress"
          ? "in_progress"
          : v === "no-action-required"
            ? "no_action_required"
            : v
      )
    );
  return mapped.length ? mapped : undefined;
}

function buildAlertLevelClause(
  columnSql: string,
  filters: AlertDimensionFilter[] | undefined,
  params: unknown[]
): string | null {
  if (!filters?.length) return null;
  if (filters.includes("all")) return null;
  const hasRed = filters.includes("red");
  const hasYellow = filters.includes("yellow");
  const hasGood = filters.includes("good");
  const checks: string[] = [];
  const values: string[] = [];
  if (hasRed) values.push("critical");
  if (hasYellow) values.push("warning");
  if (values.length) {
    params.push(values);
    checks.push(`${columnSql} = ANY($${params.length}::text[])`);
  }
  if (hasGood) checks.push(`${columnSql} IS NULL`);
  if (!checks.length) return "1=0";
  return checks.length === 1 ? checks[0] : `(${checks.join(" OR ")})`;
}

function buildOrderBy(sortKey?: ListingSortKey, sortDirection?: ListingSortDirection): string {
  const direction = sortDirection === "desc" ? "DESC" : "ASC";
  const key = sortKey ?? "name";
  const map: Record<ListingSortKey, string> = {
    name: "student_name",
    department: "department_name",
    program: "program_title",
    course: "course_sort_text",
    teacher: "instructor_name",
    classesHeld: "total_classes_held",
    attendanceStats: "(COALESCE(total_classes_held, 0) - COALESCE(attendance_marked_classes, 0))",
    attendance: "attendance_percentage",
    gpa: "gpa_current",
    intervention: "latest_intervention_status",
  };
  const col = map[key] ?? map.name;
  return `${col} ${direction}, sap_id ASC, course_id ASC, event_package_id ASC`;
}

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getInterventionContextColumns(): Promise<InterventionContextColumns> {
  if (!pool) {
    return { hasSectionCode: false, hasEventPackageId: false };
  }
  if (interventionContextColumnsCache) return interventionContextColumnsCache;
  const res = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'interventions'
        AND column_name IN ('section_code', 'event_package_id')
    `
  );
  const cols = new Set(res.rows.map((r) => String(r.column_name)));
  interventionContextColumnsCache = {
    hasSectionCode: cols.has("section_code"),
    hasEventPackageId: cols.has("event_package_id"),
  };
  return interventionContextColumnsCache;
}

type BaseQueryParts = {
  whereSql: string;
  params: unknown[];
};

export type ListingWhereSkip = "gpa" | "attendance" | "intervention" | "resolution";

function normalizeResolutionFilters(filters?: string[]): string[] | undefined {
  if (!filters?.length) return undefined;
  const allowed = new Set(
    WELLBEING_RESOLUTION_OPTIONS.map((o) => o.value as string)
  );
  const out = filters.map((v) => String(v).trim()).filter((v) => allowed.has(v));
  return out.length ? out : undefined;
}

const WB_STANDARD_CATEGORIES = `('Counselling', 'Monitoring', 'Flex (Academic)', 'Flex (Financial)')`;

function buildResolutionWhereClause(
  resolutionValues: string[] | undefined,
  params: unknown[]
): string | null {
  const normalized = normalizeResolutionFilters(resolutionValues);
  if (!normalized?.length) return null;
  const parts: string[] = [];
  for (const val of normalized) {
    const spec = WELLBEING_RESOLUTION_BY_VALUE.get(val as WellbeingResolutionValue);
    if (!spec) continue;
    if ("othersBucket" in spec && spec.othersBucket) {
      if (spec.closed) {
        parts.push(`EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = e.sap_id
          AND wb.category NOT IN ${WB_STANDARD_CATEGORIES}
          AND wb.wellbeing_status = 'closed'
      )`);
      } else {
        parts.push(`EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = e.sap_id
          AND wb.category NOT IN ${WB_STANDARD_CATEGORIES}
          AND wb.wellbeing_status <> 'closed'
      )`);
      }
      continue;
    }
    params.push(spec.category);
    const p = params.length;
    if (spec.closed) {
      parts.push(`EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = e.sap_id
          AND wb.category = $${p}::text
          AND wb.wellbeing_status = 'closed'
      )`);
    } else {
      parts.push(`EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = e.sap_id
          AND wb.category = $${p}::text
          AND wb.wellbeing_status <> 'closed'
      )`);
    }
  }
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0]! : `(${parts.join(" OR ")})`;
}

function buildWhere(
  scope: SessionScope,
  filters: ListingFilters,
  skip?: Set<ListingWhereSkip>
): BaseQueryParts {
  const params: unknown[] = [];
  const where: string[] = ["e.is_active = TRUE"];

  if (scope.role === "dean" && scope.faculty_id) {
    params.push(scope.faculty_id);
    where.push(`e.faculty_id = $${params.length}`);
  } else if (scope.role === "hod" && scope.department_ids?.length) {
    params.push(scope.department_ids);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  } else if (scope.role === "instructor" && scope.pernr) {
    params.push(scope.pernr);
    where.push(`e.instructor_pernr = $${params.length}`);
  } else if (scope.role === "wellbeing") {
    // Referred (intervention) OR closed case in wellbeing_cases — not intervention-only "resolved".
    where.push(`(
      latest.latest_intervention_status = 'referred'
      OR EXISTS (
        SELECT 1 FROM wellbeing_cases wb_list
        WHERE wb_list.student_sap_id = e.sap_id
          AND wb_list.wellbeing_status = 'closed'
      )
    )`);
  }

  const departmentIds = toArray(filters.department_ids);
  if (departmentIds?.length) {
    params.push(departmentIds);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  }
  const programIds = toArray(filters.programs);
  if (programIds?.length) {
    params.push(programIds);
    where.push(`e.program_id = ANY($${params.length}::text[])`);
  }
  const instructorIds = toArray(filters.instructor_ids);
  if (instructorIds?.length) {
    params.push(instructorIds);
    where.push(`e.instructor_pernr = ANY($${params.length}::text[])`);
  }
  const courseIds = toArray(filters.course_ids);
  if (courseIds?.length) {
    params.push(courseIds);
    where.push(`e.course_id = ANY($${params.length}::text[])`);
  }

  if (!skip?.has("attendance")) {
    const attendanceClause = buildAlertLevelClause(
      "a.attendance_alert_level",
      filters.attendanceFilters,
      params
    );
    if (attendanceClause) where.push(attendanceClause);
  }

  const classStatusFilters = toArray(filters.classStatusFilters);
  if (classStatusFilters?.length && !classStatusFilters.includes("all")) {
    const wantsAttendanceMissing = classStatusFilters.includes("attendance_missing");
    if (wantsAttendanceMissing) {
      where.push(
        `COALESCE(a.total_classes_held, 0) > COALESCE(a.attendance_marked_classes, 0)`
      );
    }
  }

  if (!skip?.has("gpa")) {
    const gpaClause = buildAlertLevelClause("a.gpa_alert_level", filters.gpaFilters, params);
    if (gpaClause) where.push(gpaClause);
  }

  const search = String(filters.search ?? "").trim();
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(e.student_name ILIKE $${i} OR e.sap_id ILIKE $${i})`);
  }

  if (!skip?.has("intervention") && scope.role !== "wellbeing") {
    const interventionFilters = normalizeInterventionFilters(filters.interventionFilters);
    if (interventionFilters?.length) {
      const wantsNotStarted = interventionFilters.includes("not_started");
      const statuses = interventionFilters.filter((s) => s !== "not_started");
      if (wantsNotStarted && statuses.length) {
        params.push(statuses);
        const statusesParamIndex = params.length;
        params.push([...NOT_STARTED_INTERVENTION_STATUSES]);
        const notStartedParamIndex = params.length;
        where.push(
          `(
            ${INTERVENTION_ELIGIBLE_SQL}
            AND (
              latest.latest_intervention_status IS NULL
              OR latest.latest_intervention_status = ANY($${notStartedParamIndex}::text[])
              OR latest.latest_intervention_status = ANY($${statusesParamIndex}::text[])
            )
          )`
        );
      } else if (wantsNotStarted) {
        params.push([...NOT_STARTED_INTERVENTION_STATUSES]);
        where.push(
          `(
            ${INTERVENTION_ELIGIBLE_SQL}
            AND (
              latest.latest_intervention_status IS NULL
              OR latest.latest_intervention_status = ANY($${params.length}::text[])
            )
          )`
        );
      } else {
        params.push(statuses);
        where.push(
          `(${INTERVENTION_ELIGIBLE_SQL} AND latest.latest_intervention_status = ANY($${params.length}::text[]))`
        );
      }
    }
  }

  if (!skip?.has("resolution")) {
    const resClause = buildResolutionWhereClause(filters.resolutionFilters, params);
    if (resClause) where.push(resClause);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function buildListingBaseCte(
  whereSql: string,
  interventionContext: InterventionContextColumns
): string {
  const latestSectionSelect = interventionContext.hasSectionCode
    ? "COALESCE(section_code, '') AS section_code"
    : "''::text AS section_code";
  const latestSectionOrder = interventionContext.hasSectionCode
    ? "COALESCE(section_code, '')"
    : "''";
  const latestPackageSelect = interventionContext.hasEventPackageId
    ? "COALESCE(event_package_id, '') AS event_package_id"
    : "''::text AS event_package_id";
  const latestPackageOrder = interventionContext.hasEventPackageId
    ? "COALESCE(event_package_id, '')"
    : "''";
  const latestContextJoin =
    interventionContext.hasSectionCode && interventionContext.hasEventPackageId
      ? `latest.course_id = e.course_id
           AND COALESCE(latest.section_code, '') = COALESCE(e.section_code, '')
           AND COALESCE(latest.event_package_id, '') = COALESCE(e.event_package_id, '')`
      : `latest.course_id = e.course_id`;
  return `
    WITH latest AS (
      SELECT DISTINCT ON (
        student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder},
        ${latestPackageOrder}
      )
        student_sap_id,
        COALESCE(course_id, '') AS course_id,
        ${latestSectionSelect},
        ${latestPackageSelect},
        status AS latest_intervention_status
      FROM interventions
      ORDER BY
        student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder},
        ${latestPackageOrder},
        performed_at DESC
    ),
    latest_wellbeing AS (
      SELECT DISTINCT ON (student_sap_id)
        student_sap_id,
        wellbeing_status AS latest_wellbeing_status,
        category AS latest_wellbeing_category
      FROM wellbeing_cases
      ORDER BY student_sap_id, updated_at DESC
    ),
    base AS (
      SELECT
        e.sap_id,
        COALESCE(NULLIF(TRIM(e.student_name), ''), e.sap_id) AS student_name,
        e.department_id,
        COALESCE(NULLIF(TRIM(d.name), ''), e.department_id) AS department_name,
        e.program_id,
        COALESCE(NULLIF(TRIM(p.title), ''), e.program_id, '—') AS program_title,
        e.course_id,
        COALESCE(NULLIF(TRIM(c.title), ''), e.course_id) AS course_title,
        e.section_code,
        e.event_package_id,
        COALESCE(NULLIF(TRIM(e.instructor_name), ''), e.instructor_pernr, '—') AS instructor_name,
        a.total_classes_held,
        a.attendance_marked_classes,
        a.classes_attended,
        a.attendance_percentage,
        a.class_average_attendance,
        a.attendance_alert_level,
        a.gpa_current,
        a.gpa_previous,
        a.gpa_change,
        a.gpa_alert_level,
        latest.latest_intervention_status,
        latest_wellbeing.latest_wellbeing_status,
        latest_wellbeing.latest_wellbeing_category,
        CONCAT(e.course_id, ' ', COALESCE(c.title, '')) AS course_sort_text,
        COUNT(*) OVER (
          PARTITION BY
            e.course_id,
            COALESCE(e.section_code, ''),
            COALESCE(e.program_id, ''),
            COALESCE(e.event_package_id, '')
        ) AS course_student_count,
        e.is_active
      FROM student_enrollment_current e
      LEFT JOIN student_alert_current a
        ON a.sap_id = e.sap_id
       AND a.course_id = e.course_id
       AND a.section_code = e.section_code
       AND a.event_package_id = e.event_package_id
      LEFT JOIN latest
        ON latest.student_sap_id = e.sap_id
       AND (
         (
           ${latestContextJoin}
         )
         OR latest.course_id = ''
       )
      LEFT JOIN latest_wellbeing
        ON latest_wellbeing.student_sap_id = e.sap_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN programs p ON p.id = e.program_id
      LEFT JOIN courses c ON c.id = e.course_id
      ${whereSql}
    )
  `;
}

export type FilterDropdownCounts = {
  gpa: { all: number; red: number; yellow: number; good: number };
  attendance: { all: number; red: number; yellow: number; good: number };
  intervention: {
    all: number;
    not_started: number;
    initiated: number;
    in_progress: number;
    referred: number;
    resolved: number;
    no_action_required: number;
  };
  /** Enrollment rows matching filters (excluding wellbeing), for the "All" wellbeing option. */
  wellbeingAll: number;
  wellbeing: number[];
};

/** Row counts per master-filter dropdown option; each group excludes its own filter so options reflect the rest of the filter stack. */
export async function getFilterDropdownCounts(
  scope: SessionScope,
  filters: ListingFilters
): Promise<FilterDropdownCounts | null> {
  if (!pool) return null;
  const interventionContext = await getInterventionContextColumns();

  const zeroWellbeing = WELLBEING_RESOLUTION_OPTIONS.map(() => 0);

  const eligibleSql = `(gpa_alert_level IS NOT NULL OR attendance_alert_level IS NOT NULL)`;

  try {
    const gpaParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["gpa"]));
    const gpaSql = `${buildListingBaseCte(gpaParts.whereSql, interventionContext)}
      , gpa_per_student AS (
        SELECT
          sap_id,
          COALESCE(BOOL_OR(gpa_alert_level = 'critical'), false) AS has_red,
          COALESCE(BOOL_OR(gpa_alert_level = 'warning'), false) AS has_yellow
        FROM base
        GROUP BY sap_id
      )
      SELECT
        COUNT(*)::int AS total_all,
        COUNT(*) FILTER (WHERE has_red)::int AS red,
        COUNT(*) FILTER (WHERE has_yellow AND NOT has_red)::int AS yellow,
        COUNT(*) FILTER (WHERE NOT has_red AND NOT has_yellow)::int AS good
      FROM gpa_per_student`;
    const gpaRes = await pool.query<{
      total_all: number;
      red: number;
      yellow: number;
      good: number;
    }>(gpaSql, gpaParts.params);
    const gRow = gpaRes.rows[0];

    const attParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["attendance"]));
    const attSql = `${buildListingBaseCte(attParts.whereSql, interventionContext)}
      , att_per_student AS (
        SELECT
          sap_id,
          COALESCE(BOOL_OR(attendance_alert_level = 'critical'), false) AS has_red,
          COALESCE(BOOL_OR(attendance_alert_level = 'warning'), false) AS has_yellow
        FROM base
        GROUP BY sap_id
      )
      SELECT
        COUNT(*)::int AS total_all,
        COUNT(*) FILTER (WHERE has_red)::int AS red,
        COUNT(*) FILTER (WHERE has_yellow AND NOT has_red)::int AS yellow,
        COUNT(*) FILTER (WHERE NOT has_red AND NOT has_yellow)::int AS good
      FROM att_per_student`;
    const attRes = await pool.query<{
      total_all: number;
      red: number;
      yellow: number;
      good: number;
    }>(attSql, attParts.params);
    const aRow = attRes.rows[0];

    const intParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["intervention"]));
    const intSql = `${buildListingBaseCte(intParts.whereSql, interventionContext)}
      SELECT
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql})::int AS int_all,
        COUNT(DISTINCT sap_id) FILTER (
          WHERE ${eligibleSql}
            AND (
              latest_intervention_status IS NULL
              OR latest_intervention_status = ANY(ARRAY['not_started', 'not-started']::text[])
            )
        )::int AS not_started,
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql} AND latest_intervention_status = 'initiated')::int AS initiated,
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql} AND latest_intervention_status = 'in-progress')::int AS in_progress,
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql} AND latest_intervention_status = 'referred')::int AS referred,
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql} AND latest_intervention_status = 'resolved')::int AS resolved,
        COUNT(DISTINCT sap_id) FILTER (WHERE ${eligibleSql} AND latest_intervention_status = 'no-action-required')::int AS no_action_required
      FROM base`;
    const intRes = await pool.query<{
      int_all: number;
      not_started: number;
      initiated: number;
      in_progress: number;
      referred: number;
      resolved: number;
      no_action_required: number;
    }>(intSql, intParts.params);
    const iRow = intRes.rows[0];

    let wellbeingAll = 0;
    let wellbeing = zeroWellbeing;
    try {
      const wbParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["resolution"]));
      const wbSelectParts: string[] = [];
      const wbParams = [...wbParts.params];
      for (let idx = 0; idx < WELLBEING_RESOLUTION_OPTIONS.length; idx++) {
        const spec = WELLBEING_RESOLUTION_OPTIONS[idx]!;
        let existsClosed: string;
        let existsOpen: string;
        if ("othersBucket" in spec && spec.othersBucket) {
          existsClosed = `EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = sap_id
          AND wb.category NOT IN ${WB_STANDARD_CATEGORIES}
          AND wb.wellbeing_status = 'closed'
      )`;
          existsOpen = `EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = sap_id
          AND wb.category NOT IN ${WB_STANDARD_CATEGORIES}
          AND wb.wellbeing_status <> 'closed'
      )`;
        } else {
          wbParams.push(spec.category);
          const p = wbParams.length;
          existsClosed = `EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = sap_id
          AND wb.category = $${p}::text
          AND wb.wellbeing_status = 'closed'
      )`;
          existsOpen = `EXISTS (
        SELECT 1 FROM wellbeing_cases wb
        WHERE wb.student_sap_id = sap_id
          AND wb.category = $${p}::text
          AND wb.wellbeing_status <> 'closed'
      )`;
        }
        const pred = spec.closed ? existsClosed : existsOpen;
        wbSelectParts.push(`COUNT(DISTINCT sap_id) FILTER (WHERE ${pred})::int AS wb_${idx}`);
      }
      const wbSql = `${buildListingBaseCte(wbParts.whereSql, interventionContext)}
      SELECT COUNT(DISTINCT sap_id)::int AS wb_all, ${wbSelectParts.join(", ")}
      FROM base`;
      const wbRes = await pool.query(wbSql, wbParams);
      const wbRow = wbRes.rows[0] as Record<string, number> | undefined;
      wellbeingAll = Number(wbRow?.wb_all ?? 0);
      wellbeing = WELLBEING_RESOLUTION_OPTIONS.map((_, idx) =>
        Number(wbRow?.[`wb_${idx}`] ?? 0)
      );
    } catch {
      wellbeingAll = 0;
      wellbeing = zeroWellbeing;
    }

    return {
      gpa: {
        all: Number(gRow?.total_all ?? 0),
        red: Number(gRow?.red ?? 0),
        yellow: Number(gRow?.yellow ?? 0),
        good: Number(gRow?.good ?? 0),
      },
      attendance: {
        all: Number(aRow?.total_all ?? 0),
        red: Number(aRow?.red ?? 0),
        yellow: Number(aRow?.yellow ?? 0),
        good: Number(aRow?.good ?? 0),
      },
      intervention: {
        all: Number(iRow?.int_all ?? 0),
        not_started: Number(iRow?.not_started ?? 0),
        initiated: Number(iRow?.initiated ?? 0),
        in_progress: Number(iRow?.in_progress ?? 0),
        referred: Number(iRow?.referred ?? 0),
        resolved: Number(iRow?.resolved ?? 0),
        no_action_required: Number(iRow?.no_action_required ?? 0),
      },
      wellbeingAll,
      wellbeing,
    };
  } catch {
    return {
      gpa: { all: 0, red: 0, yellow: 0, good: 0 },
      attendance: { all: 0, red: 0, yellow: 0, good: 0 },
      intervention: {
        all: 0,
        not_started: 0,
        initiated: 0,
        in_progress: 0,
        referred: 0,
        resolved: 0,
        no_action_required: 0,
      },
      wellbeingAll: 0,
      wellbeing: zeroWellbeing,
    };
  }
}

/** Distinct student SAP IDs matching the same scope/filters as the listing (for aggregates such as the wellbeing chart). */
export async function getDistinctSapIdsForScope(
  scope: SessionScope,
  filters: ListingFilters
): Promise<string[]> {
  if (!pool) return [];
  const interventionContext = await getInterventionContextColumns();
  const { whereSql, params } = buildWhere(scope, filters);
  const sql = `
    ${buildListingBaseCte(whereSql, interventionContext)}
    SELECT DISTINCT sap_id FROM base
  `;
  const res = await pool.query<{ sap_id: string }>(sql, params);
  return res.rows.map((r) => r.sap_id);
}

export async function getStudentListing(
  scope: SessionScope,
  request: ListingRequest
): Promise<StudentListingResult> {
  if (!pool) {
    return { rows: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 1 };
  }

  const page = Math.max(1, Number(request.page ?? 1) || 1);
  const pageSizeRaw = Number(request.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
  const offset = (page - 1) * pageSize;
  const orderBy = buildOrderBy(request.sortKey, request.sortDirection);
  const uniqueStudents = request.uniqueStudents === true;
  const uniqueStudentsForTotal = request.uniqueStudentsForTotal === true;

  const { whereSql, params } = buildWhere(scope, request.filters ?? {});
  const interventionContext = await getInterventionContextColumns();
  const baseCte = buildListingBaseCte(whereSql, interventionContext);

  const countSql = uniqueStudentsForTotal
    ? `${baseCte}
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(DISTINCT sap_id)::int AS total_unique_students
      FROM base`
    : uniqueStudents
      ? `${baseCte} SELECT COUNT(DISTINCT sap_id)::int AS total FROM base`
      : `${baseCte} SELECT COUNT(*)::int AS total FROM base`;

  type CountRow = {
    total?: number;
    total_rows?: number;
    total_unique_students?: number;
  };
  const countRes = await pool.query<CountRow>(countSql, params);
  const countRow = countRes.rows[0] ?? {};

  const total = uniqueStudents
    ? Number(countRow.total ?? 0)
    : uniqueStudentsForTotal
      ? Number(countRow.total_rows ?? 0)
      : Number(countRow.total ?? 0);

  const totalUniqueStudents = uniqueStudents
    ? total
    : uniqueStudentsForTotal
      ? Number(countRow.total_unique_students ?? 0)
      : undefined;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listParams = [...params, pageSize, offset];
  const limitParam = listParams.length - 1;
  const offsetParam = listParams.length;
  const rankedCte = uniqueStudents
    ? `
    , ranked AS (
      SELECT
        base.*,
        ROW_NUMBER() OVER (PARTITION BY sap_id ORDER BY ${orderBy}) AS rn
      FROM base
    )`
    : "";

  const listSql = `
    ${baseCte}${rankedCte}
    SELECT
      sap_id,
      student_name,
      department_name,
      program_title,
      course_id,
      course_title,
      instructor_name,
      NULLIF(section_code, '') AS section_code,
      NULLIF(event_package_id, '') AS event_package_id,
      COALESCE(total_classes_held, 0) AS total_classes_held,
      COALESCE(attendance_marked_classes, 0) AS attendance_marked_classes,
      COALESCE(classes_attended, 0) AS classes_attended,
      attendance_percentage,
      class_average_attendance,
      attendance_alert_level,
      gpa_current,
      gpa_previous,
      gpa_change,
      gpa_alert_level,
      latest_intervention_status,
      latest_wellbeing_status,
      latest_wellbeing_category,
      course_student_count,
      is_active
    FROM ${uniqueStudents ? "ranked" : "base"}
    ${uniqueStudents ? "WHERE rn = 1" : ""}
    ORDER BY ${orderBy}
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
  `;

  const listRes = await pool.query<{
    sap_id: string;
    student_name: string;
    department_name: string;
    program_title: string;
    course_id: string;
    course_title: string;
    instructor_name: string;
    section_code: string | null;
    event_package_id: string | null;
    total_classes_held: number;
    attendance_marked_classes: number;
    classes_attended: number;
    attendance_percentage: number | null;
    class_average_attendance: number | null;
    attendance_alert_level: "warning" | "critical" | null;
    gpa_current: number | null;
    gpa_previous: number | null;
    gpa_change: number | null;
    gpa_alert_level: "warning" | "critical" | null;
    latest_intervention_status: string | null;
    latest_wellbeing_status: "open" | "closed" | null;
    latest_wellbeing_category: string | null;
    course_student_count: number;
    is_active: boolean | null;
  }>(listSql, listParams);

  return {
    rows: listRes.rows.map((row) => ({
      sapId: row.sap_id,
      studentName: row.student_name,
      departmentName: row.department_name,
      programTitle: row.program_title,
      courseId: row.course_id,
      courseTitle: row.course_title,
      instructorName: row.instructor_name,
      sectionCode: row.section_code,
      eventPackageId: row.event_package_id,
      totalClassesHeld: (() => {
        const total = parseNumber(row.total_classes_held);
        return total;
      })(),
      attendanceMarkedClasses: parseNumber(row.attendance_marked_classes),
      classesAttended: (() => {
        return parseNumber(row.classes_attended);
      })(),
      attendancePercentage: (() => {
        return row.attendance_percentage == null
          ? null
          : Number(row.attendance_percentage);
      })(),
      classAverageAttendance:
        row.class_average_attendance == null ? null : Number(row.class_average_attendance),
      attendanceAlertLevel: row.attendance_alert_level,
      gpaCurrent: row.gpa_current == null ? null : Number(row.gpa_current),
      gpaPrevious: row.gpa_previous == null ? null : Number(row.gpa_previous),
      gpaChange: row.gpa_change == null ? null : Number(row.gpa_change),
      gpaAlertLevel: row.gpa_alert_level,
      latestInterventionStatus: row.latest_intervention_status,
      latestWellbeingStatus: row.latest_wellbeing_status,
      latestWellbeingCategory: row.latest_wellbeing_category,
      courseStudentCount: parseNumber(row.course_student_count),
      isActive: row.is_active === true,
    })),
    total,
    totalUniqueStudents,
    page,
    pageSize,
    totalPages,
  };
}
