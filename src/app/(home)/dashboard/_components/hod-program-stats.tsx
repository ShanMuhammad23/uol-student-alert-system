"use client";

import { useMemo, useState } from "react";
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
  const baseList = stats ?? [];
  const [sortMetric, setSortMetric] = useState<
    "attendance" | "sgpa" | "attendance-missing"
  >("attendance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const list = useMemo(() => {
    const arr = [...baseList];
    arr.sort((a, b) => {
      const aAttendance = a.yellowAttendance + a.redAttendance;
      const bAttendance = b.yellowAttendance + b.redAttendance;
      const aSgpa = a.yellowGpa + a.redGpa;
      const bSgpa = b.yellowGpa + b.redGpa;
      const aMissing = aAttendance;
      const bMissing = bAttendance;
      const diff =
        sortMetric === "attendance"
          ? bAttendance - aAttendance
          : sortMetric === "sgpa"
          ? bSgpa - aSgpa
          : bMissing - aMissing;
      return sortDir === "desc" ? diff : -diff;
    });
    return arr;
  }, [baseList, sortMetric, sortDir]);
  if (!list.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["attendance", "sgpa", "attendance-missing"] as const).map((metric) => (
          <button
            key={metric}
            type="button"
            onClick={() => {
              if (sortMetric === metric) {
                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
              } else {
                setSortMetric(metric);
                setSortDir("desc");
              }
            }}
            className={cn(
              "rounded-md border px-2 py-1 font-medium",
              sortMetric === metric
                ? "border-primary text-primary"
                : "border-stroke text-dark-6 dark:border-dark-3 dark:text-dark-5"
            )}
          >
            {metric === "attendance"
              ? "Attendance"
              : metric === "sgpa"
              ? "SGPA"
              : "Attendance Missing"}{" "}
            {sortMetric === metric ? (sortDir === "desc" ? "▼" : "▲") : ""}
          </button>
        ))}
      </div>
      <div className="max-h-[228px] space-y-2 overflow-y-auto pr-1">
      {list.map((p) => {
        const attendanceMissing = p.yellowAttendance + p.redAttendance;
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
              {" · "}
              Att Missing: <span className="text-red-500 font-bold">{attendanceMissing}</span>
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
