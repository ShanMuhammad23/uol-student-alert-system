"use client";

import { useMemo, useState } from "react";
import type { DeanStatsUser } from "@/lib/enrollment";
import type { CourseStats } from "../fetch";
import { cn } from "@/lib/utils";
import { ChipSectionExpand } from "./ChipSectionExpand";
import {
  STATS_CHIP_SELECTED,
  STATS_CHIP_SURFACE,
  statsSortButtonClass,
} from "./stats-collapsible-section";

type PropsType = {
  user: DeanStatsUser | null;
  selectedCourseId?: string;
  masterFilterCourseIds?: string[];
  stats?: CourseStats[] | null;
  onSelectCourseId?: (courseId: string) => void;
};

export function DeanCourseStats({
  user,
  selectedCourseId,
  masterFilterCourseIds,
  stats = null,
  onSelectCourseId,
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
    <ChipSectionExpand title="Course Stats">
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
          {list.map((c) => {
        const attendanceMissing = c.attendanceMissing ?? 0;
        const attendanceClassesHeld = c.attendanceClassesHeld ?? 0;
        const key = c.courseId;
        const isSelected = masterFilterCourseIds?.length
          ? masterFilterCourseIds.includes(key)
          : selectedCourseId === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectCourseId?.(key)}
            className={cn(
              "inline-flex min-w-[160px] flex-col",
              STATS_CHIP_SURFACE,
              isSelected ? STATS_CHIP_SELECTED : "border-stroke"
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {c.courseName}{" "}
              <span className="text-body-base dark:text-white">
                ({c.total})
              </span>
            </span>
            <span className="text-body-base space-x-2 text-dark-6 dark:text-dark-6">
              Att:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  c.yellowAttendance > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.yellowAttendance}
              </span>
              {" |"}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  c.redAttendance > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.redAttendance}
              </span>
              
              {" | "}
              Att Missing{" "}
              <span className="text-primary font-bold">{attendanceMissing}</span>{" "}
              of{" "}
              <span className="text-primary font-bold">{attendanceClassesHeld}</span>{" "}
             
            </span>
          </button>
        );
      })}
          </div>
        </>
      )}
    </ChipSectionExpand>
  );
}

