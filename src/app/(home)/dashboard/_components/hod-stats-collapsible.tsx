"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-stroke dark:border-stroke-dark bg-white dark:bg-gray-dark overflow-hidden">
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
        <span>{title}</span>
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
  instructorContent: ReactNode;
  /** When set, Instructors section is open by default. */
  selectedProgramId?: string;
};

export function HodStatsCollapsible({
  programContent,
  instructorContent,
  selectedProgramId,
}: HodStatsCollapsibleProps) {
  return (
    <div className="mt-4 border-t border-gray-3 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <CollapsibleSection title="Programs" defaultOpen={true}>
        {programContent}
      </CollapsibleSection>
      <CollapsibleSection
        title="Instructors"
        defaultOpen={!!selectedProgramId}
      >
        {instructorContent}
      </CollapsibleSection>
    </div>
  );
}
