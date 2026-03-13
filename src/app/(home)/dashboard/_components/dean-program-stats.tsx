"use client";

import { useMemo } from "react";
import type {
  ProgramStats,
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
  selectedProgramId?: string;
  masterFilterProgramIds?: string[];
  masterFilterDepartmentIds?: string[];
  /** Stats from enrollment or server; when empty, nothing is rendered. */
  stats?: ProgramStats[] | null;
  /** Filtered enrollment data used for alerts aggregation. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectProgramId?: (programId: string) => void;
};

export function DeanProgramStats({
  user,
  selectedProgramId,
  masterFilterProgramIds,
  masterFilterDepartmentIds,
  stats = null,
  enrollmentData = [],
  onSelectProgramId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const baseList = stats ?? [];
  if (!baseList.length) return null;

  const rows = enrollmentData ?? [];
  const { attendanceSummaries, classAverageByCourseSection } =
    useAttendanceAlerts(rows);

  const programAlertCounts = useMemo(() => {
    const map = new Map<
      string,
      { yellowAttendance: number; redAttendance: number }
    >();
    if (!rows.length || !attendanceSummaries) return map;

    for (const row of rows) {
      const programId = (row.DegreeCode ?? row.DeptCode ?? "").trim();
      if (!programId) continue;

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

      if (!map.has(programId)) {
        map.set(programId, { yellowAttendance: 0, redAttendance: 0 });
      }
      const bucket = map.get(programId)!;
      if (level === "warning") bucket.yellowAttendance += 1;
      if (level === "critical") bucket.redAttendance += 1;
    }

    return map;
  }, [rows, attendanceSummaries, classAverageByCourseSection]);

  const list = baseList.map((p) => {
    const agg = programAlertCounts.get(p.programId);
    return {
      ...p,
      yellowAttendance: agg?.yellowAttendance ?? p.yellowAttendance,
      redAttendance: agg?.redAttendance ?? p.redAttendance,
    };
  });

  if (!list.length) return null;

  const effectiveDepartmentIds = masterFilterDepartmentIds ?? [];

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((p) => {
        const isSelected =
          masterFilterProgramIds?.length
            ? masterFilterProgramIds.includes(p.programId)
            : selectedProgramId === p.programId;
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
                : "border-stroke",
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {p.programTitle ?? p.programId}{" "}
              <span className="text-body-base dark:text-dark-5">
                ({p.total})
              </span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
              Att:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  p.yellowAttendance > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {p.yellowAttendance}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  p.redAttendance > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {p.redAttendance}
              </span>
              {" · "}
              GPA:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  p.yellowGpa > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {p.yellowGpa}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  p.redGpa > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {p.redGpa}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

