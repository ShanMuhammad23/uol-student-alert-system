/** Shared intervention status palette (badges, charts, stats cards). */
export const INTERVENTION_STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  not_started: {
    label: "Not Started",
    bg: "#DE2649",
    text: "#ffffff",
  },
  initiated: {
    label: "Initiated",
    bg: "#B5B126",
    text: "#ffffff",
  },
  "in-progress": {
    label: "In-Progress",
    bg: "#DBBE0F",
    text: "#1a1a1a",
  },
  referred: {
    label: "Referred",
    bg: "#9C5A99",
    text: "#ffffff",
  },
  resolved: {
    label: "Resolved",
    bg: "#477061",
    text: "#ffffff",
  },
  "no-action-required": {
    label: "No Action Required",
    bg: "#64748B",
    text: "#ffffff",
  },
};
