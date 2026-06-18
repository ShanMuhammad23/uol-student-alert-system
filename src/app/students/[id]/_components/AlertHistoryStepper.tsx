import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { AlertLevel, StudentAlertDailyEntry } from "@/lib/db/student-alert-history";

type Props = {
  entries: StudentAlertDailyEntry[];
  variant?: "default" | "hero";
};

type DaySnapshot = {
  date: string;
  overallLevel: AlertLevel;
};

type StepperStep =
  | { kind: "snapshot"; date: string; overallLevel: AlertLevel }
  | { kind: "no-update"; days: number };

function worstLevel(levels: AlertLevel[]): AlertLevel {
  if (levels.some((l) => l === "critical")) return "critical";
  if (levels.some((l) => l === "warning")) return "warning";
  return "none";
}

function groupEntriesByDate(entries: StudentAlertDailyEntry[]): DaySnapshot[] {
  const byDate = new Map<string, StudentAlertDailyEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.snapshotDate) ?? [];
    list.push(entry);
    byDate.set(entry.snapshotDate, list);
  }

  return Array.from(byDate.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const courses = byDate.get(date) ?? [];
      return {
        date,
        overallLevel: worstLevel(courses.map((c) => c.overallAlertLevel)),
      };
    });
}

function levelDotClass(level: AlertLevel, hero: boolean, hollow = false): string {
  if (hollow) {
    return hero
      ? "border-2 border-white/30 bg-transparent ring-0"
      : "border-2 border-gray-300 bg-transparent ring-0 dark:border-dark-3";
  }
  if (level === "critical") {
    return hero
      ? "bg-red-400 ring-4 ring-red-400/30"
      : "bg-red-500 ring-4 ring-red-500/25";
  }
  if (level === "warning") {
    return hero
      ? "bg-amber-400 ring-4 ring-amber-400/30"
      : "bg-amber-500 ring-4 ring-amber-500/25";
  }
  return hero
    ? "bg-emerald-400 ring-4 ring-emerald-400/30"
    : "bg-emerald-500 ring-4 ring-emerald-500/25";
}

function levelLineClass(level: AlertLevel, hero: boolean): string {
  if (hero) {
    if (level === "critical") return "bg-red-400/50";
    if (level === "warning") return "bg-amber-400/50";
    return "bg-white/30";
  }
  if (level === "critical") return "bg-red-300 dark:bg-red-900/40";
  if (level === "warning") return "bg-amber-300 dark:bg-amber-900/40";
  return "bg-emerald-300 dark:bg-emerald-900/40";
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysSinceDate(date: string): number {
  const last = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatNoUpdateLabel(days: number): string {
  if (days === 0) return "Updated today";
  if (days === 1) return "No update for 1 day";
  return `No update for ${days} days`;
}

function buildSteps(snapshots: DaySnapshot[]): StepperStep[] {
  const steps: StepperStep[] = snapshots.map((s) => ({
    kind: "snapshot",
    date: s.date,
    overallLevel: s.overallLevel,
  }));

  const last = snapshots.at(-1);
  if (last) {
    steps.push({ kind: "no-update", days: daysSinceDate(last.date) });
  }

  return steps;
}

function connectorLevel(step: StepperStep): AlertLevel {
  if (step.kind === "snapshot") return step.overallLevel;
  return "none";
}

export function AlertHistoryStepper({
  entries,
  variant = "default",
}: Props) {
  const snapshots = groupEntriesByDate(entries);
  const hero = variant === "hero";
  const steps = buildSteps(snapshots);

  if (steps.length === 0) return null;

  return (
    <div
      className={cn(
        hero ? "mt-5 border-t border-white/15 pt-4" : "rounded-2xl bg-white px-5 py-4 shadow-sm dark:bg-gray-dark"
      )}
    >
      <div className="overflow-x-auto pb-1">
        <ol className="inline-flex min-w-min items-center">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const inAlert =
              step.kind === "snapshot" && step.overallLevel !== "none";

            return (
              <Fragment key={step.kind === "snapshot" ? step.date : "no-update"}>
                <li
                  className="flex w-14 shrink-0 flex-col items-center"
                  title={
                    step.kind === "snapshot"
                      ? inAlert
                        ? `${step.date}: ${step.overallLevel === "critical" ? "Red" : "Yellow"} alert`
                        : `${step.date}: No alert`
                      : formatNoUpdateLabel(step.days)
                  }
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      levelDotClass(
                        step.kind === "snapshot" ? step.overallLevel : "none",
                        hero,
                        step.kind === "no-update"
                      )
                    )}
                    aria-hidden
                  />
                  {step.kind === "snapshot" ? (
                    <time
                      dateTime={step.date}
                      className={cn(
                        "mt-2 text-center text-[10px] leading-tight",
                        hero
                          ? inAlert
                            ? "font-semibold text-white"
                            : "text-white/50"
                          : inAlert
                            ? "font-semibold text-dark dark:text-white"
                            : "text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {formatShortDate(step.date)}
                    </time>
                  ) : (
                    <span
                      className={cn(
                        "mt-2 max-w-[5.5rem] text-center text-[10px] leading-tight",
                        hero ? "text-white/40" : "text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {formatNoUpdateLabel(step.days)}
                    </span>
                  )}
                </li>
                {!isLast ? (
                  <span
                    className={cn(
                      "h-0.5 w-8 shrink-0 sm:w-10",
                      levelLineClass(connectorLevel(step), hero)
                    )}
                    aria-hidden
                  />
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
