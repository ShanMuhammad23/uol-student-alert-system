"use client";

import { useMemo } from "react";
import type {
  InstructorStats,
  DeanStatsUser,
  EnrollmentRecord,
} from "@/lib/enrollment";
import { cn } from "@/lib/utils";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import {
  getAttendanceAlertLevel,
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedDepartmentId?: string;
  selectedInstructorId?: string;
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: InstructorStats[] | null;
  /** Filtered enrollment data used for alerts aggregation. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectInstructorId?: (instructorId: string) => void;
};

export function DeanInstructorStats({
  user,
  selectedDepartmentId,
  selectedInstructorId,
  stats = null,
  enrollmentData = [],
  onSelectInstructorId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const baseList = stats ?? [];
  if (!baseList.length) return null;

  const rows = enrollmentData ?? [];
  const { attendanceSummaries, classAverageByCourseSection } =
    useAttendanceAlerts(rows);

  const instructorAlertCounts = useMemo(() => {
    const map = new Map<
      string,
      { yellowAttendance: number; redAttendance: number }
    >();
    if (!rows.length || !attendanceSummaries) return map;

    for (const row of rows) {
      const pernr = (row.Pernr ?? "").trim();
      if (!pernr) continue;

      const monitorKey = `${normalizeCourseCode(
        typeof row.CrCode === "string"
          ? row.CrCode
          : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;

      const attendanceKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attendanceKey);
      if (!summary) continue;

      const classAvg =
        classAverageByCourseSection.get(monitorKey ?? "") ?? null;
      const level =
        summary && classAvg != null
          ? getAttendanceAlertLevel(summary.percentage, classAvg)
          : null;

      if (level !== "critical" && level !== "warning") continue;

      if (!map.has(pernr)) {
        map.set(pernr, { yellowAttendance: 0, redAttendance: 0 });
      }
      const bucket = map.get(pernr)!;
      if (level === "warning") bucket.yellowAttendance += 1;
      if (level === "critical") bucket.redAttendance += 1;
    }

    return map;
  }, [rows, attendanceSummaries, classAverageByCourseSection]);

  const list = baseList.map((i) => {
    const agg = instructorAlertCounts.get(i.instructorId);
    return {
      ...i,
      yellowAttendance: agg?.yellowAttendance ?? i.yellowAttendance,
      redAttendance: agg?.redAttendance ?? i.redAttendance,
    };
  });

  if (!list.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((i) => (
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
            {i.instructorName}{" "}
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
          </span>
        </button>
      ))}
    </div>
  );
}

