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
  /** Which overview card is active (`attendance` or `gpa`), used for chart totals. */
  selectedAlert?: string;
  /** Used when selectedAlert === "gpa" and no slice is selected. */
  yellowGpa?: number;
  redGpa?: number;
  yellowAttendance?: number;
  redAttendance?: number;
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
  masterFilter: masterFilterProp,
  gpaFilters: gpaFiltersProp,
  attendanceFilters: attendanceFiltersProp,
  selectedAlert,
  yellowGpa = 0,
  redGpa = 0,
  yellowAttendance = 0,
  redAttendance = 0,
}: Props): JSX.Element {
  const debug =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_INTERVENTION_DEBUG === "true" ||
    process.env.NEXT_PUBLIC_INTERVENTION_DEBUG === "1";
  const dashboardFilter = useDashboardFilter();

  const setAttendanceFilters = dashboardFilter?.setAttendanceFilters;
  const setGpaFilters = dashboardFilter?.setGpaFilters;

  const selectedAlertMode = useMemo(() => {
    if (dashboardFilter?.gpaFilters?.length) return "gpa" as const;
    if (dashboardFilter?.attendanceFilters?.length) return "attendance" as const;
    return selectedAlert === "gpa" ? ("gpa" as const) : ("attendance" as const);
  }, [dashboardFilter?.gpaFilters, dashboardFilter?.attendanceFilters, selectedAlert]);

  const masterFilter =
    dashboardFilter?.masterFilter ?? masterFilterProp ?? {};
  const gpaFilters = dashboardFilter?.gpaFilters ?? gpaFiltersProp ?? [];
  const attendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFiltersProp ?? [];

  // Keys help prevent effects from re-firing due to array/object identity changes.
  const masterFilterKey = useMemo(() => JSON.stringify(masterFilter ?? {}), [masterFilter]);
  const gpaFiltersKey = useMemo(() => JSON.stringify(gpaFilters ?? []), [gpaFilters]);
  const attendanceFiltersKey = useMemo(
    () => JSON.stringify(attendanceFilters ?? []),
    [attendanceFilters]
  );

  const effectiveSlice: InterventionChartSlice | null = useMemo(() => {
    // Red has precedence over yellow if both are present.
    if (attendanceFilters.includes("red")) return "attendance_red";
    if (attendanceFilters.includes("yellow")) return "attendance_yellow";
    if (gpaFilters.includes("red")) return "gpa_red";
    if (gpaFilters.includes("yellow")) return "gpa_yellow";
    return null;
  }, [attendanceFilters, gpaFilters]);

  const [interventionCounts, setInterventionCounts] = useState<{
    initiated: number;
    inProgress: number;
    referred: number;
    resolved: number;
  }>({ initiated: 0, inProgress: 0, referred: 0, resolved: 0 });

  const [gpaCohortSapIds, setGpaCohortSapIds] = useState<string[] | null>(
    null
  );
  const [gpaCohortLoading, setGpaCohortLoading] = useState(false);

  useEffect(() => {
    if (
      effectiveSlice !== "gpa_yellow" &&
      effectiveSlice !== "gpa_red"
    ) {
      setGpaCohortSapIds(null);
      setGpaCohortLoading(false);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      const segment = effectiveSlice === "gpa_red" ? "red" : "yellow";
      setGpaCohortLoading(true);
      setGpaCohortSapIds(null);

      fetch("/api/dashboard/gpa-alert-sap-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment,
          masterFilter:
            masterFilter && Object.keys(masterFilter).length > 0
              ? masterFilter
              : undefined,
          gpaFilters: gpaFilters?.length ? gpaFilters : undefined,
          attendanceFilters: attendanceFilters?.length
            ? attendanceFilters
            : undefined,
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("gpa cohort");
          return res.json() as Promise<{ sapIds?: string[] }>;
        })
        .then((body) => {
          setGpaCohortSapIds(body.sapIds ?? []);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setGpaCohortSapIds([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setGpaCohortLoading(false);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [effectiveSlice, masterFilterKey, gpaFiltersKey, attendanceFiltersKey]);

  const interventionTypeForDb = useMemo<"attendance" | "gpa">(() => {
    if (
      effectiveSlice === "attendance_yellow" ||
      effectiveSlice === "attendance_red"
    ) {
      return "attendance";
    }
    if (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") {
      return "gpa";
    }
    return selectedAlertMode;
  }, [effectiveSlice, selectedAlertMode]);

  const totalAlerts = useMemo(() => {
    if (effectiveSlice === "attendance_yellow") return yellowAttendance;
    if (effectiveSlice === "attendance_red") return redAttendance;
    if (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") {
      return gpaCohortSapIds?.length ?? 0;
    }
    // No slice selected: use overview-card totals.
    if (selectedAlertMode === "gpa") return yellowGpa + redGpa;
    return yellowAttendance + redAttendance;
  }, [
    effectiveSlice,
    yellowAttendance,
    redAttendance,
    gpaCohortSapIds,
    selectedAlertMode,
    yellowGpa,
    redGpa,
  ]);

  const alertLevelForRequest = useMemo<"warning" | "critical" | null>(() => {
    if (effectiveSlice === "attendance_yellow" || effectiveSlice === "gpa_yellow") {
      return "warning";
    }
    if (effectiveSlice === "attendance_red" || effectiveSlice === "gpa_red") {
      return "critical";
    }
    return null;
  }, [effectiveSlice]);

  const clearSegmentFilters = () => {
    setAttendanceFilters?.([]);
    setGpaFilters?.([]);
  };

  const facultyIdForRequest =
    user?.role === "dean" ? user.faculty_id ?? null : null;
  const staffIdForRequest =
    user?.role === "teacher" ? user.id ?? null : null;
  const courseIdsForRequest =
    user?.role === "teacher" ? user.course_ids ?? null : null;
  const departmentIdsForRequest =
    user?.role === "hod" ? user.department_ids ?? null : null;

  const departmentIdsKey = useMemo(() => {
    if (user?.role !== "hod") return "";
    return (user?.department_ids ?? []).join(",");
  }, [user?.role, user?.department_ids]);
  const courseIdsKey = useMemo(() => {
    if (user?.role !== "teacher") return "";
    return (user?.course_ids ?? []).join(",");
  }, [user?.role, user?.course_ids]);

  useEffect(() => {
    if (!user?.role) return;

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      const roleScope =
        user.role === "teacher" ? "teacher" : (user.role as "dean" | "hod");

      fetch("/api/interventions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleScope,
          interventionType: interventionTypeForDb,
          alertLevel: alertLevelForRequest,
          facultyId: facultyIdForRequest,
          departmentIds: departmentIdsForRequest,
          courseIds: courseIdsForRequest,
          staffId: staffIdForRequest,
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load intervention counts");
          return res.json() as Promise<{
            initiated?: number;
            inProgress?: number;
            referred?: number;
            resolved?: number;
          }>;
        })
        .then((counts) => {
          setInterventionCounts({
            initiated: counts.initiated ?? 0,
            inProgress: counts.inProgress ?? 0,
            referred: counts.referred ?? 0,
            resolved: counts.resolved ?? 0,
          });
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setInterventionCounts({
            initiated: 0,
            inProgress: 0,
            referred: 0,
            resolved: 0,
          });
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [
    user?.role,
    facultyIdForRequest,
    departmentIdsKey,
    courseIdsKey,
    staffIdForRequest,
    interventionTypeForDb,
    alertLevelForRequest,
  ]);

  const { initiated, inProgress, referred, resolved, notStarted } = useMemo(() => {
    const totalInterventionStudents =
      interventionCounts.initiated +
      interventionCounts.inProgress +
      interventionCounts.referred +
      interventionCounts.resolved;
    return {
      initiated: interventionCounts.initiated,
      inProgress: interventionCounts.inProgress,
      referred: interventionCounts.referred,
      resolved: interventionCounts.resolved,
      notStarted: Math.max(0, totalAlerts - totalInterventionStudents),
    };
  }, [interventionCounts, totalAlerts]);

  const statusColors: Record<string, string> = {
    "Not Started": "#DE2649",
    Initiated: "#B5B126",
    "In-Progress": "#DBBE0F",
    Referred: "#9C5A99",
    Resolved: "#477061",
  };

  const data = [
    { x: "Not Started", y: notStarted },
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
          ) : null
          }
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
      {gpaCohortLoading &&
      (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") ? (
        <p className="px-2 py-8 text-center text-sm text-neutral-500">
          Loading cohort…
        </p>
      ) : (
        <InterventionStatusChart
          title={title}
          data={data}
          statusColors={statusColors}
        />
      )}
      {debug && (
        <div className="px-2 pt-2">
          <p className="text-[10px] text-neutral-500">
            Role: {user?.role ?? "—"}; Slice: {effectiveSlice ?? "—"}; Intervention type:{" "}
            {interventionTypeForDb}; alertLevel: {alertLevelForRequest ?? "—"}; Total alerts:{" "}
            {totalAlerts}
          </p>
          <p className="text-[10px] text-neutral-500">
            DB counts: initiated={initiated}, in-progress={inProgress}, referred=
            {referred}, resolved={resolved}, notStarted={notStarted}
          </p>
          <p className="text-[10px] text-neutral-500">
            Shared filters: attendance=[{attendanceFilters.join(",") || "—"}], gpa=[{gpaFilters.join(",") || "—"}]
          </p>
        </div>
      )}
    </div>
  );
}
