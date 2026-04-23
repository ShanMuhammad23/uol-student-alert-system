import { pool } from "@/lib/db";
import { hasAssigneeStaffIdColumn, hasCaseTypeColumn } from "@/lib/db/interventions";

type CaseType = "referred" | "internal" | "external" | null;
type CaseStatus = "open" | "closed";

type CaseRow = {
  student_sap_id: string;
  category: string | null;
  wellbeing_status: string | null;
  counsellor_name: string | null;
  case_type: string | null;
};

type SectionMetrics = {
  totals: {
    totalCases: number;
    referred: number;
    resolved: number;
    openCases: number;
  };
  categoryChart: {
    categories: string[];
    open: number[];
    closed: number[];
  };
  counsellorChart: {
    counsellors: string[];
    open: number[];
    closed: number[];
  };
};

export type WellbeingHeadDashboardData = {
  totalRecords: SectionMetrics;
  referredCases: SectionMetrics;
  directCases: SectionMetrics;
};

const KNOWN_CATEGORY_ORDER = [
  "Counselling",
  "Monitoring",
  "Flex (Academic)",
  "Flex (Financial)",
  "Others",
] as const;

function normalizeCategory(input: string | null | undefined): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "Others";
  if (raw === "counselling") return "Counselling";
  if (raw === "monitoring") return "Monitoring";
  if (
    raw === "flex (academic)" ||
    raw === "flex (acad)" ||
    raw === "flex-academic" ||
    raw === "flex academic"
  ) {
    return "Flex (Academic)";
  }
  if (
    raw === "flex (financial)" ||
    raw === "flex (fin)" ||
    raw === "flex-financial" ||
    raw === "flex financial"
  ) {
    return "Flex (Financial)";
  }
  return "Others";
}

function normalizeStatus(input: string | null | undefined): CaseStatus {
  return String(input ?? "").trim().toLowerCase() === "closed" ? "closed" : "open";
}

function normalizeCaseType(input: string | null | undefined): CaseType {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "internal" || raw === "external") return raw;
  if (raw === "referred") return "referred";
  return null;
}

function createEmptyMetrics(): SectionMetrics {
  return {
    totals: { totalCases: 0, referred: 0, resolved: 0, openCases: 0 },
    categoryChart: { categories: [], open: [], closed: [] },
    counsellorChart: { counsellors: [], open: [], closed: [] },
  };
}

function buildSection(rows: CaseRow[], studentCaseTypeMap: Map<string, CaseType>): SectionMetrics {
  const out = createEmptyMetrics();
  const categoryOpen = new Map<string, number>();
  const categoryClosed = new Map<string, number>();
  const counsellorOpen = new Map<string, number>();
  const counsellorClosed = new Map<string, number>();

  for (const row of rows) {
    const status = normalizeStatus(row.wellbeing_status);
    const category = normalizeCategory(row.category);
    const counsellor = String(row.counsellor_name ?? "").trim() || "Unassigned";
    const caseType = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? null;

    out.totals.totalCases += 1;
    if (status === "closed") out.totals.resolved += 1;
    else out.totals.openCases += 1;
    if (caseType === "referred") out.totals.referred += 1;

    if (status === "closed") {
      categoryClosed.set(category, (categoryClosed.get(category) ?? 0) + 1);
      counsellorClosed.set(counsellor, (counsellorClosed.get(counsellor) ?? 0) + 1);
    } else {
      categoryOpen.set(category, (categoryOpen.get(category) ?? 0) + 1);
      counsellorOpen.set(counsellor, (counsellorOpen.get(counsellor) ?? 0) + 1);
    }
  }

  const categorySet = new Set<string>();
  for (const key of categoryOpen.keys()) categorySet.add(key);
  for (const key of categoryClosed.keys()) categorySet.add(key);
  const categoryOrdered = [
    ...KNOWN_CATEGORY_ORDER.filter((name) => categorySet.has(name)),
    ...[...categorySet].filter((name) => !KNOWN_CATEGORY_ORDER.includes(name as never)).sort(),
  ];
  out.categoryChart.categories = categoryOrdered;
  out.categoryChart.open = categoryOrdered.map((key) => categoryOpen.get(key) ?? 0);
  out.categoryChart.closed = categoryOrdered.map((key) => categoryClosed.get(key) ?? 0);

  const counsellorSet = new Set<string>();
  for (const key of counsellorOpen.keys()) counsellorSet.add(key);
  for (const key of counsellorClosed.keys()) counsellorSet.add(key);
  const counsellorOrdered = [...counsellorSet].sort((a, b) => a.localeCompare(b));
  out.counsellorChart.counsellors = counsellorOrdered;
  out.counsellorChart.open = counsellorOrdered.map((key) => counsellorOpen.get(key) ?? 0);
  out.counsellorChart.closed = counsellorOrdered.map((key) => counsellorClosed.get(key) ?? 0);

  return out;
}

export async function getWellbeingHeadDashboardData(): Promise<WellbeingHeadDashboardData> {
  if (!pool) {
    return {
      totalRecords: createEmptyMetrics(),
      referredCases: createEmptyMetrics(),
      directCases: createEmptyMetrics(),
    };
  }

  const hasCaseType = await hasCaseTypeColumn();
  const caseTypeExpr = hasCaseType
    ? "i.case_type"
    : "CASE WHEN LOWER(COALESCE(i.status, '')) = 'referred' THEN 'referred' ELSE NULL END::varchar";
  const hasAssignee = await hasAssigneeStaffIdColumn();
  const assigneeJoin = hasAssignee ? "LEFT JOIN staff s ON s.id = i.assignee_staff_id" : "";
  const assigneeNameExpr = hasAssignee ? "s.name" : "NULL::varchar";

  const rowsResult = await pool.query<CaseRow>(
    `
    SELECT DISTINCT ON (i.student_sap_id)
      i.student_sap_id,
      wb_latest.category,
      CASE
        WHEN LOWER(COALESCE(i.status, '')) = 'resolved' THEN 'closed'
        ELSE 'open'
      END AS wellbeing_status,
      ${assigneeNameExpr} AS counsellor_name,
      ${caseTypeExpr} AS case_type
    FROM interventions i
    LEFT JOIN LATERAL (
      SELECT wb.category
      FROM wellbeing_cases wb
      WHERE wb.student_sap_id = i.student_sap_id
      ORDER BY wb.updated_at DESC, wb.opened_at DESC, wb.id DESC
      LIMIT 1
    ) wb_latest ON TRUE
    ${assigneeJoin}
    ORDER BY i.student_sap_id, i.performed_at DESC, i.id DESC
    `
  );

  const studentCaseTypeMap = new Map<string, CaseType>();
  for (const row of rowsResult.rows) {
    studentCaseTypeMap.set(
      String(row.student_sap_id ?? "").trim(),
      normalizeCaseType(row.case_type)
    );
  }

  const allRows = rowsResult.rows;
  const visibleRows = allRows.filter((row) => {
    const type = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? null;
    return type === "referred" || type === "external";
  });
  const referredRows = visibleRows.filter((row) => {
    const type = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? null;
    return type === "referred";
  });
  const directRows = visibleRows.filter((row) => {
    const type = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? null;
    return type === "external";
  });

  return {
    totalRecords: buildSection(visibleRows, studentCaseTypeMap),
    referredCases: buildSection(referredRows, studentCaseTypeMap),
    directCases: buildSection(directRows, studentCaseTypeMap),
  };
}
