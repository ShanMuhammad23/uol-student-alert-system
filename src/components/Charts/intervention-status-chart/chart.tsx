"use client";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
type DataPoint = {
  x: string;
  y: number;
};
type PropsType = {
  title: string;
  data: DataPoint[];
  statusColors?: Record<string, string>;
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const titleColor = isDark ? "#E5E7EB" : "#111827";
  const dataLabelColor = isDark ? "#F9FAFB" : "#111827";
  const axisLabelColor = isDark ? "#9CA3AF" : "#6B7280";
  const colors = data.map((d) => statusColors?.[d.x] ?? defaultColor);

  const options: ApexOptions = {
   
  title: {
    text: title,
    style: {
      fontSize: "16px",
      fontWeight: "bold",
      color: titleColor,
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
        colors: [dataLabelColor],
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
      labels: {
        rotate: -30,
        trim: true,
        style: {
          fontSize: "11px",
          colors: data.map(() => axisLabelColor),
        },
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
