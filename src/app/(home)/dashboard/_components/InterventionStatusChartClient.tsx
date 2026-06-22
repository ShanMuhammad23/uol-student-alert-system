"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import type { FilterDropdownCounts } from "@/lib/db/student-listing";
import type {
  AppUser,
  MasterFilterParams,
  AlertDimensionFilter,
} from "../fetch";
import { useDashboardFilter } from "./DashboardFilterContext";
import type { InterventionChartSlice } from "./InterventionSliceContext";
import type { FilterApiRoleScope } from "./master-filter";

type Props = {
  title: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  /** Which overview card is active (`attendance` or `gpa`), used for chart totals. */
  selectedAlert?: string;
  yellowGpa?: number;
  redGpa?: number;
  yellowAttendance?: number;
  redAttendance?: number;
  filterApiRoleScope?: FilterApiRoleScope | null;
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

function normalizeDimFiltersForApi(
  filters: AlertDimensionFilter[] | undefined
): AlertDimensionFilter[] | undefined {
  if (!filters?.length) return undefined;
  if (filters.includes("all")) return undefined;
  return filters;
}

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
  filterApiRoleScope,
}: Props): JSX.Element {
  const dashboardFilter = useDashboardFilter();

  const setAttendanceFilters = dashboardFilter?.setAttendanceFilters;
  const setGpaFilters = dashboardFilter?.setGpaFilters;
  const setInterventionFilters = dashboardFilter?.setInterventionFilters;

  const masterFilter =
    dashboardFilter?.masterFilter ?? masterFilterProp ?? {};
  const gpaFilters = dashboardFilter?.gpaFilters ?? gpaFiltersProp ?? [];
  const attendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFiltersProp ?? [];

  const masterFilterKey = useMemo(() => JSON.stringify(masterFilter ?? {}), [masterFilter]);
  const gpaFiltersKey = useMemo(() => JSON.stringify(gpaFilters ?? []), [gpaFilters]);
  const attendanceFiltersKey = useMemo(
    () => JSON.stringify(attendanceFilters ?? []),
    [attendanceFilters]
  );

  const effectiveSlice: InterventionChartSlice | null = useMemo(() => {
    if (attendanceFilters.includes("red")) return "attendance_red";
    if (attendanceFilters.includes("yellow")) return "attendance_yellow";
    if (gpaFilters.includes("red")) return "gpa_red";
    if (gpaFilters.includes("yellow")) return "gpa_yellow";
    return null;
  }, [attendanceFilters, gpaFilters]);

  const [interventionCounts, setInterventionCounts] =
    useState<InterventionCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.role) return;

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      const filters = {
        department_ids: masterFilter.department_ids,
        programs: masterFilter.programs,
        instructor_ids: masterFilter.instructor_ids,
        course_ids: masterFilter.course_ids,
        batches: masterFilter.batches,
        selected_alert:
          selectedAlert && selectedAlert !== "all" ? selectedAlert : undefined,
        attendanceFilters: normalizeDimFiltersForApi(attendanceFilters),
        gpaFilters: normalizeDimFiltersForApi(gpaFilters),
      };

      fetch("/api/dashboard/filter-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          filters,
          ...(filterApiRoleScope ? { roleScope: filterApiRoleScope } : {}),
        }),
      })
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("counts"))
        )
        .then((body: FilterDropdownCounts) => {
          const c = body.intervention;
          setInterventionCounts({
            notStarted: c.not_started ?? 0,
            initiated: c.initiated ?? 0,
            inProgress: c.in_progress ?? 0,
            referred: c.referred ?? 0,
            resolved: c.resolved ?? 0,
            noActionRequired: c.no_action_required ?? 0,
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
    masterFilterKey,
    gpaFiltersKey,
    attendanceFiltersKey,
    selectedAlert,
    filterApiRoleScope?.role,
    filterApiRoleScope?.facultyId,
    filterApiRoleScope?.departmentIds?.join(","),
    filterApiRoleScope?.pernr,
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
