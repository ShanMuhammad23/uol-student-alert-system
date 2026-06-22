"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { EiRating } from "@/lib/effectiveness-scoring";
import { FEI_GRADE_CONFIG } from "@/lib/fei-rating-styles";

export type FacultyEffectivenessChartItem = {
  facultyId: string;
  name: string;
  score: number;
  rating: EiRating;
  /** When false, bar is shown in neutral gray (no EI snapshot yet). */
  hasData?: boolean;
};

type PropsType = {
  title?: string;
  data?: FacultyEffectivenessChartItem[];
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const NO_DATA_COLOR = "#94A3B8";

function truncateLabel(name: string, max = 24): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function FacultyEffectivenessChart({
  title = "Faculty Effectiveness Index",
  data = [],
}: PropsType) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const titleColor = isDark ? "#E5E7EB" : "#111827";
  const axisLabelColor = isDark ? "#9CA3AF" : "#6B7280";
  const gridColor = isDark ? "#374151" : "#E5E7EB";

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.score - a.score),
    [data]
  );

  const categories = useMemo(
    () => sorted.map((item) => truncateLabel(item.name)),
    [sorted]
  );

  const colors = useMemo(
    () =>
      sorted.map((item) =>
        item.hasData === false
          ? NO_DATA_COLOR
          : FEI_GRADE_CONFIG[item.rating].color
      ),
    [sorted]
  );

  const seriesData = useMemo(() => sorted.map((item) => item.score), [sorted]);

  const chartHeight = Math.max(280, sorted.length * 34 + 56);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        fontFamily: "Satoshi, sans-serif",
        toolbar: { show: false },
      },
      ...(title
        ? {
            title: {
              text: title,
              style: {
                fontSize: "16px",
                fontWeight: "bold",
                color: titleColor,
              },
            },
          }
        : {}),
      colors,
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "70%",
          borderRadius: 4,
          distributed: true,
          dataLabels: {
            position: "top",
          },
        },
      },
      dataLabels: {
        enabled: true,
        offsetX: 6,
        formatter: (_val: number, opts) => {
          const item = sorted[opts.dataPointIndex];
          if (!item) return "";
          if (item.hasData === false) return "—";
          return `${Math.round(item.score)} · ${item.rating}`;
        },
        style: {
          fontSize: "11px",
          fontWeight: "bold",
          colors: [axisLabelColor],
        },
      },
      stroke: {
        show: true,
        width: 1,
        colors: ["transparent"],
      },
      // Horizontal bar: categories render on Y; numeric EI scale on X.
      xaxis: {
        categories,
        min: 0,
        max: 100,
        tickAmount: 5,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            fontSize: "11px",
            colors: axisLabelColor,
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            fontSize: "11px",
            colors: categories.map(() => axisLabelColor),
          },
        },
      },
      grid: {
        strokeDashArray: 7,
        borderColor: gridColor,
        xaxis: {
          lines: { show: true },
        },
        yaxis: {
          lines: { show: false },
        },
      },
      legend: { show: false },
      tooltip: {
        y: {
          formatter: (_val: number, opts) => {
            const item = sorted[opts.dataPointIndex];
            if (!item) return "";
            if (item.hasData === false) return "No EI data yet";
            return `EI ${Math.round(item.score)} (Grade ${item.rating})`;
          },
        },
      },
      annotations: {
        xaxis: [
          {
            x: 90,
            borderColor: FEI_GRADE_CONFIG.A.color,
            strokeDashArray: 4,
            opacity: 0.45,
          },
          {
            x: 75,
            borderColor: FEI_GRADE_CONFIG.B.color,
            strokeDashArray: 4,
            opacity: 0.45,
          },
          {
            x: 50,
            borderColor: FEI_GRADE_CONFIG.C.color,
            strokeDashArray: 4,
            opacity: 0.45,
          },
        ],
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            dataLabels: { enabled: false },
            yaxis: {
              labels: {
                style: { fontSize: "10px" },
              },
            },
          },
        },
      ],
    }),
    [sorted, categories, colors, title, titleColor, axisLabelColor, gridColor]
  );

  if (!sorted.length) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No faculty effectiveness data available yet.
      </p>
    );
  }

  return (
    <div className="w-full">
      <Chart
        options={options}
        series={[{ name: "EI", data: seriesData }]}
        type="bar"
        height={chartHeight}
      />
    </div>
  );
}
