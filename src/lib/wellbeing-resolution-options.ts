/** Wellbeing / resolution filter options — values are stable keys for URL, API, and SQL. */
export const WELLBEING_RESOLUTION_OPTIONS = [
  {
    value: "wb_counselling_open",
    label: "Counselling (Open)",
    category: "Counselling",
    closed: false,
  },
  {
    value: "wb_counselling_closed",
    label: "Counselling (Closed)",
    category: "Counselling",
    closed: true,
  },
  {
    value: "wb_monitoring_open",
    label: "Monitoring (Open)",
    category: "Monitoring",
    closed: false,
  },
  {
    value: "wb_monitoring_closed",
    label: "Monitoring (Closed)",
    category: "Monitoring",
    closed: true,
  },
  {
    value: "wb_flex_academic_open",
    label: "Flex-Academic (Open)",
    category: "Flex (Academic)",
    closed: false,
  },
  {
    value: "wb_flex_academic_closed",
    label: "Flex-Academic (Closed)",
    category: "Flex (Academic)",
    closed: true,
  },
  {
    value: "wb_flex_financial_open",
    label: "Flex-Financial (Open)",
    category: "Flex (Financial)",
    closed: false,
  },
  {
    value: "wb_flex_financial_closed",
    label: "Flex-Financial (Closed)",
    category: "Flex (Financial)",
    closed: true,
  },
] as const;

export type WellbeingResolutionValue = (typeof WELLBEING_RESOLUTION_OPTIONS)[number]["value"];

export const WELLBEING_RESOLUTION_BY_VALUE = new Map(
  WELLBEING_RESOLUTION_OPTIONS.map((o) => [o.value, o])
);
