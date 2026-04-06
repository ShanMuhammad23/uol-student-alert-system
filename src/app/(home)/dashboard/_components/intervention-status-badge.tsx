"use client";

import { cn } from "@/lib/utils";

/** Campaign chart status colors (homepage). */
const INTERVENTION_STATUS_STYLES: Record<
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

type Props = {
  /** Latest intervention status from store (e.g. initiated, in-progress) or null for Not Started. */
  status: string | null;
  /** When true, student has no GPA/attendance alerts; show hyphen instead of status. */
  goodStanding?: boolean;
  className?: string;
};

function normalizeStatus(status: string | null): string {
  const raw = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
  if (!raw) return "not_started";
  if (raw === "not-started") return "not_started";
  return raw;
}

export function InterventionStatusBadge({ status, goodStanding, className }: Props) {
  const normalized = normalizeStatus(status);
  const hasStatus = normalized !== "not_started";

  // Always show an explicit intervention status if present, even for good-standing students.
  if (goodStanding && !hasStatus) {
    return (
      <span
        className={cn("inline-flex items-center text-muted-foreground text-xs", className)}
        title="Good standing"
      >
        –
      </span>
    );
  }

  const key = normalized;
  const style = INTERVENTION_STATUS_STYLES[key] ?? INTERVENTION_STATUS_STYLES.not_started;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
      }}
      title={style.label}
    >
      {style.label}
    </span>
  );
}
