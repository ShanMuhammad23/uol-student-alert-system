"use client";

import { cn } from "@/lib/utils";
import { useDashboardUiState } from "./DashboardUiStateContext";

type Props = {
  className?: string;
};

export function StudentsViewTabs({ className }: Props) {
  const { viewMode, setViewMode, attendanceMissingTotal } = useDashboardUiState();

  return (
    <div
      className={cn(
        "flex rounded-lg border border-stroke bg-gray-50 p-1 dark:border-dark-3 dark:bg-dark-2",
        className,
      )}
      role="tablist"
      aria-label="Students list view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "table"}
        onClick={() => setViewMode("table")}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium transition-colors",
          viewMode === "table"
            ? "bg-white text-primary shadow-sm dark:bg-gray-dark dark:text-primary"
            : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white",
        )}
      >
        Table view
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "nested"}
        onClick={() => setViewMode("nested")}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium transition-colors",
          viewMode === "nested"
            ? "bg-white text-primary shadow-sm dark:bg-gray-dark dark:text-primary"
            : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white",
        )}
      >
        Nested view
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "attendance-missing"}
        onClick={() => setViewMode("attendance-missing")}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium transition-colors",
          viewMode === "attendance-missing"
            ? "bg-white text-primary shadow-sm dark:bg-gray-dark dark:text-primary"
            : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span>Attendance Missing</span>
          {typeof attendanceMissingTotal === "number" && (
            <span
              className={cn(
                "inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                viewMode === "attendance-missing"
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              )}
              aria-label={`Total missing attendance ${attendanceMissingTotal}`}
            >
              {attendanceMissingTotal.toLocaleString()}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "intervention-search"}
        onClick={() => setViewMode("intervention-search")}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium transition-colors",
          viewMode === "intervention-search"
            ? "bg-white text-primary shadow-sm dark:bg-gray-dark dark:text-primary"
            : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white",
        )}
      >
        Search Intervention By Student Number
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "intervention-teacher-search"}
        onClick={() => setViewMode("intervention-teacher-search")}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium transition-colors",
          viewMode === "intervention-teacher-search"
            ? "bg-white text-primary shadow-sm dark:bg-gray-dark dark:text-primary"
            : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white",
        )}
      >
        Search Intervention By Teacher Name or Pernr
      </button>
    </div>
  );
}
