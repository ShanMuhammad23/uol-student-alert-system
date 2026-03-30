"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { AlertSnapshotTrendPoint } from "../fetch";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type Props = {
  points: AlertSnapshotTrendPoint[];
};

export function AlertSnapshotsLineChart({ points }: Props) {
  const chartPoints = points;
  const latestStudentCount =
    chartPoints[chartPoints.length - 1]?.totalStudents ?? 0;
  const categories = chartPoints.map((p) => p.snapshotDate);
  const seriesColors = ["#EAB308", "#DC2626", "#EAB308", "#DC2626"];
  const getLineStyle = (seriesIndex: number) =>
    seriesIndex < 2 ? "dashed" : "solid";
  const series = [
    { name: "GPA Yellow", data: chartPoints.map((p) => p.yellowGpa) },
    { name: "GPA Red", data: chartPoints.map((p) => p.redGpa) },
    {
      name: "Attendance Yellow",
      data: chartPoints.map((p) => p.yellowAttendance),
    },
    { name: "Attendance Red", data: chartPoints.map((p) => p.redAttendance) },
  ];

  const options: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      fontFamily: "Satoshi, sans-serif",
      height: 320,
    },
    stroke: {
      curve: "smooth",
      width: 2,
      dashArray: [6, 6, 0, 0],
    },
    colors: seriesColors,
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
        const color = seriesColors[opts.seriesIndex] ?? "#6B7280";
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
        const dateLabel =
          (w.globals.categoryLabels?.[dataPointIndex] as string) ??
          categories[dataPointIndex] ??
          "";
        const rows = w.globals.seriesNames
          .map((name: string, index: number) => {
            const color = seriesColors[index] ?? "#6B7280";
            const lineStyle = getLineStyle(index);
            const pointValue = w.globals.series?.[index]?.[dataPointIndex];
            const value =
              typeof pointValue === "number" ? pointValue.toLocaleString() : "-";

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
  };

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <p className="mb-4 text-sm font-semibold text-dark dark:text-white">
        {latestStudentCount.toLocaleString()} Students
      </p>
      <Chart options={options} series={series} type="line" height={320} />
    </div>
  );
}
