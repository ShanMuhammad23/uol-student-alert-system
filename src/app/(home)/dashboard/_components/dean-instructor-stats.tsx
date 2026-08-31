"use client";

import { useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import type {
  InstructorStats,
  DeanStatsUser,
} from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import { ChipSectionExpand } from "./ChipSectionExpand";
import {
  STATS_CHIP_ALERT,
  STATS_CHIP_SELECTED,
  STATS_CHIP_SURFACE,
  statsSortButtonClass,
} from "./stats-collapsible-section";

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
    <ChipSectionExpand title="Instructor Stats">
      {(isExpanded) => (
        <>
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
                className={cn("mb-2", statsSortButtonClass(sortMetric === metric))}
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
          <div
            className={cn(
              "custom-scrollbar flex flex-wrap gap-2 overflow-y-auto",
              isExpanded ? "max-h-none" : "max-h-[240px]"
            )}
          >
          {list.map((i) => {
        const attendanceMissing = i.attendanceMissing ?? 0;
        const attendanceClassesHeld = i.attendanceClassesHeld ?? 0;
        const hasAllCoursesClassAverageHundred =
          i.allCoursesClassAverageAttendanceHundred === true;
        return (
        <button
          key={i.instructorId}
          type="button"
          onClick={() => onSelectInstructorId?.(i.instructorId)}
          className={cn(
            "relative inline-flex min-w-[160px] flex-col pr-7",
            STATS_CHIP_SURFACE,
            hasAllCoursesClassAverageHundred && STATS_CHIP_ALERT,
            selectedInstructorId === i.instructorId && STATS_CHIP_SELECTED
          )}
        >
          {i.isRegisteredOnPortal ? (
            <span
              title="Registered trainer on portal"
              aria-label="Registered trainer on portal"
              className="absolute right-1.5 top-1.5 inline-flex text-emerald-600 dark:text-emerald-400"
            >
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          ) : null}
          <span className="text-body-sm font-semibold text-dark dark:text-white">
            {i.instructorName.includes("0") ? "Online Class" : i.instructorName}{" "}
            <span className="text-body-base dark:text-white">
              ({i.total})
            </span>
          </span>
          <span className="text-body-base space-x-2 text-dark-6 dark:text-dark-6">
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
            {" |"}
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
           
            {" |"}
            Att Missing{" "}
            <span className="text-primary font-bold">{attendanceMissing}</span>{" "}
            of{" "}
            <span className="text-primary font-bold">{attendanceClassesHeld}</span>{" "}
            
          </span>
        </button>
      )})}
          </div>
        </>
      )}
    </ChipSectionExpand>
  );
}
