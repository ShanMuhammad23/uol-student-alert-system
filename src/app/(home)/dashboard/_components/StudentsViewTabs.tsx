"use client";

import { cn } from "@/lib/utils";
import { useDashboardUiState } from "./DashboardUiStateContext";

type Props = {
  className?: string;
};

export function StudentsViewTabs({ className }: Props) {
  const { viewMode, setViewMode } = useDashboardUiState();

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
            : "text-dark-6 hover:text-dark dark:text-dark-5 dark:hover:text-white",
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
            : "text-dark-6 hover:text-dark dark:text-dark-5 dark:hover:text-white",
        )}
      >
        Nested view
      </button>
    </div>
  );
}
