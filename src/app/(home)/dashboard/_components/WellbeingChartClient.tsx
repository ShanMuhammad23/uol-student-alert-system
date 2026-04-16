"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";
import type { FilterApiRoleScope } from "./master-filter";
import { useDashboardFilter } from "./DashboardFilterContext";

type Props = {
  title?: string;
  filterApiRoleScope?: FilterApiRoleScope | null;
};

export function WellbeingChartClient({
  title = "Wellbeing Resolution",
  filterApiRoleScope,
}: Props) {
  const dashboardFilter = useDashboardFilter();
  const masterFilter = dashboardFilter?.masterFilter ?? {};
  const gpaFilters = dashboardFilter?.gpaFilters ?? [];
  const attendanceFilters = dashboardFilter?.attendanceFilters ?? [];

  const [data, setData] = useState<StatusStackedChartData>({
    open: [12, 8, 15, 6, 2],
    closed: [5, 10, 4, 9, 1],
  });
  const [isLoading, setIsLoading] = useState(false);

  const masterFilterKey = useMemo(
    () => JSON.stringify(masterFilter ?? {}),
    [masterFilter]
  );
  const gpaFiltersKey = useMemo(() => JSON.stringify(gpaFilters ?? []), [gpaFilters]);
  const attendanceFiltersKey = useMemo(
    () => JSON.stringify(attendanceFilters ?? []),
    [attendanceFilters]
  );
  const roleScopeDepartmentIdsKey = useMemo(
    () => filterApiRoleScope?.departmentIds?.join(",") ?? "",
    [filterApiRoleScope?.departmentIds]
  );

  useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setIsLoading(true);
      fetch("/api/dashboard/wellbeing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterFilter:
            masterFilter && Object.keys(masterFilter).length > 0
              ? masterFilter
              : undefined,
          gpaFilters: gpaFilters.length ? gpaFilters : undefined,
          attendanceFilters: attendanceFilters.length ? attendanceFilters : undefined,
          ...(filterApiRoleScope ? { roleScope: filterApiRoleScope } : {}),
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load wellbeing chart");
          return (await res.json()) as StatusStackedChartData;
        })
        .then((chartData) => {
          const safeOpen = Array.isArray(chartData?.open) ? chartData.open : [];
          const safeClosed = Array.isArray(chartData?.closed) ? chartData.closed : [];
          setData({ open: safeOpen, closed: safeClosed });
        })
        .catch((err: unknown) => {
          if (
            typeof err === "object" &&
            err != null &&
            "name" in err &&
            (err as { name?: string }).name === "AbortError"
          ) {
            return;
          }
          setData({ open: [0, 0, 0, 0, 0], closed: [0, 0, 0, 0, 0] });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [
    masterFilterKey,
    gpaFiltersKey,
    attendanceFiltersKey,
    filterApiRoleScope?.role,
    filterApiRoleScope?.facultyId,
    roleScopeDepartmentIdsKey,
    filterApiRoleScope?.pernr,
  ]);

  return (
    <>
      {isLoading ? (
        <p className="px-2 py-8 text-center text-sm text-neutral-500">
          Loading wellbeing data...
        </p>
      ) : (
        <StatusStackedChart
          title={title}
          data={data}
        />
      )}
    </>
  );
}

