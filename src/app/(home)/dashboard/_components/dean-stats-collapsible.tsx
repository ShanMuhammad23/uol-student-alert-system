"use client";

import { useRef, useState, type ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

type CollapsibleSectionProps = {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  onClear,
  hasActiveFilters,
  children,
}: CollapsibleSectionProps) {
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
    <div className=" border border-stroke dark:border-stroke-dark  dark:bg-gray-dark overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-3 text-left",
          "text-body-sm font-semibold text-white bg-primary dark:text-white",
          " dark:hover:bg-gray-3 transition-colors"
        )}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span>
            {title}
            {typeof count === "number" && (
              <span className="ml-1 text-base font-normal dark:text-white">
                ({count})
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
                  ? "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-gray-3"
                  : "border-transparent text-dark-5 cursor-not-allowed"
              )}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={openFullscreen}
            className="inline-flex items-center gap-1 rounded-full border border-stroke px-2 py-0.5 text-[11px] font-medium text-white hover:border-primary dark:border-dark-3 dark:text-white"
          >
            <Maximize2 className="h-3 w-3" />
            Maximize
          </button>
        </span>
        <span
          className={cn(
            "text-dark-6 dark:text-white transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        >
          <ChevronDownIcon className="w-4 h-4 text-white" />
        </span>
      </button>
      {open && (
        <div ref={contentRef} className="border-t border-stroke dark:border-stroke-dark px-1">
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

type DeanStatsCollapsibleProps = {
  departmentContent: ReactNode;
  programContent: ReactNode;
  instructorContent: ReactNode;
  courseContent: ReactNode;
  /** When set, Instructors section is open by default so instructors for the selected department auto-appear. */
  selectedDepartmentId?: string;
  /** When set, Instructors section is also opened when a program is selected. */
  selectedProgramId?: string;
  departmentCount?: number;
  programCount?: number;
  instructorCount?: number;
  courseCount?: number;
  onClearDepartmentFilters?: () => void;
  onClearProgramFilters?: () => void;
  onClearInstructorFilters?: () => void;
  onClearCourseFilters?: () => void;
  hasDepartmentFilters?: boolean;
  hasProgramFilters?: boolean;
  hasInstructorFilters?: boolean;
  hasCourseFilters?: boolean;
};

export function DeanStatsCollapsible({
  departmentContent,
  programContent,
  instructorContent,
  courseContent,
  selectedDepartmentId,
  selectedProgramId,
  departmentCount,
  programCount,
  instructorCount,
  courseCount,
  onClearDepartmentFilters,
  onClearProgramFilters,
  onClearInstructorFilters,
  onClearCourseFilters,
  hasDepartmentFilters,
  hasProgramFilters,
  hasInstructorFilters,
  hasCourseFilters,
}: DeanStatsCollapsibleProps) {
  return (
    <div className="  border">
      <div className="grid grid-cols-1 md:grid-cols-2 ">
        <CollapsibleSection
          title="Department"
          count={departmentCount}
          defaultOpen={true}
          onClear={onClearDepartmentFilters}
          hasActiveFilters={hasDepartmentFilters}
        >
          {departmentContent}
        </CollapsibleSection>
        <CollapsibleSection
          title="Program"
          count={programCount}
          defaultOpen={true}
          onClear={onClearProgramFilters}
          hasActiveFilters={hasProgramFilters}
        >
          {programContent}
        </CollapsibleSection>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <CollapsibleSection
          title="Course"
          count={courseCount}
          defaultOpen={false}
          onClear={onClearCourseFilters}
          hasActiveFilters={hasCourseFilters}
        >
          {courseContent}
        </CollapsibleSection>
        <CollapsibleSection
          title="Instructor"
          count={instructorCount}
          defaultOpen={!!selectedDepartmentId || !!selectedProgramId}
          onClear={onClearInstructorFilters}
          hasActiveFilters={hasInstructorFilters}
        >
          {instructorContent}
        </CollapsibleSection>
      </div>
    </div>
  );
}
