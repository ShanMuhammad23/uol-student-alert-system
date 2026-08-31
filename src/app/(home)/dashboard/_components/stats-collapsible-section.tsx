"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const STATS_CHIP_SURFACE =
  "rounded-lg border px-4 py-3 shadow-1 transition hover:border-primary/50 hover:shadow bg-white border-stroke dark:bg-dark-2 dark:border-stroke-dark dark:hover:border-primary/50";

export const STATS_CHIP_SELECTED =
  "border-2 border-primary dark:border-primary dark:bg-primary/15";

export const STATS_CHIP_ALERT =
  "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-700/60";

export function statsSortButtonClass(active: boolean): string {
  return cn(
    "rounded-md border px-2 py-1 font-medium",
    active
      ? "border-primary bg-primary/5 text-primary dark:border-primary dark:bg-primary/15 dark:text-primary"
      : "border-stroke text-dark-6 hover:border-primary/40 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6 dark:hover:border-dark-6 dark:hover:text-white"
  );
}

type Props = {
  title: string;
  count?: number;
  trainedCount?: number;
  needTrainingCount?: number;
  defaultOpen?: boolean;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  showMaximize?: boolean;
  contentClassName?: string;
  children: ReactNode;
};

export function StatsCollapsibleSection({
  title,
  count,
  trainedCount,
  needTrainingCount,
  defaultOpen = false,
  onClear,
  hasActiveFilters,
  showMaximize = true,
  contentClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  const openFullscreen = (e: MouseEvent) => {
    e.stopPropagation();
    if (!open) setOpen(true);
    const trigger = contentRef.current?.querySelector<HTMLButtonElement>(
      "[data-chip-expand-trigger]"
    );
    trigger?.click();
  };

  return (
    <div className="overflow-hidden border border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 bg-primary px-4 py-3 text-left text-body-sm font-semibold text-white transition-colors hover:bg-primary/90"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {title}
              {typeof count === "number" && (
                <span className="ml-1 text-base font-normal text-white/90">
                  ({count})
                </span>
              )}
            </span>
            {typeof trainedCount === "number" &&
              typeof needTrainingCount === "number" && (
                <span className="text-[11px] font-normal text-white/80">
                  Trained {trainedCount} · Need Training {needTrainingCount}
                </span>
              )}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                if (!hasActiveFilters) return;
                onClear();
              }}
              disabled={!hasActiveFilters}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                hasActiveFilters
                  ? "border-white/50 text-white hover:bg-white/10"
                  : "cursor-not-allowed border-transparent text-white/40"
              )}
            >
              Clear
            </button>
          )}
          {showMaximize && (
            <button
              type="button"
              onClick={openFullscreen}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/10"
            >
              <Maximize2 className="h-3 w-3" />
              Maximize
            </button>
          )}
        </span>
        <span
          className={cn("text-white transition-transform", open && "rotate-180")}
          aria-hidden
        >
          <ChevronDownIcon className="h-4 w-4" />
        </span>
      </button>
      {open && (
        <div
          ref={contentRef}
          className={cn(
            "border-t border-stroke bg-gray-1 px-3 py-3 dark:border-stroke-dark dark:bg-gray-dark",
            contentClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
