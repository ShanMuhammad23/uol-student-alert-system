"use client";

import { cn } from "@/lib/utils";
import type { InterventionListStats } from "@/lib/db/interventions";
import { INTERVENTION_STATUS_STYLES } from "@/lib/intervention-status-colors";

type StatusFilter = "all" | "initiated" | "in-progress" | "referred" | "resolved" | "no-action-required";

type Props = {
  stats: InterventionListStats;
  activeStatus: StatusFilter;
  onStatusSelect: (status: StatusFilter) => void;
};

const TOTAL_CARD = {
  bg: "#1e293b",
  text: "#ffffff",
  label: "Total",
};

const CARDS: {
  key: StatusFilter;
  label: string;
  statKey: keyof InterventionListStats | "total";
  bg: string;
  text: string;
}[] = [
  {
    key: "all",
    label: TOTAL_CARD.label,
    statKey: "total",
    bg: TOTAL_CARD.bg,
    text: TOTAL_CARD.text,
  },
  {
    key: "initiated",
    label: INTERVENTION_STATUS_STYLES.initiated.label,
    statKey: "initiated",
    bg: INTERVENTION_STATUS_STYLES.initiated.bg,
    text: INTERVENTION_STATUS_STYLES.initiated.text,
  },
  {
    key: "in-progress",
    label: INTERVENTION_STATUS_STYLES["in-progress"].label,
    statKey: "inProgress",
    bg: INTERVENTION_STATUS_STYLES["in-progress"].bg,
    text: INTERVENTION_STATUS_STYLES["in-progress"].text,
  },
  {
    key: "referred",
    label: INTERVENTION_STATUS_STYLES.referred.label,
    statKey: "referred",
    bg: INTERVENTION_STATUS_STYLES.referred.bg,
    text: INTERVENTION_STATUS_STYLES.referred.text,
  },
  {
    key: "resolved",
    label: INTERVENTION_STATUS_STYLES.resolved.label,
    statKey: "resolved",
    bg: INTERVENTION_STATUS_STYLES.resolved.bg,
    text: INTERVENTION_STATUS_STYLES.resolved.text,
  },
  {
    key: "no-action-required",
    label: "No Action",
    statKey: "noActionRequired",
    bg: INTERVENTION_STATUS_STYLES["no-action-required"].bg,
    text: INTERVENTION_STATUS_STYLES["no-action-required"].text,
  },
];

export function InterventionStatsCards({ stats, activeStatus, onStatusSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((card) => {
        const value = stats[card.statKey];
        const isActive = activeStatus === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onStatusSelect(card.key)}
            className={cn(
              "rounded-xl p-4 text-left transition-all hover:brightness-110 hover:shadow-md",
              isActive && "ring-2 ring-white ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900"
            )}
            style={{
              backgroundColor: card.bg,
              color: card.text,
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
          </button>
        );
      })}
    </div>
  );
}

export type { StatusFilter };
