"use client";

import { compactFormat } from "@/lib/format-number";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

type PropsType = {
  data: { name: string; amount: number }[];
  colors?: string[];
  centerLabel?: string;
  /** Custom center value (e.g. "150 / 1200"). When set, overrides the numeric total. */
  centerValue?: string;
  /** "sm" = compact size (matches overview card height); default = larger. */
  size?: "default" | "sm";
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

/** Small chart: render at this size so it fits inside container without overflow */
const SMALL_CHART_SIZE = 120;
/** Container for small chart: clips any overflow */
const SMALL_CONTAINER_SIZE = 120;

export function DonutChart({
  data,
  colors = ["#5750F1", "#5475E5", "#8099EC", "#ADBCF2"],
  centerLabel = "Visitors",
  centerValue,
  size = "sm",
}: PropsType) {
  const isSm = size === "sm";
  const chartSize = isSm ? SMALL_CHART_SIZE : 320;
  const containerSize = isSm ? SMALL_CONTAINER_SIZE : undefined;
  const donutHolePercent = isSm ? "82%" : "72%";
  const labelFontSize = isSm ? "10px" : "14px";
  const valueFontSize = isSm ? "14px" : "22px";

  const chartOptions: ApexOptions = {
    chart: {
      type: "pie",
      fontFamily: "inherit",
    },
    colors,
    labels: data.map((item) => item.name),
    legend: {
      show: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: donutHolePercent,
          background: "transparent",
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: centerLabel,
              fontSize: labelFontSize,
              fontWeight: "400",
              formatter: () =>
                centerValue !== undefined
                  ? centerValue
                  : compactFormat(data.reduce((sum, d) => sum + d.amount, 0)),
            },
            value: {
              show: true,
              fontSize: valueFontSize,
              fontWeight: "bold",
              formatter: () =>
                centerValue !== undefined ? centerValue : compactFormat(data.reduce((sum, d) => sum + d.amount, 0)),
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    ...(isSm
      ? {}
      : {
          responsive: [
            {
              breakpoint: 2600,
              options: { chart: { width: 320, height: 320 } },
            },
            {
              breakpoint: 640,
              options: { chart: { width: "100%", height: 320 } },
            },
            {
              breakpoint: 370,
              options: { chart: { width: 260, height: 260 } },
            },
          ],
        }),
  };

  return (
    <div
      className={cn(
        "mx-auto flex items-center justify-center ",
        isSm
          ? "shrink-0 overflow-hidden"
          : "w-full max-w-[420px]"
      )}
      style={
        containerSize != null
          ? {
              width: containerSize,
              height: containerSize,
              minWidth: containerSize,
              minHeight: containerSize,
              maxWidth: containerSize,
              maxHeight: containerSize,
            }
          : undefined
      }
    >
      <div
        className={isSm ? "flex items-center justify-center overflow-hidden" : undefined}
        style={
          containerSize != null
            ? { width: containerSize, height: containerSize }
            : undefined
        }
      >
        <Chart
          options={chartOptions}
          series={data.map((item) => item.amount)}
          type="donut"
          height={chartSize}
          {...(isSm ? { width: chartSize } : {})}
        />
      </div>
    </div>
  );
}
