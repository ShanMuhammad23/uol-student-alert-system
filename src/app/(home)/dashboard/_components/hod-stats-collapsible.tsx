"use client";

import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

type CollapsibleSectionProps = {
  title: string;
  count?: number;
  trainedCount?: number;
  needTrainingCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  count,
  trainedCount,
  needTrainingCount,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  const openFullscreen = (e: MouseEvent<HTMLButtonElement>) => {
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
          "text-body-sm font-semibold text-dark dark:text-white",
          " dark:hover:bg-gray-3 transition-colors"
        )}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {title}
              {typeof count === "number" && (
                <span className="ml-1 text-xs font-normal text-dark-6 dark:text-white">
                  ({count})
                </span>
              )}
            </span>
            {typeof trainedCount === "number" &&
              typeof needTrainingCount === "number" && (
                <span className="text-[11px] font-normal text-dark-6 dark:text-white/80">
                  Trained {trainedCount} · Need Training {needTrainingCount}
                </span>
              )}
          </span>
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
        <div ref={contentRef} className="border-t border-stroke dark:border-stroke-dark px-4 py-3 bg-white">
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

type HodStatsCollapsibleProps = {
  programContent: ReactNode;
  courseContent: ReactNode;
  instructorContent: ReactNode;
  /** When set, Instructors section is open by default. */
  selectedProgramId?: string;
  selectedCourseId?: string;
  programCount?: number;
  courseCount?: number;
  instructorCount?: number;
  instructorTrainedCount?: number;
  instructorNeedTrainingCount?: number;
};

export function HodStatsCollapsible({
  programContent,
  courseContent,
  instructorContent,
  selectedProgramId,
  selectedCourseId,
  programCount,
  courseCount,
  instructorCount,
  instructorTrainedCount,
  instructorNeedTrainingCount,
}: HodStatsCollapsibleProps) {
  return (
    <div className="mt-4  pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <CollapsibleSection
        title="Program"
        count={programCount}
        defaultOpen={true}
      >
        {programContent}
      </CollapsibleSection>
      <CollapsibleSection
        title="Course"
        count={courseCount}
        defaultOpen={!!selectedProgramId}
      >
        {courseContent}
      </CollapsibleSection>
      <CollapsibleSection
        title="Instructors"
        count={instructorCount}
        trainedCount={instructorTrainedCount}
        needTrainingCount={instructorNeedTrainingCount}
        defaultOpen={!!selectedProgramId || !!selectedCourseId}
      >
        {instructorContent}
      </CollapsibleSection>
    </div>
  );
}
