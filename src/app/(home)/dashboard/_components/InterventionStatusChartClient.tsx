"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import type {
  AppUser,
  MasterFilterParams,
  AlertDimensionFilter,
} from "../fetch";
import { useDashboardFilter } from "./DashboardFilterContext";
import type { InterventionChartSlice } from "./InterventionSliceContext";

type Props = {
  title: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  selectedAlert?: string;
  yellowGpa?: number;
  redGpa?: number;
  yellowAttendance?: number;
  redAttendance?: number;
};

type InterventionCounts = {
  notStarted: number;
  initiated: number;
  inProgress: number;
  referred: number;
  resolved: number;
  noActionRequired: number;
};

const EMPTY_COUNTS: InterventionCounts = {
  notStarted: 0,
  initiated: 0,
  inProgress: 0,
  referred: 0,
  resolved: 0,
  noActionRequired: 0,
};

function sliceDescription(slice: InterventionChartSlice | null): string | null {
  if (!slice) return null;
  const map: Record<InterventionChartSlice, string> = {
    attendance_yellow: "Yellow attendance alerts",
    attendance_red: "Red attendance alerts",
    gpa_yellow: "Yellow GPA alerts",
    gpa_red: "Red GPA alerts",
  };
  return map[slice];
}

export function InterventionStatusChartClient({
  title,
  user,
  gpaFilters: gpaFiltersProp,
  attendanceFilters: attendanceFiltersProp,
  selectedAlert,
  yellowGpa = 0,
  redGpa = 0,
  yellowAttendance = 0,
  redAttendance = 0,
}: Props): JSX.Element {
  type ChartMode = "attendance" | "gpa" | "all";
  const dashboardFilter = useDashboardFilter();

  const setAttendanceFilters = dashboardFilter?.setAttendanceFilters;
  const setGpaFilters = dashboardFilter?.setGpaFilters;
  const setInterventionFilters = dashboardFilter?.setInterventionFilters;

  const chartMode = useMemo<ChartMode>(() => {
    if (dashboardFilter?.gpaFilters?.length) return "gpa";
    if (dashboardFilter?.attendanceFilters?.length) return "attendance";
    if (selectedAlert === "gpa") return "gpa";
    if (selectedAlert === "attendance") return "attendance";
    return "all";
  }, [dashboardFilter?.gpaFilters, dashboardFilter?.attendanceFilters, selectedAlert]);

  const gpaFilters = dashboardFilter?.gpaFilters ?? gpaFiltersProp ?? [];
  const attendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFiltersProp ?? [];

  const effectiveSlice: InterventionChartSlice | null = useMemo(() => {
    if (attendanceFilters.includes("red")) return "attendance_red";
    if (attendanceFilters.includes("yellow")) return "attendance_yellow";
    if (gpaFilters.includes("red")) return "gpa_red";
    if (gpaFilters.includes("yellow")) return "gpa_yellow";
    return null;
  }, [attendanceFilters, gpaFilters]);

  const totalAlerts = useMemo(() => {
    if (effectiveSlice === "attendance_yellow") return yellowAttendance;
    if (effectiveSlice === "attendance_red") return redAttendance;
    if (effectiveSlice === "gpa_yellow") return yellowGpa;
    if (effectiveSlice === "gpa_red") return redGpa;
    if (chartMode === "gpa") return yellowGpa + redGpa;
    if (chartMode === "attendance") return yellowAttendance + redAttendance;
    return yellowAttendance + redAttendance + yellowGpa + redGpa;
  }, [
    effectiveSlice,
    yellowAttendance,
    redAttendance,
    chartMode,
    yellowGpa,
    redGpa,
  ]);

  const interventionType = useMemo<"attendance" | "gpa" | "all">(() => {
    if (
      effectiveSlice === "attendance_yellow" ||
      effectiveSlice === "attendance_red"
    ) {
      return "attendance";
    }
    if (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") {
      return "gpa";
    }
    if (chartMode === "gpa") return "gpa";
    if (chartMode === "attendance") return "attendance";
    return "all";
  }, [effectiveSlice, chartMode]);

  const alertLevel = useMemo<"warning" | "critical" | null>(() => {
    if (effectiveSlice === "attendance_yellow" || effectiveSlice === "gpa_yellow") {
      return "warning";
    }
    if (effectiveSlice === "attendance_red" || effectiveSlice === "gpa_red") {
      return "critical";
    }
    return null;
  }, [effectiveSlice]);

  const facultyId = user?.role === "dean" ? user.faculty_id ?? null : null;
  const departmentIds =
    user?.role === "hod" ? user.department_ids ?? null : null;
  const staffId =
    user?.role === "teacher" || user?.role === "instructor"
      ? user.id ?? null
      : null;
  const courseIds =
    user?.role === "teacher" || user?.role === "instructor"
      ? user.course_ids ?? null
      : null;

  const [interventionCounts, setInterventionCounts] =
    useState<InterventionCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.role) return;

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);

      const role =
        user.role === "teacher" || user.role === "instructor"
          ? "teacher"
          : user.role === "superadmin"
            ? "superadmin"
            : (user.role as "dean" | "hod");

      fetch("/api/interventions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          role,
          interventionType,
          alertLevel,
          countRecords: true,
          facultyId,
          departmentIds,
          courseIds,
          staffId,
        }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load intervention counts");
          return (await res.json()) as {
            initiated?: number;
            inProgress?: number;
            referred?: number;
            resolved?: number;
            noActionRequired?: number;
            totalInterventionStudents?: number;
          };
        })
        .then((counts) => {
          const totalRecords =
            counts.totalInterventionStudents ??
            (counts.initiated ?? 0) +
              (counts.inProgress ?? 0) +
              (counts.referred ?? 0) +
              (counts.resolved ?? 0) +
              (counts.noActionRequired ?? 0);

          setInterventionCounts({
            notStarted: Math.max(0, totalAlerts - totalRecords),
            initiated: counts.initiated ?? 0,
            inProgress: counts.inProgress ?? 0,
            referred: counts.referred ?? 0,
            resolved: counts.resolved ?? 0,
            noActionRequired: counts.noActionRequired ?? 0,
          });
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setInterventionCounts(EMPTY_COUNTS);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [
    user?.role,
    user?.faculty_id,
    user?.id,
    facultyId,
    departmentIds?.join(","),
    courseIds?.join(","),
    interventionType,
    alertLevel,
    totalAlerts,
  ]);

  const clearSegmentFilters = () => {
    setAttendanceFilters?.([]);
    setGpaFilters?.([]);
    setInterventionFilters?.([]);
  };

  const statusToFilterValue = (status: string): string | null => {
    if (status === "Not Started") return "not_started";
    if (status === "Not Required") return "no_action_required";
    if (status === "Initiated") return "initiated";
    if (status === "In-Progress") return "in_progress";
    if (status === "Resolved") return "resolved";
    if (status === "Referred") return "referred";
    return null;
  };

  const handleStatusColumnClick = (status: string) => {
    const filterValue = statusToFilterValue(status);
    if (!filterValue) return;
    setInterventionFilters?.([filterValue]);
  };

  const { initiated, inProgress, referred, resolved, noActionRequired, notStarted } =
    interventionCounts;

  const statusColors: Record<string, string> = {
    "Not Started": "#DE2649",
    "Not Required": "#64748B",
    Initiated: "#B5B126",
    "In-Progress": "#DBBE0F",
    Referred: "#9C5A99",
    Resolved: "#477061",
  };

  const data = [
    { x: "Not Started", y: notStarted },
    { x: "Not Required", y: noActionRequired },
    { x: "Initiated", y: initiated },
    { x: "In-Progress", y: inProgress },
    { x: "Resolved", y: resolved },
    { x: "Referred", y: referred },
  ];

  const subtitle = sliceDescription(effectiveSlice);

  return (
    <div className="px-2 pb-2">
      <div className="flex flex-wrap items-start justify-between gap-2 px-2">
        <div className="min-w-0 flex-1">
          {subtitle ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {effectiveSlice != null && (
          <button
            type="button"
            onClick={clearSegmentFilters}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      {loading ? (
        <p className="px-2 py-8 text-center text-sm text-neutral-500">
          Loading cohort…
        </p>
      ) : (
        <InterventionStatusChart
          title={title}
          data={data}
          statusColors={statusColors}
          onStatusClick={handleStatusColumnClick}
        />
      )}
    </div>
  );
}
