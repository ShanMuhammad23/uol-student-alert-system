import { DonutChart } from "@/components/Charts/used-devices/chart";
import { cn } from "@/lib/utils";
import { getOverviewData } from "../../fetch";
import type { AppUser, MasterFilterParams, AlertDimensionFilter } from "../../fetch";

type PropsType = {
  className?: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
};

const CHART_COLORS = ["#DC2626", "#22C55E"];

export async function AttendanceChart({
  className,
  user,
  masterFilter,
  gpaFilters,
  attendanceFilters,
}: PropsType) {
  const { totalStudents, yellowAttendance, redAttendance } =
    await getOverviewData(user, masterFilter, gpaFilters, attendanceFilters);

  const withAlerts = yellowAttendance.value + redAttendance.value;
  const noAlert = totalStudents - withAlerts;
  const alertsPercentage =
    totalStudents > 0 ? Math.round((withAlerts / totalStudents) * 100) : 0;

  const data = [
    { name: "With alert(s)", amount: withAlerts },
    { name: "No alert", amount: noAlert },
  ];

  return (


    <div className="flex flex-col">
     
      <div className="flex w-full items-center justify-center max-h-[200px]">
        <DonutChart
          data={data}
          colors={CHART_COLORS}
          centerLabel=""
          centerValue={`${alertsPercentage.toFixed(1)}%`}
          size="sm"
        />
      </div>
    </div>

  );
}
