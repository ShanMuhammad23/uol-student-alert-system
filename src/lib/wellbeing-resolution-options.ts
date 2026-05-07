/** Wellbeing / resolution filter options — values are stable keys for URL, API, and SQL. */
export const WELLBEING_RESOLUTION_OPTIONS = [
  {
    value: "wb_counselling_open",
    label: "Counselling (O)",
    category: "Counselling",
    closed: false,
  },
  {
    value: "wb_counselling_closed",
    label: "Counselling (C)",
    category: "Counselling",
    closed: true,
  },
  {
    value: "wb_monitoring_open",
    label: "Monitoring (O)",
    category: "Monitoring",
    closed: false,
  },
  {
    value: "wb_monitoring_closed",
    label: "Monitoring (C)",
    category: "Monitoring",
    closed: true,
  },
  {
    value: "wb_flex_academic_open",
    label: "Flex-Academic (O)",
    category: "Flex (Academic)",
    closed: false,
  },
  {
    value: "wb_flex_academic_closed",
    label: "Flex-Academic (C)",
    category: "Flex (Academic)",
    closed: true,
  },
  {
    value: "wb_flex_financial_open",
    label: "Flex-Financial (O)",
    category: "Flex (Financial)",
    closed: false,
  },
  {
    value: "wb_flex_financial_closed",
    label: "Flex-Financial (C)",
    category: "Flex (Financial)",
    closed: true,
  },
  /** Categories outside the four standard CHECK values (legacy or future rows). */
  {
    value: "wb_others_open",
    label: "Other (O)",
    category: "Others",
    closed: false,
    othersBucket: true,
  },
  {
    value: "wb_others_closed",
    label: "Others (C)",
    category: "Others",
    closed: true,
    othersBucket: true,
  },
] as const;

export type WellbeingResolutionValue = (typeof WELLBEING_RESOLUTION_OPTIONS)[number]["value"];

export const WELLBEING_RESOLUTION_BY_VALUE = new Map(
  WELLBEING_RESOLUTION_OPTIONS.map((o) => [o.value, o])
);
