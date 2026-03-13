import { AttendanceChart } from "./attendance-chart";
import { GPAChart } from "./gpa-chart";
import { cn } from "@/lib/utils";
import type { AppUser, MasterFilterParams, AlertDimensionFilter } from "../../fetch";

type PropsType = {
  className?: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
};

export async function OverviewChart({
  className,
  user,
  masterFilter,
  gpaFilters,
  attendanceFilters,
}: PropsType) {
  return (
    <div className={cn("grid grid-cols-2", className)}>
      <AttendanceChart
        user={user}
        masterFilter={masterFilter}
        gpaFilters={gpaFilters}
        attendanceFilters={attendanceFilters}
      />
      <GPAChart
        user={user}
        masterFilter={masterFilter}
        gpaFilters={gpaFilters}
        attendanceFilters={attendanceFilters}
      />
    </div>
  );
}
