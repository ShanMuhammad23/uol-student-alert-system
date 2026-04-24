"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  courseContent: ReactNode;
  courseCount?: number;
};

export function InstructorStatsCollapsible({ courseContent, courseCount }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-4  pt-4">
      <div className="rounded-lg border border-stroke dark:border-stroke-dark bg-white dark:bg-gray-dark overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-4 py-3 text-left",
            "text-body-sm font-semibold text-dark dark:text-white",
            "dark:hover:bg-gray-3 transition-colors"
          )}
          aria-expanded={open}
        >
          <span>
            Courses
            {typeof courseCount === "number" && (
              <span className="ml-1 text-xs font-normal text-dark-6 dark:text-dark-5">
                ({courseCount})
              </span>
            )}
          </span>
          <span
            className={cn(
              "text-dark-6 dark:text-dark-5 transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          >
            <ChevronDownIcon className="w-4 h-4" />
          </span>
        </button>
        {open && (
          <div className="border-t border-stroke dark:border-stroke-dark px-4 py-3">
            {courseContent}
          </div>
        )}
      </div>
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
