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
import Link from "next/link";

type PropsType = {
  /** Label is fixed to "Attendance" in the parent, but kept flexible here. */
  label: string;
  /** Link target for the card title (e.g. `?selected_alert=attendance`). */
  titleHref: string;
  isActive?: boolean;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[]; // unused but kept for API symmetry
  attendanceFilters?: AlertDimensionFilter[]; // currently unused
  yellowActive?: boolean;
  redActive?: boolean;
  onYellowClick?: () => void;
  onRedClick?: () => void;
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
  titleHref,
  isActive,
  user,
  masterFilter,
  attendanceFilters,
  yellowActive,
  redActive,
  onYellowClick,
  onRedClick,
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
        "flex justify-between h-full flex-1 md:min-w-[240px]",
        isActive && "ring-0"
      )}
    >
      <div>
        <Link
          href={titleHref}
          scroll={false}
          className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <dd className="text-xl font-bold text-dark dark:text-white hover:underline">
            {label}
          </dd>
        </Link>

        <div className="mt-6 flex items-end justify-between">
          <dl>
            <dt className="mb-1.5 flex items-center gap-4 text-heading-4 font-bold">
              <button
                type="button"
                onClick={onYellowClick}
                className={cn(
                  "rounded px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  yellowCount > 0
                    ? "text-yellow-400 dark:text-yellow-400 hover:bg-yellow-400/10 cursor-pointer"
                    : "text-gray-600 dark:text-gray-400 cursor-default",
                  yellowActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                )}
                aria-pressed={yellowActive}
                aria-label="Show intervention breakdown for yellow attendance alerts"
                disabled={yellowCount === 0 || isAttendanceLoading}
              >
                {isAttendanceLoading ? "…" : yellowCount}
              </button>
              <span className="text-dark-4 dark:text-dark-5" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={onRedClick}
                className={cn(
                  "rounded px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  redCount > 0
                    ? "text-red-600 dark:text-red-600 hover:bg-red-600/10 cursor-pointer"
                    : "text-grey-600 dark:text-white cursor-default",
                  redActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                )}
                aria-pressed={redActive}
                aria-label="Show intervention breakdown for red attendance alerts"
                disabled={redCount === 0 || isAttendanceLoading}
              >
                {isAttendanceLoading ? "…" : redCount}
              </button>
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

