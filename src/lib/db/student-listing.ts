import { pool } from "@/lib/db";
import { getInterventionRecordStatsForRoleScope, getAlertedWithoutInterventionCountForRoleScope } from "@/data/intervention-store";
import {
  hasAssigneeStaffIdColumn,
  hasCaseTypeColumn,
  buildInterventionRecordScopeSql,
  interventionMatchesAlertedEnrollmentSql,
  type InterventionRoleScope,
} from "@/lib/db/interventions";
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
  /** Admission year values (batch). */
  batches?: string[];
  attendanceFilters?: AlertDimensionFilter[];
  classStatusFilters?: string[];
  gpaFilters?: AlertDimensionFilter[];
  interventionFilters?: string[];
  /** Wellbeing resolution keys (see `WELLBEING_RESOLUTION_OPTIONS`). */
  resolutionFilters?: string[];
  /** Dashboard overview segment (`selected_alert` URL param); aligns intervention totals with the chart when GPA/Attendance dropdowns are empty. */
  selected_alert?: string;
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
  role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller";
  staff_id?: string | null;
  faculty_id?: string | null;
  department_ids?: string[] | null;
  pernr?: string | null;
};

export type StudentListingRow = {
  sapId: string;
  studentName: string;
  admissionYear: string | null;
  admissionSession: string | null;
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
  /** Global latest intervention metadata (wellbeing caseload). */
  interventionCaseType: string | null;
  assigneeName: string | null;
  assigneePernr: string | null;
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

/** Match enrollment rows to intervention records (chart / interventions list semantics). */
function buildInterventionRecordStatusExistsSql(
  scope: SessionScope,
  filters: ListingFilters,
  statuses: string[],
  params: unknown[],
  hasSectionCode: boolean
): string | null {
  const roleScopeBase = buildInterventionRoleScopeBaseForListing(scope, filters);
  if (!roleScopeBase || !statuses.length) return null;

  const existsParts: string[] = [];

  params.push(statuses);
  existsParts.push(`i.status = ANY($${params.length}::text[])`);

  const courseMatchSql = interventionMatchesAlertedEnrollmentSql({
    hasSectionCode,
    interventionAlias: "i",
    enrollmentAlias: "e",
  });
  existsParts.unshift(courseMatchSql);

  const scopeSql = buildInterventionRecordScopeSql("i", roleScopeBase, params);
  if (!scopeSql) return null;
  existsParts.push(scopeSql);

  return `EXISTS (SELECT 1 FROM interventions i WHERE ${existsParts.join(" AND ")})`;
}

/** No intervention row for this enrollment's alerted course (chart "Not Started" semantics). */
function buildNoInterventionForAlertedCourseSql(
  scope: SessionScope,
  filters: ListingFilters,
  params: unknown[],
  hasSectionCode: boolean
): string | null {
  const roleScopeBase = buildInterventionRoleScopeBaseForListing(scope, filters);
  if (!roleScopeBase) return null;

  const courseMatchSql = interventionMatchesAlertedEnrollmentSql({
    hasSectionCode,
    interventionAlias: "i",
    enrollmentAlias: "e",
  });
  const scopeSql = buildInterventionRecordScopeSql("i", roleScopeBase, params);
  if (!scopeSql) return null;

  return `NOT EXISTS (
    SELECT 1
    FROM interventions i
    WHERE ${courseMatchSql}
      AND (${scopeSql})
  )`;
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
  skip?: Set<ListingWhereSkip>,
  wellbeingOpts?: {
    extendedDirectCases: boolean;
    hasInterventionSectionCode?: boolean;
  }
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
    // Referred, closed wellbeing_cases resolution, or direct internal/external cases (when schema supports case_type).
    const directCaseSql =
      wellbeingOpts?.extendedDirectCases === true
        ? `OR COALESCE(sig.global_case_type, 'referred') IN ('internal', 'external')`
        : "";
    where.push(`(
      latest.latest_intervention_status = 'referred'
      ${directCaseSql}
      OR EXISTS (
        SELECT 1 FROM wellbeing_cases wb_list
        WHERE wb_list.student_sap_id = e.sap_id
          AND wb_list.wellbeing_status = 'closed'
      )
    )`);
  } else if (scope.role === "wellbeing-counseller") {
    const staffId = String(scope.staff_id ?? "").trim();
    if (!staffId) {
      where.push("1=0");
    } else {
      params.push(staffId);
      const sid = params.length;
      where.push(`(
        (latest.latest_intervention_status = 'referred' AND COALESCE(sig.global_assignee_staff_id, '') = $${sid}::text)
        OR EXISTS (
          SELECT 1
          FROM wellbeing_direct_cases wdc
          JOIN interventions i_dir ON i_dir.id = wdc.intervention_id
          WHERE wdc.student_sap_id = e.sap_id
            AND i_dir.staff_id = $${sid}::uuid
        )
        OR (
          COALESCE(sig.global_intervention_status, '') = 'resolved'
          AND COALESCE(sig.global_performer_staff_id, '') = $${sid}::text
        )
        OR EXISTS (
          SELECT 1
          FROM wellbeing_cases wb_c
          WHERE wb_c.student_sap_id = e.sap_id
            AND wb_c.wellbeing_status = 'closed'
            AND wb_c.staff_id = $${sid}::uuid
        )
      )`);
    }
  } else if (scope.role === "wellbeing-head") {
    // Head view remains broader wellbeing scope.
    const directCaseSql =
      wellbeingOpts?.extendedDirectCases === true
        ? `OR COALESCE(sig.global_case_type, 'referred') IN ('internal', 'external')`
        : "";
    where.push(`(
      latest.latest_intervention_status = 'referred'
      ${directCaseSql}
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
  const batches = toArray(filters.batches);
  if (batches?.length) {
    params.push(batches);
    where.push(`NULLIF(TRIM(e.admission_year), '') = ANY($${params.length}::text[])`);
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

  if (
    !skip?.has("intervention") &&
    scope.role !== "wellbeing" &&
    scope.role !== "wellbeing-counseller" &&
    scope.role !== "wellbeing-head"
  ) {
    const interventionFilters = normalizeInterventionFilters(filters.interventionFilters);
    if (interventionFilters?.length) {
      const wantsNotStarted = interventionFilters.includes("not_started");
      const statuses = interventionFilters.filter((s) => s !== "not_started");
      const recordExistsSql =
        statuses.length > 0
          ? buildInterventionRecordStatusExistsSql(
              scope,
              filters,
              statuses,
              params,
              wellbeingOpts?.hasInterventionSectionCode === true
            )
          : null;
      const noInterventionSql = wantsNotStarted
        ? buildNoInterventionForAlertedCourseSql(
            scope,
            filters,
            params,
            wellbeingOpts?.hasInterventionSectionCode === true
          )
        : null;
      if (wantsNotStarted && statuses.length) {
        const notStartedSql = noInterventionSql
          ? `(${INTERVENTION_ELIGIBLE_SQL} AND ${noInterventionSql})`
          : null;
        where.push(
          recordExistsSql && notStartedSql
            ? `(${notStartedSql} OR ${recordExistsSql})`
            : notStartedSql ?? recordExistsSql ?? "1=0"
        );
      } else if (wantsNotStarted) {
        if (noInterventionSql) {
          where.push(`(${INTERVENTION_ELIGIBLE_SQL} AND ${noInterventionSql})`);
        }
      } else if (recordExistsSql) {
        where.push(recordExistsSql);
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

type GlobalInterventionColumns = {
  hasCaseType: boolean;
  hasAssignee: boolean;
};

async function resolveWellbeingListingOptions(scope: SessionScope): Promise<{
  globalIntervention: GlobalInterventionColumns | null;
  extendedDirectCases: boolean;
}> {
  if (
    scope.role !== "wellbeing" &&
    scope.role !== "wellbeing-counseller" &&
    scope.role !== "wellbeing-head"
  ) {
    return { globalIntervention: null, extendedDirectCases: false };
  }
  const hasC = await hasCaseTypeColumn();
  const hasA = await hasAssigneeStaffIdColumn();
  return {
    globalIntervention: { hasCaseType: hasC, hasAssignee: hasA },
    extendedDirectCases: hasC,
  };
}

function buildStudentInterventionGlobalCteSql(cols: GlobalInterventionColumns): string {
  const caseExpr = cols.hasCaseType
    ? "COALESCE(i.case_type, 'referred')"
    : "'referred'::varchar";
  const assigneeJoin = cols.hasAssignee
    ? "LEFT JOIN staff sa ON sa.id = i.assignee_staff_id"
    : "";
  const assigneeNameExpr = cols.hasAssignee ? "sa.name" : "NULL::varchar";
  const assigneePernrExpr = cols.hasAssignee ? "sa.pernr" : "NULL::varchar";
  const assigneeIdExpr = cols.hasAssignee ? "i.assignee_staff_id::text" : "NULL::text";
  return `
    student_intervention_global AS (
      SELECT DISTINCT ON (i.student_sap_id)
        i.student_sap_id,
        i.status AS global_intervention_status,
        i.staff_id::text AS global_performer_staff_id,
        ${assigneeIdExpr} AS global_assignee_staff_id,
        ${caseExpr} AS global_case_type,
        ${assigneeNameExpr} AS global_assignee_name,
        ${assigneePernrExpr} AS global_assignee_pernr
      FROM interventions i
      ${assigneeJoin}
      ORDER BY i.student_sap_id, i.performed_at DESC
    ),
  `;
}

function buildListingBaseCte(
  whereSql: string,
  interventionContext: InterventionContextColumns,
  globalIntervention?: GlobalInterventionColumns | null
): string {
  const globalPrefix =
    globalIntervention != null
      ? buildStudentInterventionGlobalCteSql(globalIntervention)
      : "";
  const globalSelect =
    globalIntervention != null
      ? `sig.global_case_type,
        sig.global_intervention_status,
        sig.global_performer_staff_id,
        sig.global_assignee_staff_id,
        sig.global_assignee_name,
        sig.global_assignee_pernr,`
      : `NULL::varchar AS global_case_type,
        NULL::varchar AS global_intervention_status,
        NULL::varchar AS global_performer_staff_id,
        NULL::varchar AS global_assignee_staff_id,
        NULL::varchar AS global_assignee_name,
        NULL::varchar AS global_assignee_pernr,`;
  const globalJoin =
    globalIntervention != null
      ? `LEFT JOIN student_intervention_global sig ON sig.student_sap_id = e.sap_id`
      : "";
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
  /**
   * One latest intervention per student+course+section (package omitted from DISTINCT ON)
   * so enrollments like 51755797__3 still join interventions stored as 51755797 or 51755797__lect.
   */
  const collapseLatestBySectionPackage =
    interventionContext.hasSectionCode && interventionContext.hasEventPackageId;
  const latestDistinctOnSql = collapseLatestBySectionPackage
    ? `student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder}`
    : `student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder},
        ${latestPackageOrder}`;
  const latestOrderBySql = collapseLatestBySectionPackage
    ? `student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder},
        performed_at DESC`
    : `student_sap_id,
        COALESCE(course_id, ''),
        ${latestSectionOrder},
        ${latestPackageOrder},
        performed_at DESC`;
  const latestContextJoin =
    interventionContext.hasSectionCode && interventionContext.hasEventPackageId
      ? `latest.course_id = e.course_id
           AND COALESCE(latest.section_code, '') = COALESCE(e.section_code, '')`
      : `latest.course_id = e.course_id`;
  return `
    WITH ${globalPrefix}
    latest AS (
      SELECT DISTINCT ON (
        ${latestDistinctOnSql}
      )
        student_sap_id,
        COALESCE(course_id, '') AS course_id,
        ${latestSectionSelect},
        ${latestPackageSelect},
        status AS latest_intervention_status
      FROM interventions
      ORDER BY
        ${latestOrderBySql}
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
        NULLIF(TRIM(e.admission_year), '') AS admission_year,
        NULLIF(TRIM(e.admission_session), '') AS admission_session,
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
        ${globalSelect}
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
      ${globalJoin}
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

type ListingAlertSlice =
  | "attendance_red"
  | "attendance_yellow"
  | "gpa_red"
  | "gpa_yellow";

function listingEffectiveAlertSlice(
  filters: ListingFilters
): ListingAlertSlice | null {
  const af = filters.attendanceFilters;
  const gf = filters.gpaFilters;
  if (af?.length && !af.includes("all")) {
    if (af.includes("red")) return "attendance_red";
    if (af.includes("yellow")) return "attendance_yellow";
  }
  if (gf?.length && !gf.includes("all")) {
    if (gf.includes("red")) return "gpa_red";
    if (gf.includes("yellow")) return "gpa_yellow";
  }
  return null;
}

/** Mirrors `InterventionStatusChartClient` chartMode (dimension filters first, then overview tab). */
function listingInterventionChartMode(
  filters: ListingFilters
): "gpa" | "attendance" | "all" {
  const gf = filters.gpaFilters;
  const af = filters.attendanceFilters;
  if (gf?.length && !gf.includes("all")) return "gpa";
  if (af?.length && !af.includes("all")) return "attendance";
  const sa = String(filters.selected_alert ?? "").toLowerCase();
  if (sa === "gpa") return "gpa";
  if (sa === "attendance") return "attendance";
  return "all";
}

export type OverviewAlertTotals = {
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

export type InterventionChartCounts = {
  totalAlerts: number;
  notStarted: number;
  initiated: number;
  inProgress: number;
  referred: number;
  resolved: number;
  noActionRequired: number;
};

/** Sum of overview KPI alert counts; matches `totalAlertsFromInterventionCombo` / dashboard cards. */
export function totalAlertsFromOverviewTotals(
  totals: OverviewAlertTotals,
  filters: ListingFilters
): number {
  const slice = listingEffectiveAlertSlice(filters);
  const chartMode = listingInterventionChartMode(filters);
  if (slice === "attendance_red") return totals.redAttendance;
  if (slice === "attendance_yellow") return totals.yellowAttendance;
  if (slice === "gpa_red") return totals.redGpa;
  if (slice === "gpa_yellow") return totals.yellowGpa;
  if (chartMode === "gpa") return totals.redGpa + totals.yellowGpa;
  if (chartMode === "attendance") {
    return totals.redAttendance + totals.yellowAttendance;
  }
  return (
    totals.redGpa +
    totals.yellowGpa +
    totals.redAttendance +
    totals.yellowAttendance
  );
}

/**
 * Intervention chart buckets: every intervention row by status (matches interventions list).
 * Also used for master-filter dropdown counts.
 */
export async function getInterventionChartCountsForScope(
  scope: SessionScope,
  filters: ListingFilters,
  overviewTotals: OverviewAlertTotals
): Promise<InterventionChartCounts | null> {
  const roleScopeBase = buildInterventionRoleScopeBaseForListing(scope, filters);
  if (!roleScopeBase) return null;

  const slice = listingEffectiveAlertSlice(filters);
  const chartMode = listingInterventionChartMode(filters);
  const totalAlerts = totalAlertsFromOverviewTotals(overviewTotals, filters);
  const { interventionTypes, alertLevel } = listingInterventionApiParams(
    slice,
    chartMode
  );

  const summed = {
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
    totalRecords: 0,
  };

  for (const interventionType of interventionTypes) {
    const stats = await getInterventionRecordStatsForRoleScope({
      ...roleScopeBase,
      interventionType,
      alertLevel: alertLevel ?? null,
    });
    summed.initiated += stats.initiated;
    summed.inProgress += stats.inProgress;
    summed.referred += stats.referred;
    summed.resolved += stats.resolved;
    summed.noActionRequired += stats.noActionRequired;
    summed.totalRecords += stats.totalInterventionStudents;
  }

  const notStarted = await getAlertedWithoutInterventionCountForRoleScope({
    ...roleScopeBase,
    interventionType: interventionTypes[0] ?? "all",
    alertLevel: alertLevel ?? null,
  });

  return {
    totalAlerts,
    notStarted,
    initiated: summed.initiated,
    inProgress: summed.inProgress,
    referred: summed.referred,
    resolved: summed.resolved,
    noActionRequired: summed.noActionRequired,
  };
}

function listingInterventionApiParams(
  slice: ListingAlertSlice | null,
  chartMode: "gpa" | "attendance" | "all"
): {
  interventionTypes: ("attendance" | "gpa" | "all")[];
  alertLevel: "warning" | "critical" | null;
} {
  if (slice === "attendance_red") {
    return { interventionTypes: ["attendance"], alertLevel: "critical" };
  }
  if (slice === "attendance_yellow") {
    return { interventionTypes: ["attendance"], alertLevel: "warning" };
  }
  if (slice === "gpa_red") {
    return { interventionTypes: ["gpa"], alertLevel: "critical" };
  }
  if (slice === "gpa_yellow") {
    return { interventionTypes: ["gpa"], alertLevel: "warning" };
  }
  if (chartMode === "gpa") {
    return { interventionTypes: ["gpa"], alertLevel: null };
  }
  if (chartMode === "attendance") {
    return { interventionTypes: ["attendance"], alertLevel: null };
  }
  return { interventionTypes: ["all"], alertLevel: null };
}

function buildInterventionRoleScopeBaseForListing(
  scope: SessionScope,
  filters: ListingFilters
): Omit<InterventionRoleScope, "interventionType" | "alertLevel"> | null {
  const deptFromMaster = filters.department_ids?.filter(Boolean);
  const courseMaster = filters.course_ids?.filter(Boolean);
  const instructorMaster = filters.instructor_ids?.filter(Boolean);

  const mergedDept =
    deptFromMaster?.length
      ? deptFromMaster
      : scope.role === "hod"
        ? scope.department_ids?.filter(Boolean) ?? []
        : null;

  if (scope.role === "superadmin") {
    return {
      role: "superadmin",
      facultyId: null,
      departmentIds: mergedDept?.length ? mergedDept : null,
      courseIds: courseMaster?.length ? courseMaster : null,
      instructorIds: instructorMaster?.length ? instructorMaster : null,
      staffId: null,
    };
  }
  if (scope.role === "dean") {
    const fid = String(scope.faculty_id ?? "").trim();
    if (!fid) return null;
    return {
      role: "dean",
      facultyId: fid,
      departmentIds: mergedDept?.length ? mergedDept : null,
      courseIds: courseMaster?.length ? courseMaster : null,
      instructorIds: instructorMaster?.length ? instructorMaster : null,
      staffId: null,
    };
  }
  if (scope.role === "hod") {
    if (!mergedDept?.length) return null;
    return {
      role: "hod",
      facultyId: null,
      departmentIds: mergedDept,
      courseIds: courseMaster?.length ? courseMaster : null,
      instructorIds: instructorMaster?.length ? instructorMaster : null,
      staffId: null,
    };
  }
  if (scope.role === "instructor") {
    const sid = String(scope.staff_id ?? "").trim();
    if (!sid) return null;
    return {
      role: "teacher",
      facultyId: null,
      departmentIds: mergedDept?.length ? mergedDept : null,
      courseIds: courseMaster?.length ? courseMaster : null,
      instructorIds: instructorMaster?.length ? instructorMaster : null,
      staffId: sid,
    };
  }
  return null;
}

/** Row counts per master-filter dropdown option; each group excludes its own filter so options reflect the rest of the filter stack. */
export async function getFilterDropdownCounts(
  scope: SessionScope,
  filters: ListingFilters
): Promise<FilterDropdownCounts | null> {
  if (!pool) return null;
  const interventionContext = await getInterventionContextColumns();

  const zeroWellbeing = WELLBEING_RESOLUTION_OPTIONS.map(() => 0);

  try {
    const wbOpts = await resolveWellbeingListingOptions(scope);
    const gpaParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["gpa"]), {
      extendedDirectCases: wbOpts.extendedDirectCases,
    });
    const gpaSql = `${buildListingBaseCte(gpaParts.whereSql, interventionContext, wbOpts.globalIntervention)}
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
        COUNT(*) FILTER (WHERE has_yellow)::int AS yellow,
        COUNT(*) FILTER (WHERE NOT has_red AND NOT has_yellow)::int AS good
      FROM gpa_per_student`;
    const gpaRes = await pool.query<{
      total_all: number;
      red: number;
      yellow: number;
      good: number;
    }>(gpaSql, gpaParts.params);
    const gRow = gpaRes.rows[0];

    const attParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["attendance"]), {
      extendedDirectCases: wbOpts.extendedDirectCases,
    });
    const attSql = `${buildListingBaseCte(attParts.whereSql, interventionContext, wbOpts.globalIntervention)}
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
        COUNT(*) FILTER (WHERE has_yellow)::int AS yellow,
        COUNT(*) FILTER (WHERE NOT has_red AND NOT has_yellow)::int AS good
      FROM att_per_student`;
    const attRes = await pool.query<{
      total_all: number;
      red: number;
      yellow: number;
      good: number;
    }>(attSql, attParts.params);
    const aRow = attRes.rows[0];

    const chartCounts = await getInterventionChartCountsForScope(scope, filters, {
      yellowGpa: 0,
      redGpa: 0,
      yellowAttendance: 0,
      redAttendance: 0,
    });
    const interventionCounts = chartCounts
      ? {
          int_all:
            chartCounts.notStarted +
            chartCounts.initiated +
            chartCounts.inProgress +
            chartCounts.referred +
            chartCounts.resolved +
            chartCounts.noActionRequired,
          not_started: chartCounts.notStarted,
          initiated: chartCounts.initiated,
          in_progress: chartCounts.inProgress,
          referred: chartCounts.referred,
          resolved: chartCounts.resolved,
          no_action_required: chartCounts.noActionRequired,
        }
      : {
          int_all: 0,
          not_started: 0,
          initiated: 0,
          in_progress: 0,
          referred: 0,
          resolved: 0,
          no_action_required: 0,
        };

    let wellbeingAll = 0;
    let wellbeing = zeroWellbeing;
    try {
      const wbParts = buildWhere(scope, filters, new Set<ListingWhereSkip>(["resolution"]), {
        extendedDirectCases: wbOpts.extendedDirectCases,
      });
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
      const wbSql = `${buildListingBaseCte(wbParts.whereSql, interventionContext, wbOpts.globalIntervention)}
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
        all: Number(interventionCounts.int_all ?? 0),
        not_started: Number(interventionCounts.not_started ?? 0),
        initiated: Number(interventionCounts.initiated ?? 0),
        in_progress: Number(interventionCounts.in_progress ?? 0),
        referred: Number(interventionCounts.referred ?? 0),
        resolved: Number(interventionCounts.resolved ?? 0),
        no_action_required: Number(interventionCounts.no_action_required ?? 0),
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
  const wbOpts = await resolveWellbeingListingOptions(scope);
  const { whereSql, params } = buildWhere(scope, filters, undefined, {
    extendedDirectCases: wbOpts.extendedDirectCases,
    hasInterventionSectionCode: interventionContext.hasSectionCode,
  });
  const sql = `
    ${buildListingBaseCte(whereSql, interventionContext, wbOpts.globalIntervention)}
    SELECT DISTINCT sap_id FROM base
  `;
  const res = await pool.query<{ sap_id: string }>(sql, params);
  return res.rows.map((r) => r.sap_id);
}

/** Distinct SAP IDs for students with any GPA or attendance alert (same scope/filters as the listing). */
export async function getDistinctAlertSapIdsForScope(
  scope: SessionScope,
  filters: ListingFilters
): Promise<string[]> {
  if (!pool) return [];
  const interventionContext = await getInterventionContextColumns();
  const wbOpts = await resolveWellbeingListingOptions(scope);
  const { whereSql, params } = buildWhere(scope, filters, undefined, {
    extendedDirectCases: wbOpts.extendedDirectCases,
    hasInterventionSectionCode: interventionContext.hasSectionCode,
  });
  const alertWhereSql = whereSql
    ? `${whereSql} AND ${INTERVENTION_ELIGIBLE_SQL}`
    : `WHERE e.is_active = TRUE AND ${INTERVENTION_ELIGIBLE_SQL}`;
  const sql = `
    ${buildListingBaseCte(alertWhereSql, interventionContext, wbOpts.globalIntervention)}
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

  const wbOpts = await resolveWellbeingListingOptions(scope);
  const interventionContext = await getInterventionContextColumns();
  const { whereSql, params } = buildWhere(scope, request.filters ?? {}, undefined, {
    extendedDirectCases: wbOpts.extendedDirectCases,
    hasInterventionSectionCode: interventionContext.hasSectionCode,
  });
  const baseCte = buildListingBaseCte(whereSql, interventionContext, wbOpts.globalIntervention);

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
      admission_year,
      admission_session,
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
      global_case_type,
      global_assignee_name,
      global_assignee_pernr,
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
    admission_year: string | null;
    admission_session: string | null;
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
    global_case_type: string | null;
    global_assignee_name: string | null;
    global_assignee_pernr: string | null;
    course_student_count: number;
    is_active: boolean | null;
  }>(listSql, listParams);

  return {
    rows: listRes.rows.map((row) => ({
      sapId: row.sap_id,
      studentName: row.student_name,
      admissionYear: row.admission_year,
      admissionSession: row.admission_session,
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
      interventionCaseType: row.global_case_type,
      assigneeName: row.global_assignee_name,
      assigneePernr: row.global_assignee_pernr,
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
