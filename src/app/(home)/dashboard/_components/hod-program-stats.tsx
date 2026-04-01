"use client";

import type { AppUser, ProgramStats } from "../fetch";
import { cn } from "@/lib/utils";

type PropsType = {
  user: AppUser | null;
  selectedProgramId?: string;
  /** When set, these programs are shown as selected (bordered) from MasterFilter. */
  masterFilterProgramIds?: string[];
  stats?: ProgramStats[] | null;
  onSelectProgramId?: (programId: string) => void;
};

export function HodProgramStats({
  user,
  selectedProgramId,
  masterFilterProgramIds,
  stats = null,
  onSelectProgramId,
}: PropsType) {
  if (!user || user.role !== "hod" || !user.department_ids?.length) return null;
  const list = stats ?? [];
  if (!list.length) return null;

  return (
    <div className="max-h-[228px] space-y-2 overflow-y-auto pr-1">
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
              "flex w-full bg-white flex-col rounded-lg border px-4 py-3 text-left shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
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
              Att: <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>{p.yellowAttendance}</span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{p.redAttendance}</span>
              {" · "}
              GPA: <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>{p.yellowGpa}</span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{p.redGpa}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
