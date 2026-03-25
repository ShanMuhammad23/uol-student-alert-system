"use client";

import type { AppUser, AlertFilter } from "../../fetch";
import { AttendanceOverviewCardClient } from "./AttendanceOverviewCardClient";
import { OverviewCard } from "./card";
import { useDashboardFilter } from "../DashboardFilterContext";
import {
  useInterventionSlice,
  type InterventionChartSlice,
} from "../InterventionSliceContext";
import { useMergeDashboardHref } from "../useDashboardHref";

type PropsType = {
  selectedAlert: AlertFilter | string;
  user?: AppUser | null;
  yellowGpa: number;
  redGpa: number;
};

export function OverviewCardsGroup({
  selectedAlert,
  user,
  yellowGpa,
  redGpa,
}: PropsType) {
  const filter = useDashboardFilter();
  const { slice, setSlice } = useInterventionSlice();
  const mergeHref = useMergeDashboardHref();
  const active = selectedAlert || "all";

  const attendanceHref = mergeHref({ selected_alert: "attendance" });
  const gpaHref = mergeHref({ selected_alert: "gpa" });

  const isSlice = (s: InterventionChartSlice) => slice === s;

  const toggleSlice = (s: InterventionChartSlice) => {
    setSlice(slice === s ? null : s);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-[10px] bg-white dark:bg-gray-dark p-4 shadow-xl transition-shadow md:min-w-[240px] flex-1 border border-gray-200 data-[active=true]:ring-2 data-[active=true]:ring-primary data-[active=true]:shadow-md"
        data-active={active === "attendance"}
      >
        <AttendanceOverviewCardClient
          label="Attendance"
          titleHref={attendanceHref}
          isActive={active === "attendance"}
          user={user}
          masterFilter={filter?.masterFilter}
          attendanceFilters={filter?.attendanceFilters}
          yellowActive={isSlice("attendance_yellow")}
          redActive={isSlice("attendance_red")}
          onYellowClick={() => toggleSlice("attendance_yellow")}
          onRedClick={() => toggleSlice("attendance_red")}
        />
      </div>
      <div
        className="rounded-[10px] bg-white dark:bg-gray-dark p-4 shadow-xl transition-shadow md:min-w-[240px] flex-1 border border-gray-200 data-[active=true]:ring-2 data-[active=true]:ring-primary data-[active=true]:shadow-md"
        data-active={active === "gpa"}
      >
        <OverviewCard
          label="GPA"
          titleHref={gpaHref}
          data={{ yellow: yellowGpa, red: redGpa }}
          isActive={active === "gpa"}
          user={user}
          masterFilter={filter?.masterFilter}
          gpaFilters={filter?.gpaFilters}
          attendanceFilters={filter?.attendanceFilters}
          yellowActive={isSlice("gpa_yellow")}
          redActive={isSlice("gpa_red")}
          onYellowClick={() => toggleSlice("gpa_yellow")}
          onRedClick={() => toggleSlice("gpa_red")}
        />
      </div>
    </div>
  );
}
