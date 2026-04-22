import { pool } from "@/lib/db";
import { hasCaseTypeColumn } from "@/lib/db/interventions";

type CaseType = "referred" | "internal" | "external";
type CaseStatus = "open" | "closed";

type CaseRow = {
  student_sap_id: string;
  category: string | null;
  wellbeing_status: string | null;
  counsellor_name: string | null;
};

type LatestInterventionRow = {
  student_sap_id: string;
  status: string | null;
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
  return "referred";
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
    const caseType = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? "referred";

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

function applyTotalsFromInterventions(
  metrics: SectionMetrics,
  rows: LatestInterventionRow[]
): SectionMetrics {
  const next: SectionMetrics = {
    ...metrics,
    totals: {
      totalCases: 0,
      referred: 0,
      resolved: 0,
      openCases: 0,
    },
  };

  for (const row of rows) {
    const caseType = normalizeCaseType(row.case_type);
    const statusRaw = String(row.status ?? "").trim().toLowerCase();
    const isResolved = statusRaw === "resolved";

    next.totals.totalCases += 1;
    if (caseType === "referred") next.totals.referred += 1;
    if (isResolved) next.totals.resolved += 1;
    else next.totals.openCases += 1;
  }

  return next;
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
  const caseTypeExpr = hasCaseType ? "COALESCE(i.case_type, 'referred')" : "'referred'::varchar";

  const [rowsResult, caseTypeResult, latestInterventionsResult] = await Promise.all([
    pool.query<CaseRow>(
      `
      SELECT
        wb.student_sap_id,
        wb.category,
        wb.wellbeing_status,
        s.name AS counsellor_name
      FROM wellbeing_cases wb
      LEFT JOIN staff s ON s.id = wb.staff_id
      `
    ),
    pool.query<{ student_sap_id: string; case_type: string }>(
      `
      SELECT DISTINCT ON (i.student_sap_id)
        i.student_sap_id,
        ${caseTypeExpr} AS case_type
      FROM interventions i
      ORDER BY i.student_sap_id, i.performed_at DESC, i.id DESC
      `
    ),
    pool.query<LatestInterventionRow>(
      `
      SELECT DISTINCT ON (i.student_sap_id)
        i.student_sap_id,
        i.status,
        ${caseTypeExpr} AS case_type
      FROM interventions i
      ORDER BY i.student_sap_id, i.performed_at DESC, i.id DESC
      `
    ),
  ]);

  const studentCaseTypeMap = new Map<string, CaseType>();
  for (const row of caseTypeResult.rows) {
    studentCaseTypeMap.set(
      String(row.student_sap_id ?? "").trim(),
      normalizeCaseType(row.case_type)
    );
  }

  const allRows = rowsResult.rows;
  const referredRows = allRows.filter((row) => {
    const type = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? "referred";
    return type === "referred";
  });
  const directRows = allRows.filter((row) => {
    const type = studentCaseTypeMap.get(String(row.student_sap_id ?? "").trim()) ?? "referred";
    return type === "internal" || type === "external";
  });

  const allMetrics = buildSection(allRows, studentCaseTypeMap);
  const referredMetrics = buildSection(referredRows, studentCaseTypeMap);
  const directMetrics = buildSection(directRows, studentCaseTypeMap);

  const latestRows = latestInterventionsResult.rows;
  const latestReferred = latestRows.filter(
    (row) => normalizeCaseType(row.case_type) === "referred"
  );
  const latestDirect = latestRows.filter((row) => {
    const type = normalizeCaseType(row.case_type);
    return type === "internal" || type === "external";
  });

  return {
    totalRecords: applyTotalsFromInterventions(allMetrics, latestRows),
    referredCases: applyTotalsFromInterventions(referredMetrics, latestReferred),
    directCases: applyTotalsFromInterventions(directMetrics, latestDirect),
  };
}
