"use client";

import { useMemo, useState } from "react";
import type { AppUser, InstructorStats } from "../fetch";
import { cn } from "@/lib/utils";
import { ChipSectionExpand } from "./ChipSectionExpand";

type PropsType = {
  user: AppUser | null;
  selectedProgramId?: string;
  selectedCourseId?: string;
  selectedInstructorId?: string;
  stats?: InstructorStats[] | null;
  onSelectInstructorId?: (instructorId: string) => void;
};

export function HodInstructorStats({
  user,
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
  if (!user || user.role !== "hod" || !user.department_ids?.length) return null;
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
          <div
            className={cn(
              "custom-scrollbar flex flex-wrap gap-2 overflow-y-auto",
              isExpanded ? "max-h-none" : "max-h-[240px]"
            )}
          >
          {list.map((i) => {
        const attendanceMissing = i.attendanceMissing ?? 0;
        const attendanceClassesHeld = i.attendanceClassesHeld ?? 0;
        return (
        <button
          key={i.instructorId}
          type="button"
          onClick={() => onSelectInstructorId?.(i.instructorId)}
          className={cn(
            "inline-flex bg-white flex-col rounded-lg border border-stroke px-4 py-3 text-left shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
            "min-w-[160px]",
            selectedInstructorId === i.instructorId &&
              "border-2 border-primary dark:border-primary"
          )}
        >
          <span className="text-body-sm font-semibold text-dark dark:text-white">
              {i.instructorName.includes("0") ? "Online Class" : i.instructorName}{" "}
            <span className="text-body-base dark:text-white">({i.total})</span>
          </span>
          <span className="text-body-base text-dark-6 space-x-2 dark:text-white">
            Att:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", i.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {i.yellowAttendance}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", i.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{i.redAttendance}</span>
            {" · "}
            SGPA:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", i.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {i.yellowGpa}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", i.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{i.redGpa}</span>
            {" · "}
            Att Missing <span className="text-red-500 font-bold">{attendanceMissing}</span> of{" "}
            <span className="text-red-500 font-bold">{attendanceClassesHeld}</span> 
          </span>
        </button>
      )})}
          </div>
        </>
      )}
    </ChipSectionExpand>
  );
}
