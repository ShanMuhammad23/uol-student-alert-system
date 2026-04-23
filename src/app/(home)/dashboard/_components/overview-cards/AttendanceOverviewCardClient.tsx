"use client";

import type { JSX } from "react";
import { cn } from "@/lib/utils";
import type {
  AlertDimensionFilter,
} from "../../fetch";
import { useDashboardFilter } from "../DashboardFilterContext";
import { DonutChart } from "@/components/Charts/used-devices/chart";
import Link from "next/link";
import { calculateMissingAttendance } from "@/lib/attendance-missing";

type PropsType = {
  /** Label is fixed to "Attendance" in the parent, but kept flexible here. */
  label: string;
  /** Link target for the card title (e.g. `?selected_alert=attendance`). */
  titleHref: string;
  isActive?: boolean;
  yellowCount: number;
  redCount: number;
  /** Resolved + no-action-required (latest intervention per student in cohort). */
  interventionClosedYellowCount: number;
  interventionClosedRedCount: number;
  totalStudents: number;
  totalAlertCasesYellow?: number;
  totalAlertCasesRed?: number;
  updatedAttendanceCount: number;
  totalHeldCount: number;
  attendanceMissingCount?: number;
  attendanceFilters?: AlertDimensionFilter[];
  yellowActive?: boolean;
  redActive?: boolean;
  onYellowClick?: () => void;
  onRedClick?: () => void;
};

export function AttendanceOverviewCardClient({
  label,
  titleHref,
  isActive,
  yellowCount,
  redCount,
  interventionClosedYellowCount,
  interventionClosedRedCount,
  totalStudents,
  totalAlertCasesYellow = 0,
  totalAlertCasesRed = 0,
  updatedAttendanceCount,
  totalHeldCount,
  attendanceMissingCount,
  attendanceFilters,
  yellowActive,
  redActive,
  onYellowClick,
  onRedClick,
}: PropsType): JSX.Element {
  const dashboardFilter = useDashboardFilter();

  const effectiveAttendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFilters;
  const hasGrowth = false;
  const normalizedAttendanceFilters = (effectiveAttendanceFilters ?? []).filter(
    (f) => f !== "all"
  );
  const allowed = new Set(normalizedAttendanceFilters);
  const visibleYellow =
    !allowed.size || allowed.has("yellow") ? yellowCount : 0;
  const visibleRed = !allowed.size || allowed.has("red") ? redCount : 0;
  const visibleInterventionClosedYellow =
    !allowed.size || allowed.has("yellow") ? interventionClosedYellowCount : 0;
  const visibleInterventionClosedRed =
    !allowed.size || allowed.has("red") ? interventionClosedRedCount : 0;
  const totalAlerts = visibleYellow + visibleRed;
  const visibleAlertCasesYellow =
    !allowed.size || allowed.has("yellow") ? totalAlertCasesYellow : 0;
  const visibleAlertCasesRed =
    !allowed.size || allowed.has("red") ? totalAlertCasesRed : 0;
  const totalAlertCases = visibleAlertCasesYellow + visibleAlertCasesRed;
  const yellowPercentage =
    totalStudents > 0 ? (visibleYellow / totalStudents) * 100 : 0;
  const redPercentage = totalStudents > 0 ? (visibleRed / totalStudents) * 100 : 0;
  const alertsPercentage =
    totalStudents > 0 ? (totalAlerts / totalStudents) * 100 : 0;
  const noAlertPercentage = Math.max(0, 100 - yellowPercentage - redPercentage);
  const computedAttendanceMissingCount = calculateMissingAttendance(
    totalHeldCount,
    updatedAttendanceCount
  );
  const resolvedAttendanceMissingCount =
    typeof attendanceMissingCount === "number"
      ? Math.max(0, attendanceMissingCount)
      : computedAttendanceMissingCount;
  const attendanceMissingPercentage =
    totalHeldCount !== 0
      ? (resolvedAttendanceMissingCount / totalHeldCount) * 100
      : 0;

  return (
    <div
      className={cn(
        "flex justify-between flex-col h-full flex-1 md:min-w-[240px]",
        isActive && "ring-0"
      )}
    >
      <div className="flex justify-between">
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
                  visibleYellow > 0
                    ? "text-yellow-400 dark:text-yellow-400 hover:bg-yellow-400/10 cursor-pointer"
                    : "text-gray-600 dark:text-gray-400 cursor-default",
                  yellowActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                )}
                aria-pressed={yellowActive}
                aria-label="Show intervention breakdown for yellow attendance alerts"
                disabled={visibleYellow === 0}
              >
                {visibleYellow}
               
                <span className="block text-base font-medium text-yellow-400 dark:text-yellow-400">
                  Closed: {visibleInterventionClosedYellow}
                </span>
                <span className="block text-xs font-medium text-yellow-500 dark:text-yellow-300">
                  Cases: {visibleAlertCasesYellow}
                </span>
              </button>
              <span className="text-dark-4 dark:text-dark-5" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={onRedClick}
                className={cn(
                  "rounded px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  visibleRed > 0
                    ? "text-red-600 dark:text-red-600 hover:bg-red-600/10 cursor-pointer"
                    : "text-grey-600 dark:text-white cursor-default",
                  redActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                )}
                aria-pressed={redActive}
                aria-label="Show intervention breakdown for red attendance alerts"
                disabled={visibleRed === 0}
              >
                {visibleRed}
                
                <span className="block text-base font-medium text-red-600 dark:text-red-600">
                  Closed: {visibleInterventionClosedRed}
                </span>
                <span className="block text-xs font-medium text-red-600 dark:text-red-400">
                  Cases: {visibleAlertCasesRed}
                </span>
              </button>
            </dt>
          </dl>
          {hasGrowth ? null : null}
        </div>
       
      </div>
      <div className="ml-4 flex items-center">
        <DonutChart
          data={[
            { name: "Yellow alert %", amount: yellowPercentage },
            { name: "Red alert %", amount: redPercentage },
            { name: "Good Standing %", amount: noAlertPercentage },
          ]}
          colors={["#FACC15", "#DC2626", "#22C55E"]}
          centerLabel=""
          centerValue={`${alertsPercentage.toFixed(1)}%`}
          size="sm"
        />
      </div>
      </div>
   
      <p className="mt-3 text-base  text-dark-6 dark:text-dark-5">
          <span className=" text-dark dark:text-white">
            Attendance Missing: {resolvedAttendanceMissingCount} / {totalHeldCount.toLocaleString()} Classes (
            {totalHeldCount > 0
              ? `${attendanceMissingPercentage.toFixed(1)}%`
              : "0%"}
            )
          </span>
        </p>
    </div>
  );
}

