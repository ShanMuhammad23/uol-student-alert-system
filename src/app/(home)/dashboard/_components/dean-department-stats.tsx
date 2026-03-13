"use client";

import { useMemo } from "react";
import type {
  DepartmentStats,
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
  /** When set, these departments are shown as selected (bordered) from MasterFilter. */
  masterFilterDepartmentIds?: string[];
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: DepartmentStats[] | null;
  /** Filtered enrollment data used for alerts aggregation. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectDepartmentId?: (departmentId: string) => void;
};

export function DeanDepartmentStats({
  user,
  selectedDepartmentId,
  masterFilterDepartmentIds,
  stats = null,
  enrollmentData = [],
  onSelectDepartmentId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const baseList = stats ?? [];
  if (!baseList.length) return null;

  const rows = enrollmentData ?? [];
  const { attendanceSummaries, classAverageByCourseSection } =
    useAttendanceAlerts(rows);

  const deptAlertCounts = useMemo(() => {
    const map = new Map<
      string,
      { yellowAttendance: number; redAttendance: number }
    >();
    if (!rows.length || !attendanceSummaries) return map;

    for (const row of rows) {
      const deptId = row.DeptCode || row.DeptId;
      if (!deptId) continue;

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

      if (!map.has(deptId)) {
        map.set(deptId, { yellowAttendance: 0, redAttendance: 0 });
      }
      const bucket = map.get(deptId)!;
      if (level === "warning") bucket.yellowAttendance += 1;
      if (level === "critical") bucket.redAttendance += 1;
    }

    return map;
  }, [rows, attendanceSummaries, classAverageByCourseSection]);

  const list = baseList.map((d) => {
    const agg = deptAlertCounts.get(d.departmentId);
    return {
      ...d,
      yellowAttendance: agg?.yellowAttendance ?? d.yellowAttendance,
      redAttendance: agg?.redAttendance ?? d.redAttendance,
    };
  });

  if (!list.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {list.map((d) => {
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
              <span className="text-body-base dark:text-dark-5">
                ({d.total})
              </span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
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
            </span>
          </button>
        );
      })}
    </div>
  );
}

