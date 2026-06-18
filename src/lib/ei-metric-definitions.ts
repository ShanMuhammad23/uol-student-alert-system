/** EI criterion definitions from Student Early Alert — EI Criteria.xlsx */

export type EiCriterionCode =
  | "A_login"
  | "B_attendance"
  | "C1_ttfa"
  | "C2_coverage"
  | "C3_case_progression"
  | "C4_resolution"
  | "D1_uptake"
  | "D2_wb_progression"
  | "D3_wb_resolution";

export type EiCriterionDefinition = {
  code: EiCriterionCode;
  category: "A" | "B" | "C" | "D";
  label: string;
  weight: number;
  piTarget: string;
  formula: string;
  tooltip: string;
  higherBetter: boolean;
  sortOrder: number;
};

export const EI_CRITERION_DEFINITIONS: EiCriterionDefinition[] = [
  {
    code: "A_login",
    category: "A",
    label: "Log-in rate",
    weight: 0.15,
    piTarget: "At least once per week",
    formula: "Users meeting PI ÷ Total users",
    tooltip:
      "Share of users in scope who logged in at least once in the past 7 days. Weight: 15%.",
    higherBetter: true,
    sortOrder: 1,
  },
  {
    code: "B_attendance",
    category: "B",
    label: "Attendance posting",
    weight: 0.25,
    piTarget: "90% on time",
    formula: "Posted attendance ÷ Total held classes",
    tooltip:
      "Share of held classes with attendance posted in the system. Target: 90% on time. Weight: 25%.",
    higherBetter: true,
    sortOrder: 2,
  },
  {
    code: "C1_ttfa",
    category: "C",
    label: "Time to first intervention",
    weight: 0.1,
    piTarget: "≤ 2 days",
    formula: "Median days from first alert to first instructor action",
    tooltip:
      "Median days from first alert to first instructor action. Target: ≤ 2 days. Score reduces 20% for each day over target. Weight: 10%.",
    higherBetter: false,
    sortOrder: 3,
  },
  {
    code: "C2_coverage",
    category: "C",
    label: "Intervention coverage",
    weight: 0.1,
    piTarget: "95% of alerts",
    formula: "(Alerts with intervention ÷ Total alerts) × (100 ÷ 95)",
    tooltip:
      "Alerts with at least one intervention started. Target: 95%. Normalized against the 95% PI. Weight: 10%.",
    higherBetter: true,
    sortOrder: 4,
  },
  {
    code: "C3_case_progression",
    category: "C",
    label: "Case progression",
    weight: 0.1,
    piTarget: "No gap > 10 days between actions",
    formula: "Open cases with all action gaps ≤ 10 days ÷ Open cases",
    tooltip:
      "Open intervention cases where no gap between consecutive actions exceeds 10 days. Weight: 10%.",
    higherBetter: true,
    sortOrder: 5,
  },
  {
    code: "C4_resolution",
    category: "C",
    label: "Resolution or referral",
    weight: 0.05,
    piTarget: "Timely closure or referral to Wellbeing",
    formula: "Cases closed or referred to WB ÷ Total cases",
    tooltip:
      "Intervention cases closed or referred to Wellbeing. Weight: 5%.",
    higherBetter: true,
    sortOrder: 6,
  },
  {
    code: "D1_uptake",
    category: "D",
    label: "Wellbeing uptake",
    weight: 0.1,
    piTarget: "≤ 2 days",
    formula: "Median days from referral to first counsellor action",
    tooltip:
      "Median days from Wellbeing referral to first counsellor action. Target: ≤ 2 days. Score reduces 20% per day over target. Weight: 10%.",
    higherBetter: false,
    sortOrder: 7,
  },
  {
    code: "D2_wb_progression",
    category: "D",
    label: "Wellbeing case progression",
    weight: 0.1,
    piTarget: "No gap > 10 days between actions",
    formula: "Referred open cases with all action gaps ≤ 10 days ÷ Open referred cases",
    tooltip:
      "Referred cases still open where no gap between consecutive wellbeing actions exceeds 10 days. Weight: 10%.",
    higherBetter: true,
    sortOrder: 8,
  },
  {
    code: "D3_wb_resolution",
    category: "D",
    label: "Wellbeing resolution",
    weight: 0.05,
    piTarget: "Timely closing of referred cases",
    formula: "Referred cases closed ÷ Total referred cases",
    tooltip: "Referred cases closed by Wellbeing. Weight: 5%.",
    higherBetter: true,
    sortOrder: 9,
  },
];

export const EI_CRITERION_BY_CODE = Object.fromEntries(
  EI_CRITERION_DEFINITIONS.map((d) => [d.code, d])
) as Record<EiCriterionCode, EiCriterionDefinition>;

export const EI_GRADE_LABELS: Record<"A" | "B" | "C" | "D", string> = {
  A: "Excellent",
  B: "Satisfactory",
  C: "Needs Improvement",
  D: "Unsatisfactory",
};
