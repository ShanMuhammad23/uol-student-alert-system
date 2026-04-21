"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = {
  categories: string[];
  sgpa: number[];
  cgpa: number[];
  title?: string;
};

export function SgpaCgpaMixedChart({
  categories,
  sgpa,
  cgpa,
  title = "SGPA & CGPA Trend",
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const titleColor = isDark ? "#E5E7EB" : "#111827";
  const axisLabelColor = isDark ? "#9CA3AF" : "#6B7280";
  const safeCategories = categories.length ? categories : ["No data"];
  const safeSgpa = safeCategories.map((_, idx) => Number(sgpa[idx] ?? 0));
  const safeCgpa = safeCategories.map((_, idx) => Number(cgpa[idx] ?? 0));

  const options: ApexOptions = {
    chart: {
      type: "line",
      fontFamily: "Satoshi, sans-serif",
      toolbar: { show: false },
    },
    title: {
      text: title,
      style: {
        fontSize: "16px",
        fontWeight: "bold",
        color: titleColor,
      },
    },
    stroke: {
      width: [0, 3],
      curve: "smooth",
    },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [0, 1],
      formatter: (value: number) => String(value),
      // Keep line labels visually above points.
      offsetY: -10,
    },
    labels: safeCategories,
    xaxis: {
      labels: {
        rotate: -30,
        trim: true,
        style: {
          fontSize: "11px",
          colors: safeCategories.map(() => axisLabelColor),
        },
      },
    },
    yaxis: {
      min: 0,
      max: 4,
      tickAmount: 4,
      title: { text: "GPA" },
      labels: {
        formatter: (value) => String(value),
      },
    },
    colors: ["#3B82F6", "#22C55E"],
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "45%",
        dataLabels: {
          // Keep SGPA labels centered inside each column.
          position: "center",
        },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
    grid: {
      strokeDashArray: 6,
      yaxis: { lines: { show: true } },
    },
  };

  const series = [
    { name: "SGPA", type: "column" as const, data: safeSgpa },
    { name: "CGPA", type: "line" as const, data: safeCgpa },
  ];

  return <Chart options={options} series={series} type="line" height={260} />;
}
