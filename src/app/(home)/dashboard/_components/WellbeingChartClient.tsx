"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";

import { useDashboardFilter } from "./DashboardFilterContext";
import type { AlertDimensionFilter } from "../fetch";

type Props = {
  title?: string;
};

export function WellbeingChartClient({ title = "Wellbeing Resolution" }: Props) {
  const dashboardFilter = useDashboardFilter();

  const masterFilter = dashboardFilter?.masterFilter;
  const gpaFilters = dashboardFilter?.gpaFilters ?? [];
  const attendanceFilters = dashboardFilter?.attendanceFilters ?? [];

  const filterKey = useMemo(() => {
    // Stable key for debounced fetching.
    return JSON.stringify({
      masterFilter,
      gpaFilters,
      attendanceFilters,
    });
  }, [masterFilter, gpaFilters, attendanceFilters]);

  const [data, setData] = useState<StatusStackedChartData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setIsLoading(true);
      fetch("/api/dashboard/wellbeing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterFilter,
          gpaFilters,
          attendanceFilters,
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load wellbeing chart");
          return res.json() as Promise<StatusStackedChartData>;
        })
        .then((d) => setData(d))
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setData(undefined);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [filterKey]);

  if (isLoading && !data) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-neutral-500">Loading wellbeing…</p>
      </div>
    );
  }

  return (
    <StatusStackedChart
      title={title}
      data={data ?? { open: [], closed: [] }}
    />
  );
}

