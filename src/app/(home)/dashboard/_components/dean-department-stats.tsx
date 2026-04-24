"use client";

import { useMemo, useState } from "react";
import type {
  DepartmentStats,
  DeanStatsUser,
} from "@/lib/enrollment";
import { cn } from "@/lib/utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedDepartmentId?: string;
  /** When set, these departments are shown as selected (bordered) from MasterFilter. */
  masterFilterDepartmentIds?: string[];
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: DepartmentStats[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectDepartmentId?: (departmentId: string) => void;
};

export function DeanDepartmentStats({
  user,
  selectedDepartmentId,
  masterFilterDepartmentIds,
  stats = null,
  onSelectDepartmentId,
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
      const aMissing = a.attendanceMissing ?? 0;
      const bMissing = b.attendanceMissing ?? 0;
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
  const metricCounts = useMemo(() => {
    let attendance = 0;
    let sgpa = 0;
    let missing = 0;
    for (const row of baseList) {
      attendance += row.yellowAttendance + row.redAttendance;
      sgpa += row.yellowGpa + row.redGpa;
      missing += row.attendanceMissing ?? 0;
    }
    return { attendance, sgpa, missing };
  }, [baseList]);

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
                : "border-stroke text-dark-6 dark:border-dark-3 dark:text-white"
            )}
          >
            {metric === "attendance"
              ? `${metricCounts.attendance} `
              : metric === "sgpa"
                ? `${metricCounts.sgpa} `
                : `${metricCounts.missing} `}
            {metric === "attendance"
              ? "Alert (Att.)"
              : metric === "sgpa"
              ? "Alert (SGPA)"
              : "Missing Attendance"}{" "}
            {sortMetric === metric ? (sortDir === "desc" ? "▼" : "▲") : ""}
          </button>
        ))}
      </div>
      <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((d) => {
        const attendanceMissing = d.attendanceMissing ?? 0;
        const attendanceClassesHeld = d.attendanceClassesHeld ?? 0;
        const isSelected =
          masterFilterDepartmentIds?.length
            ? masterFilterDepartmentIds.includes(d.departmentId)
            : selectedDepartmentId === d.departmentId;
        return (
          <button
            key={d.departmentId}
            type="button"
            onClick={() => onSelectDepartmentId?.(d.departmentId)}
            className={cn(
              "inline-flex bg-white flex-col rounded-lg border px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
              "min-w-[160px]",
              isSelected
                ? "border-2 border-primary dark:border-primary"
                : "border-stroke",
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {d.departmentName}{" "}
              <span className="text-body-base dark:text-white">
                ({d.total})
              </span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-white">
              Att:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  d.yellowAttendance > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {d.yellowAttendance}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  d.redAttendance > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {d.redAttendance}
              </span>
              {" · "}
              GPA:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  d.yellowGpa > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {d.yellowGpa}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  d.redGpa > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {d.redGpa}
              </span>
              {" · "}
              Att Missing{" "}
              <span className="text-red-500 font-bold">{attendanceMissing}</span>{" "}
              of{" "}
              <span className="text-red-500 font-bold">{attendanceClassesHeld}</span>{" "}
        
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

