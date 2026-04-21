"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type WellbeingHeadStackedChartProps = {
  title: string;
  xAxis: string[];
  open: number[];
  closed: number[];
  height?: number;
};

function padSeries(values: number[], len: number): number[] {
  const out = [...values].slice(0, len);
  while (out.length < len) out.push(0);
  return out;
}

export function WellbeingHeadStackedChart({
  title,
  xAxis,
  open,
  closed,
  height = 280,
}: WellbeingHeadStackedChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const titleColor = isDark ? "#E5E7EB" : "#111827";
  const axisLabelColor = isDark ? "#9CA3AF" : "#6B7280";
  const axis = xAxis.length ? xAxis : ["No data"];
  const safeOpen = padSeries(open, axis.length);
  const safeClosed = padSeries(closed, axis.length);
  const rotate = useMemo(() => (axis.length > 6 ? -45 : -25), [axis.length]);

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      fontFamily: "Satoshi, sans-serif",
      toolbar: { show: false },
    },
    title: {
      text: title,
      style: {
        fontSize: "15px",
        fontWeight: "bold",
        color: titleColor,
      },
    },
    colors: ["#ef4444", "#22c55e"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "58%",
        borderRadius: 4,
        dataLabels: {
          position: "center",
          hideOverflowingLabels: true,
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => (val > 0 ? String(val) : ""),
      style: {
        fontSize: "11px",
        fontWeight: "bold",
        colors: ["#FFFFFF", "#FFFFFF"],
      },
    },
    xaxis: {
      categories: axis,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        rotate,
        trim: true,
        style: {
          fontSize: "11px",
          colors: axis.map(() => axisLabelColor),
        },
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
    },
    grid: {
      strokeDashArray: 6,
      yaxis: { lines: { show: true } },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          dataLabels: { enabled: false },
          xaxis: { labels: { rotate: -45, style: { fontSize: "10px" } } },
        },
      },
    ],
  };

  const series = [
    { name: "Open", data: safeOpen },
    { name: "Closed", data: safeClosed },
  ];

  return <Chart options={options} series={series} type="bar" height={height} />;
}
