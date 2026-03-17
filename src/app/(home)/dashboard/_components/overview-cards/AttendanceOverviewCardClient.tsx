"use client";

import { useMemo } from "react";
import type { JSX } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import { useEnrollmentData } from "@/hooks/useEnrollmentData";
import {
  filterEnrollmentByMasterFilter,
  type MasterFilterParams as EnrollmentMasterFilterParams,
} from "@/lib/enrollment";
import {
  getAttendanceAlertLevel,
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import type {
  AppUser,
  MasterFilterParams,
  AlertDimensionFilter,
} from "../../fetch";
import { useDashboardFilter } from "../DashboardFilterContext";
import { DonutChart } from "@/components/Charts/used-devices/chart";

type PropsType = {
  /** Label is fixed to "Attendance" in the parent, but kept flexible here. */
  label: string;
  isActive?: boolean;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[]; // unused but kept for API symmetry
  attendanceFilters?: AlertDimensionFilter[]; // currently unused
};

function deduplicateEnrollments(
  data: import("@/lib/enrollment").EnrollmentRecord[],
) {
  const seen = new Set<string>();
  return data.filter((record) => {
    const id =
      record.Id ?? `${record.SapNo}-${record.CrCode}-${record.Section}`;
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function AttendanceOverviewCardClient({
  label,
  isActive,
  user,
  masterFilter,
  attendanceFilters,
}: PropsType): JSX.Element {
  const { data: enrollmentData } = useEnrollmentData();
  const dashboardFilter = useDashboardFilter();

  const effectiveMasterFilter = dashboardFilter?.masterFilter ?? masterFilter;
  const effectiveAttendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFilters;

  const matchesAttendanceFilters = (
    level: "critical" | "warning" | null,
  ): boolean => {
    if (!effectiveAttendanceFilters?.length) return true;
    const allowed = new Set<string | null>();
    for (const f of effectiveAttendanceFilters) {
      if (f === "red") allowed.add("critical");
      else if (f === "yellow") allowed.add("warning");
      else if (f === "good") allowed.add(null);
    }
    return allowed.has(level);
  };

  const scopedEnrollmentData = useMemo(() => {
    if (!enrollmentData?.length || !user?.role) return enrollmentData ?? [];
    let list = enrollmentData;
    const anyUser = user as any;

    if (user.role === "dean" && user.faculty_id) {
      list = list.filter((r) => r.FacId === user.faculty_id);
    } else if (
      user.role === "hod" &&
      Array.isArray(anyUser.department_ids) &&
      anyUser.department_ids.length
    ) {
      const deptSet = new Set<string>(anyUser.department_ids);
      list = list.filter(
        (r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId)
      );
    } else if (user.role === "teacher" && anyUser.sap_id) {
      const pernr = String(anyUser.sap_id).trim();
      list = list.filter((r) => (r.Pernr ?? "").trim() === pernr);
    }

    return list;
  }, [enrollmentData, user]);

  const filteredEnrollments = useMemo(() => {
    if (!scopedEnrollmentData?.length || !user?.role) return scopedEnrollmentData ?? [];
    // When no masterFilter is provided, use an empty object to satisfy type expectations.
    const mf: EnrollmentMasterFilterParams =
      effectiveMasterFilter && Object.keys(effectiveMasterFilter).length > 0
        ? {
            department_ids: effectiveMasterFilter.department_ids,
            programs: effectiveMasterFilter.programs,
            instructor_ids: effectiveMasterFilter.instructor_ids,
            course_ids: effectiveMasterFilter.course_ids,
          }
        : {};
    const result = filterEnrollmentByMasterFilter(
      scopedEnrollmentData,
      mf,
      user.role === "dean" ? user.faculty_id ?? undefined : undefined,
    );
    return deduplicateEnrollments(result);
  }, [scopedEnrollmentData, effectiveMasterFilter, user]);
  const {
    attendanceSummaries,
    classAverageByCourseSection,
    monitoredByCourseSection,
    isAttendanceLoading,
  } = useAttendanceAlerts(filteredEnrollments ?? []);

  const { yellowCount, redCount } = useMemo(() => {
    let yellow = 0;
    let red = 0;
    if (!attendanceSummaries) return { yellowCount: 0, redCount: 0 };

    for (const row of filteredEnrollments ?? []) {
      const sectionKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? "")
      )}__${row.Section ?? ""}`;
      const attKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attKey);
      if (!summary) continue;
      const classAvg = classAverageByCourseSection.get(sectionKey);
      if (classAvg == null) continue;
      const level = getAttendanceAlertLevel(summary.percentage, classAvg);
      if (!matchesAttendanceFilters(level)) continue;
      if (level === "critical") red += 1;
      else if (level === "warning") yellow += 1;
    }

    return { yellowCount: yellow, redCount: red };
  }, [attendanceSummaries, filteredEnrollments, classAverageByCourseSection]);

  const hasGrowth = false;
  const isDecreasing = false;

  const totalStudents = (filteredEnrollments ?? []).length;
  const totalAlerts = yellowCount + redCount;
  const alertsPercentage =
    totalStudents > 0 ? (totalAlerts / totalStudents) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-[10px] bg-white dark:bg-gray-dark p-4 shadow-xl transition-shadow  md:min-w-[240px] flex-1 flex justify-between h-full border border-gray-200",
        isActive && "ring-2 ring-primary shadow-md"
      )}
    >
      <div>
        <dd className="text-xl font-bold text-dark dark:text-white">{label}</dd>

        <div className="mt-6 flex items-end justify-between">
          <dl>
            <dt className="mb-1.5 flex items-center gap-4 text-heading-4 font-bold">
              <span
                className={cn(
                  "text-yellow-400 dark:text-yellow-400",
                  yellowCount > 0
                    ? "text-yellow-400 dark:text-yellow-400"
                    : "text-gray-600 dark:text-gray-400"
                )}
              >
                {isAttendanceLoading ? "…" : yellowCount}
              </span>
              <span className="text-dark-4 dark:text-dark-5" aria-hidden>
                |
              </span>
              <span
                className={cn(
                  "text-red-600 dark:text-red-600",
                  redCount > 0
                    ? "text-red-600 dark:text-red-600"
                    : "text-grey-600 dark:text-white"
                )}
              >
                {isAttendanceLoading ? "…" : redCount}
              </span>
            </dt>
          </dl>
          {hasGrowth && (
            <dl
              className={cn(
                "text-sm font-medium",
                isDecreasing ? "text-red" : "text-green"
              )}
            >
              <dt className="flex items-center gap-1.5">
                0%
                {isDecreasing ? (
                  <ArrowDownIcon aria-hidden />
                ) : (
                  <ArrowUpIcon aria-hidden />
                )}
              </dt>
            </dl>
          )}
        </div>
      </div>
      <div className="ml-4 flex items-center">
        <DonutChart
          data={[
            { name: "Yellow alert", amount: yellowCount },
            { name: "Red alert", amount: redCount },
            {
              name: "No alert",
              amount: Math.max(0, totalStudents - totalAlerts),
            },
          ]}
          colors={["#FACC15", "#DC2626", "#22C55E"]}
          centerLabel=""
          centerValue={`${alertsPercentage.toFixed(1)}%`}
          size="sm"
        />
      </div>
    </div>
  );
}

