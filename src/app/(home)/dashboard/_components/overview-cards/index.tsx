"use server"
import { getOverviewData } from "../../fetch";
import type {
  AppUser,
  MasterFilterParams,
  AlertDimensionFilter,
} from "../../fetch";
import { OverviewCard } from "./card";
import * as icons from "./icons";
import Link from "next/link";
import type { AlertFilter } from "../../fetch";
import { AttendanceOverviewCardClient } from "./AttendanceOverviewCardClient";

type PropsType = {
  selectedAlert: AlertFilter | string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
};

export async function OverviewCardsGroup({
  selectedAlert,
  user,
  masterFilter,
  gpaFilters,
  attendanceFilters,
}: PropsType) {
  const { yellowGpa, redGpa } = await getOverviewData(
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters
  );

  const active = selectedAlert || "all";

  return (
    <div className="flex flex-col 2xl:flex-row gap-2 ">
      <Link
        href={`/?selected_alert=attendance`}
        className="rounded-[10px] transition-opacity hover:opacity-90 flex-1"
        scroll={false}
      >
        <AttendanceOverviewCardClient
          label="Attendance"
          isActive={active === "attendance"}
          user={user}
          masterFilter={masterFilter}
          gpaFilters={gpaFilters}
          attendanceFilters={attendanceFilters}
        />
      </Link>
      <Link
        href={`/?selected_alert=gpa`}
        className="rounded-[10px] transition-opacity hover:opacity-90 flex-1"
        scroll={false}
      >
        <OverviewCard
          label="GPA"
          data={{ yellow: yellowGpa.value, red: redGpa.value }}
          isActive={active === "gpa"}
          user={user}
          masterFilter={masterFilter}
          gpaFilters={gpaFilters}
          attendanceFilters={attendanceFilters}
        />
      </Link>
    </div>
  );
}
