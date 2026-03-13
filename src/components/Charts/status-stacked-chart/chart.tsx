"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

const CATEGORIES = [
  "Counselling",
  "Monitoring",
  "Flex (Academic)",
  "Flex (Financial)",
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

const OPEN_COLOR = "#22c55e";
const CLOSED_COLOR = "#ef4444";

const defaultData: StatusStackedChartData = {
  open: [12, 8, 15, 6],
  closed: [5, 10, 4, 9],
};

export function StatusStackedChart({
  title = "Intervention Status by Type",
  data = defaultData,
}: PropsType) {
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
        color: "#000",
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
        colors: ["#000"],
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
    },
    legend: {
      show: true,
      position: "bottom",
      horizontalAlign: "center",
      fontFamily: "Satoshi",
      markers: {
    
        size: 12,
        
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
