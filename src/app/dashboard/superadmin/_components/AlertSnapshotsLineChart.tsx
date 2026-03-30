"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { AlertSnapshotTrendPoint } from "@/app/(home)/dashboard/fetch";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type Props = {
  points: AlertSnapshotTrendPoint[];
};

export function AlertSnapshotsLineChart({ points }: Props) {
  const categories = points.map((p) => p.snapshotDate);
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
    },
    colors: ["#1F2937", "#EAB308", "#DC2626", "#F59E0B", "#B91C1C"],
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
      horizontalAlign: "left",
    },
    grid: {
      strokeDashArray: 5,
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      shared: true,
      intersect: false,
    },
  };

  const series = [
    { name: "Total Students", data: points.map((p) => p.totalStudents) },
    { name: "GPA Yellow", data: points.map((p) => p.yellowGpa) },
    { name: "GPA Red", data: points.map((p) => p.redGpa) },
    { name: "Attendance Yellow", data: points.map((p) => p.yellowAttendance) },
    { name: "Attendance Red", data: points.map((p) => p.redAttendance) },
  ];

  if (!points.length) {
    return (
      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-sm text-dark-5 dark:text-dark-6">
          No snapshot history found yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <p className="mb-4 text-sm font-semibold text-dark dark:text-white">
        Alerts Snapshot by Date
      </p>
      <Chart options={options} series={series} type="line" height={320} />
    </div>
  );
}
