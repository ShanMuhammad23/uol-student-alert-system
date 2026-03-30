"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const CATEGORIES = [
  "Counselling",
  "Monitoring",
  "Flex (Acad)",
  "Flex (Fin)",
] as const;

export type StatusStackedChartData = {
  open: number[];
  closed: number[];
};

type PropsType = {
  title?: string;
  data?: StatusStackedChartData;
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const OPEN_COLOR = "#ef4444";
const CLOSED_COLOR = "#22c55e";

const defaultData: StatusStackedChartData = {
  open: [12, 8, 15, 6],
  closed: [5, 10, 4, 9],
};

export function StatusStackedChart({
  title = "Intervention Status by Type",
  data = defaultData,
}: PropsType) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const titleColor = isDark ? "#E5E7EB" : "#111827";
  const dataLabelColor = isDark ? "#F9FAFB" : "#111827";
  const axisLabelColor = isDark ? "#9CA3AF" : "#6B7280";

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      fontFamily: "Satoshi, sans-serif",
      height: 200,
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
    colors: [OPEN_COLOR, CLOSED_COLOR],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        borderRadius: 3,
        dataLabels: {
          position: "top",
          hideOverflowingLabels: false,
        },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: "12px",
        fontWeight: "bold",
        colors: [dataLabelColor],
      },
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: [...CATEGORIES],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        rotate: -30,
        trim: true,
        style: {
          fontSize: "11px",
          colors: [...CATEGORIES].map(() => axisLabelColor),
        },
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      fontFamily: "Satoshi",
      markers: {
    
        size: 8,
        
      },
    },
    grid: {
      strokeDashArray: 7,
      yaxis: {
        lines: { show: true },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: (val: number) => val.toString(),
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          dataLabels: {
            enabled: false,
          },
          xaxis: {
            labels: {
              rotate: -45,
              trim: true,
              style: {
                fontSize: "10px",
              },
            },
          },
        },
      },
    ],
  };

  const series = [
    { name: "Open", data: data.open },
    { name: "Closed", data: data.closed },
  ];

  return (
    <div className="w-full">
      <Chart
        options={options}
        series={series}
        type="bar"
        height={280}
      />
    </div>
  );
}
