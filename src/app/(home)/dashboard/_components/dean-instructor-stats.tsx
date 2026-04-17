"use client";

import { useMemo, useState } from "react";
import type {
  InstructorStats,
  DeanStatsUser,
} from "@/lib/enrollment";
import { cn } from "@/lib/utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedDepartmentId?: string;
  selectedInstructorId?: string;
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: InstructorStats[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectInstructorId?: (instructorId: string) => void;
};

export function DeanInstructorStats({
  user,
  selectedDepartmentId,
  selectedInstructorId,
  stats = null,
  onSelectInstructorId,
}: PropsType) {
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

  if (!user || user.role !== "dean") return null;
  if (!baseList.length) return null;
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
      <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((i) => {
        const attendanceMissing = i.yellowAttendance + i.redAttendance;
        return (
        <button
          key={i.instructorId}
          type="button"
          onClick={() => onSelectInstructorId?.(i.instructorId)}
          className={cn(
            "inline-flex bg-white flex-col rounded-lg border border-stroke px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
            "min-w-[160px]",
          )}
        >
          <span className="text-body-sm font-semibold text-dark dark:text-white">
            {i.instructorName.includes("0") ? "Online Class" : i.instructorName}{" "}
            <span className="text-body-base dark:text-dark-5">
              ({i.total})
            </span>
          </span>
          <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
            Att:{" "}
            <span
              className={cn(
                "text-amber-500 dark:text-amber-500 font-bold",
                i.yellowAttendance > 0
                  ? "text-amber-500 dark:text-amber-500"
                  : "text-gray-600 dark:text-gray-400",
              )}
            >
              {i.yellowAttendance}
            </span>
            {" | "}
            <span
              className={cn(
                "text-red-500 font-bold",
                i.redAttendance > 0
                  ? "text-red-500"
                  : "text-gray-600 dark:text-gray-400",
              )}
            >
              {i.redAttendance}
            </span>
            {" · "}
            GPA:{" "}
            <span
              className={cn(
                "text-amber-500 dark:text-amber-500 font-bold",
                i.yellowGpa > 0
                  ? "text-amber-500 dark:text-amber-500"
                  : "text-gray-600 dark:text-gray-400",
              )}
            >
              {i.yellowGpa}
            </span>
            {" | "}
            <span
              className={cn(
                "text-red-500 font-bold",
                i.redGpa > 0
                  ? "text-red-500"
                  : "text-gray-600 dark:text-gray-400",
              )}
            >
              {i.redGpa}
            </span>
            {" · "}
            Att Missing:{" "}
            <span className="text-red-500 font-bold">{attendanceMissing}</span>
          </span>
        </button>
      )})}
      </div>
    </div>
  );
}

