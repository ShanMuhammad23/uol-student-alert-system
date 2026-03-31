import { pool } from "@/lib/db";

export type AlertDimensionFilter = "red" | "yellow" | "good";

export type ListingFilters = {
  department_ids?: string[];
  programs?: string[];
  instructor_ids?: string[];
  course_ids?: string[];
  attendanceFilters?: AlertDimensionFilter[];
  gpaFilters?: AlertDimensionFilter[];
  interventionFilters?: string[];
  search?: string;
};

export type ListingSortKey =
  | "name"
  | "department"
  | "program"
  | "course"
  | "teacher"
  | "classesHeld"
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
};

export type SessionScope = {
  role: "superadmin" | "dean" | "hod" | "instructor";
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
  totalClassesHeld: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  latestInterventionStatus: string | null;
  courseStudentCount: number;
};

export type StudentListingResult = {
  rows: StudentListingRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100000;

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
  ]);
  const mapped = (filters ?? [])
    .map((v) => String(v).trim().toLowerCase())
    .map((v) => (v === "in_progress" ? "in-progress" : v))
    .filter((v) => allowed.has(v === "in-progress" ? "in_progress" : v))
    .map((v) => (v === "in_progress" ? "in-progress" : v));
  return mapped.length ? mapped : undefined;
}

function buildAlertLevelClause(
  columnSql: string,
  filters: AlertDimensionFilter[] | undefined,
  params: unknown[]
): string | null {
  if (!filters?.length) return null;
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
    attendance: "attendance_percentage",
    gpa: "gpa_current",
    intervention: "latest_intervention_status",
  };
  const col = map[key] ?? map.name;
  return `${col} ${direction}, sap_id ASC, course_id ASC`;
}

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type BaseQueryParts = {
  whereSql: string;
  params: unknown[];
};

function buildWhere(scope: SessionScope, request: ListingRequest): BaseQueryParts {
  const params: unknown[] = [];
  const where: string[] = [];
  const filters = request.filters ?? {};

  if (scope.role === "dean" && scope.faculty_id) {
    params.push(scope.faculty_id);
    where.push(`e.faculty_id = $${params.length}`);
  } else if (scope.role === "hod" && scope.department_ids?.length) {
    params.push(scope.department_ids);
    where.push(`e.department_id = ANY($${params.length}::text[])`);
  } else if (scope.role === "instructor" && scope.pernr) {
    params.push(scope.pernr);
    where.push(`e.instructor_pernr = $${params.length}`);
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

  const attendanceClause = buildAlertLevelClause(
    "a.attendance_alert_level",
    filters.attendanceFilters,
    params
  );
  if (attendanceClause) where.push(attendanceClause);

  const gpaClause = buildAlertLevelClause("a.gpa_alert_level", filters.gpaFilters, params);
  if (gpaClause) where.push(gpaClause);

  const search = String(filters.search ?? "").trim();
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(e.student_name ILIKE $${i} OR e.sap_id ILIKE $${i})`);
  }

  const interventionFilters = normalizeInterventionFilters(filters.interventionFilters);
  if (interventionFilters?.length) {
    const wantsNotStarted = interventionFilters.includes("not_started");
    const statuses = interventionFilters.filter((s) => s !== "not_started");
    where.push(`a.attendance_alert_level IS NOT NULL`);
    if (wantsNotStarted && statuses.length) {
      params.push(statuses);
      where.push(
        `(latest.latest_intervention_status IS NULL OR latest.latest_intervention_status = ANY($${params.length}::text[]))`
      );
    } else if (wantsNotStarted) {
      where.push(`latest.latest_intervention_status IS NULL`);
    } else {
      params.push(statuses);
      where.push(`latest.latest_intervention_status = ANY($${params.length}::text[])`);
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
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

  const { whereSql, params } = buildWhere(scope, request);

  const baseCte = `
    WITH latest AS (
      SELECT DISTINCT ON (student_sap_id)
        student_sap_id,
        status AS latest_intervention_status
      FROM interventions
      ORDER BY student_sap_id, performed_at DESC
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
        COALESCE(NULLIF(TRIM(e.instructor_name), ''), e.instructor_pernr, '—') AS instructor_name,
        a.total_classes_held,
        a.classes_attended,
        a.attendance_percentage,
        a.class_average_attendance,
        a.attendance_alert_level,
        a.gpa_current,
        a.gpa_alert_level,
        latest.latest_intervention_status,
        CONCAT(e.course_id, ' ', COALESCE(c.title, '')) AS course_sort_text,
        COUNT(*) OVER (PARTITION BY e.course_id) AS course_student_count
      FROM student_enrollment_current e
      LEFT JOIN student_alert_current a
        ON a.sap_id = e.sap_id
       AND a.course_id = e.course_id
       AND a.section_code = e.section_code
       AND a.event_package_id = e.event_package_id
      LEFT JOIN latest ON latest.student_sap_id = e.sap_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN programs p ON p.id = e.program_id
      LEFT JOIN courses c ON c.id = e.course_id
      ${whereSql}
    )
  `;

  const countSql = `${baseCte} SELECT COUNT(*)::int AS total FROM base`;
  const countRes = await pool.query<{ total: number }>(countSql, params);
  const total = Number(countRes.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listParams = [...params, pageSize, offset];
  const limitParam = listParams.length - 1;
  const offsetParam = listParams.length;
  const listSql = `
    ${baseCte}
    SELECT
      sap_id,
      student_name,
      department_name,
      program_title,
      course_id,
      course_title,
      instructor_name,
      NULLIF(section_code, '') AS section_code,
      COALESCE(total_classes_held, 0) AS total_classes_held,
      COALESCE(classes_attended, 0) AS classes_attended,
      attendance_percentage,
      class_average_attendance,
      attendance_alert_level,
      gpa_current,
      gpa_alert_level,
      latest_intervention_status,
      course_student_count
    FROM base
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
    total_classes_held: number;
    classes_attended: number;
    attendance_percentage: number | null;
    class_average_attendance: number | null;
    attendance_alert_level: "warning" | "critical" | null;
    gpa_current: number | null;
    gpa_alert_level: "warning" | "critical" | null;
    latest_intervention_status: string | null;
    course_student_count: number;
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
      totalClassesHeld: parseNumber(row.total_classes_held),
      classesAttended: parseNumber(row.classes_attended),
      attendancePercentage:
        row.attendance_percentage == null ? null : Number(row.attendance_percentage),
      classAverageAttendance:
        row.class_average_attendance == null ? null : Number(row.class_average_attendance),
      attendanceAlertLevel: row.attendance_alert_level,
      gpaCurrent: row.gpa_current == null ? null : Number(row.gpa_current),
      gpaAlertLevel: row.gpa_alert_level,
      latestInterventionStatus: row.latest_intervention_status,
      courseStudentCount: parseNumber(row.course_student_count),
    })),
    total,
    page,
    pageSize,
    totalPages,
  };
}
