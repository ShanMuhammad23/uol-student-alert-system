"use client";

import type { ProgramStats, DeanStatsUser } from "@/lib/enrollment";
import { cn } from "@/lib/utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedProgramId?: string;
  masterFilterProgramIds?: string[];
  masterFilterDepartmentIds?: string[];
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: ProgramStats[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectProgramId?: (programId: string) => void;
};

export function DeanProgramStats({
  user,
  selectedProgramId,
  masterFilterProgramIds,
  masterFilterDepartmentIds,
  stats = null,
  onSelectProgramId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const list = stats ?? [];
  if (!list.length) return null;

  const effectiveDepartmentIds = masterFilterDepartmentIds ?? [];

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((p) => {
        const isSelected =
          (masterFilterProgramIds?.length
            ? masterFilterProgramIds.includes(p.programId)
            : selectedProgramId === p.programId);
        return (
          <button
            key={p.programId}
            type="button"
            onClick={() => onSelectProgramId?.(p.programId)}
            className={cn(
              "inline-flex bg-white flex-col rounded-lg border px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
              "min-w-[160px]",
              isSelected
                ? "border-2 border-primary dark:border-primary"
                : "border-stroke"
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {p.programTitle ?? p.programId}{" "}
              <span className="text-body-base dark:text-dark-5">({p.total})</span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
              Att:{" "}
              <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
                {p.yellowAttendance}
              </span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>
                {p.redAttendance}
              </span>
              {" · "}
              GPA:{" "}
              <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
                {p.yellowGpa}
              </span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>
                {p.redGpa}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
