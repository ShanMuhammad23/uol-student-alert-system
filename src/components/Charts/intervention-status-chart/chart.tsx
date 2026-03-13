"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

type DataPoint = {
  x: string;
  y: number;
};

type PropsType = {
  title: string;
  data: DataPoint[];
  /** Map each bar (by x-axis label / status) to a hex color. Bars not in the map use defaultColor. */
  statusColors?: Record<string, string>;
  /** Fallback color when statusColors has no entry for a bar (default: gray) */
  defaultColor?: string;
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const DEFAULT_BAR_COLOR = "#94A3B8";

export function InterventionStatusChart({
  title,
  data,
  statusColors,
  defaultColor = DEFAULT_BAR_COLOR,
}: PropsType) {
  const colors = data.map((d) => statusColors?.[d.x] ?? defaultColor);

  const options: ApexOptions = {
   
  title: {
    text: title,
    style: {
      fontSize: "16px",
      fontWeight: "bold",
      color: "#000",
    },
  },
    colors,
    chart: {
      fontFamily: "Satoshi, sans-serif",
      type: "bar",
      height: 200,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        borderRadius: 3,
        distributed: true,
        dataLabels: {
          position: "top",
          hideOverflowingLabels: false,
          
        },

      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -16,
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
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show:false,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Satoshi",
    },
    grid: {
      strokeDashArray: 7,
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
    },
  };

  return (
    <div className="">
      <Chart
        options={options}
        series={[
          {
            name: "",
            data,
          },
        ]}
        type="bar"
        height={230}
        
      />
    </div>
  );
}
