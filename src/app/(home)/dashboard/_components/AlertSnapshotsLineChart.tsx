"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useEffect, useMemo, useState } from "react";
import type { AlertSnapshotTrendPoint } from "../fetch";
import { cn } from "@/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const DEFAULT_VISIBLE_DAYS = 10;
const SERIES_COLORS = ["#EAB308", "#DC2626", "#EAB308", "#DC2626"] as const;

function parseSnapshotDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function formatDayMonth(
  dateStr: string,
  opts?: { includeYear?: boolean }
): string {
  const d = parseSnapshotDate(dateStr);
  if (opts?.includeYear) {
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

type Props = {
  points: AlertSnapshotTrendPoint[];
};

export function AlertSnapshotsLineChart({ points }: Props) {
  const sortedAsc = useMemo(
    () =>
      [...points].sort((a, b) =>
        a.snapshotDate.localeCompare(b.snapshotDate)
      ),
    [points]
  );

  const bounds = useMemo(() => {
    if (!sortedAsc.length) {
      return { min: "", max: "" };
    }
    return {
      min: sortedAsc[0].snapshotDate,
      max: sortedAsc[sortedAsc.length - 1].snapshotDate,
    };
  }, [sortedAsc]);

  const defaultRange = useMemo(() => {
    if (!sortedAsc.length) {
      return { from: "", to: "" };
    }
    const to = sortedAsc[sortedAsc.length - 1].snapshotDate;
    if (sortedAsc.length <= DEFAULT_VISIBLE_DAYS) {
      return { from: sortedAsc[0].snapshotDate, to };
    }
    const from =
      sortedAsc[sortedAsc.length - DEFAULT_VISIBLE_DAYS].snapshotDate;
    return { from, to };
  }, [sortedAsc]);

  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");

  useEffect(() => {
    setRangeFrom(defaultRange.from);
    setRangeTo(defaultRange.to);
  }, [defaultRange.from, defaultRange.to]);

  const effectiveFrom = rangeFrom || defaultRange.from;
  const effectiveTo = rangeTo || defaultRange.to;

  const chartPoints = useMemo(() => {
    if (!effectiveFrom || !effectiveTo) return sortedAsc;
    const start =
      effectiveFrom <= effectiveTo ? effectiveFrom : effectiveTo;
    const end = effectiveFrom <= effectiveTo ? effectiveTo : effectiveFrom;
    return sortedAsc.filter(
      (p) => p.snapshotDate >= start && p.snapshotDate <= end
    );
  }, [sortedAsc, effectiveFrom, effectiveTo]);

  const showYearInLabels = useMemo(() => {
    const years = new Set(chartPoints.map((p) => p.snapshotDate.slice(0, 4)));
    return years.size > 1;
  }, [chartPoints]);

  const categories = useMemo(
    () =>
      chartPoints.map((p) =>
        formatDayMonth(p.snapshotDate, { includeYear: showYearInLabels })
      ),
    [chartPoints, showYearInLabels]
  );

  const hasCustomRangeSelection =
    effectiveFrom !== defaultRange.from || effectiveTo !== defaultRange.to;

  const latestStudentCount =
    chartPoints[chartPoints.length - 1]?.totalStudents ?? 0;

  const getLineStyle = (seriesIndex: number) =>
    seriesIndex < 2 ? "dashed" : "solid";
  const series = [
    {
      name: "Attendance (20% < CA)",
      data: chartPoints.map((p) => p.yellowAttendance),
    },
    { name: "Attendance(≤60%)", data: chartPoints.map((p) => p.redAttendance) },
    { name: "SGPA (1.0 Drop)", data: chartPoints.map((p) => p.yellowGpa) },
    { name: "SGPA (1.5 Drop)", data: chartPoints.map((p) => p.redGpa) },
  ];

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        fontFamily: "Satoshi, sans-serif",
        height: 160,
      },
      stroke: {
        curve: "smooth",
        width: 2,
        dashArray: [6, 6, 0, 0],
      },
      colors: [...SERIES_COLORS],
      xaxis: {
        categories,
        labels: {
          rotate: -45,
        },
      },
      yaxis: {
        labels: {
          formatter: (value) => Math.round(value).toLocaleString(),
        },
      },
      legend: {
        position: "top",
        horizontalAlign: "right",
        formatter: (seriesName, opts) => {
          const color = SERIES_COLORS[opts.seriesIndex] ?? "#6B7280";
          const lineStyle = getLineStyle(opts.seriesIndex);

          return `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;border-top:2px ${lineStyle} ${color};"></span>${seriesName}</span>`;
        },
        markers: {
          size: 0,
        },
      },
      grid: {
        strokeDashArray: 5,
      },
      dataLabels: {
        enabled: true,
      },
      tooltip: {
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex, w }) => {
          const rawDate =
            chartPoints[dataPointIndex]?.snapshotDate ??
            (w.globals.categoryLabels?.[dataPointIndex] as string) ??
            "";
          const dateLabel = rawDate
            ? formatDayMonth(rawDate, { includeYear: true })
            : ((w.globals.categoryLabels?.[dataPointIndex] as string) ??
              categories[dataPointIndex] ??
              "");
          const rows = w.globals.seriesNames
            .map((name: string, index: number) => {
              const color = SERIES_COLORS[index] ?? "#6B7280";
              const lineStyle = getLineStyle(index);
              const pointValue = w.globals.series?.[index]?.[dataPointIndex];
              const value =
                typeof pointValue === "number"
                  ? pointValue.toLocaleString()
                  : "-";

              return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:14px;border-top:2px ${lineStyle} ${color};"></span>
                <span>${name}</span>
              </span>
              <span style="font-weight:600;">${value}</span>
            </div>`;
            })
            .join("");

          return `<div style="padding:8px 10px;">
          <div style="font-weight:600;margin-bottom:4px;">${dateLabel}</div>
          ${rows}
        </div>`;
        },
      },
    }),
    [categories, chartPoints]
  );

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <p className="text-sm font-semibold text-dark dark:text-white">
          Alerts Trend ({latestStudentCount.toLocaleString()} Students)
        </p>
        {bounds.min && bounds.max ? (
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="flex flex-col gap-1 text-xs text-dark-5 dark:text-dark-6">
              <span>From</span>
              <input
                type="date"
                className={cn(
                  "rounded-md border border-stroke bg-transparent px-2 py-1.5 text-sm text-dark dark:border-dark-3 dark:text-white",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
                min={bounds.min}
                max={bounds.max}
                value={effectiveFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-dark-5 dark:text-dark-6">
              <span>To</span>
              <input
                type="date"
                className={cn(
                  "rounded-md border border-stroke bg-transparent px-2 py-1.5 text-sm text-dark dark:border-dark-3 dark:text-white",
                  "focus:outline-none focus:ring-2 focus:ring-primary"
                )}
                min={bounds.min}
                max={bounds.max}
                value={effectiveTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={cn(
                "rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark transition-colors dark:border-dark-3 dark:text-white",
                hasCustomRangeSelection
                  ? "hover:bg-gray-2 dark:hover:bg-dark-2"
                  : "cursor-not-allowed opacity-50"
              )}
              onClick={() => {
                setRangeFrom("");
                setRangeTo("");
              }}
              disabled={!hasCustomRangeSelection}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
      {chartPoints.length === 0 ? (
        <p className="py-8 text-center text-sm text-dark-5 dark:text-dark-6">
          No snapshot data in this date range.
        </p>
      ) : (
        <Chart
          key={`${effectiveFrom}-${effectiveTo}-${chartPoints.length}`}
          options={options}
          series={series}
          type="line"
          height={260}
        />
      )}
    </div>
  );
}
