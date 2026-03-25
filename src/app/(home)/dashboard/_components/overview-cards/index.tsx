"use client";

import type { AppUser, AlertFilter } from "../../fetch";
import { AttendanceOverviewCardClient } from "./AttendanceOverviewCardClient";
import { OverviewCard } from "./card";
import { useDashboardFilter } from "../DashboardFilterContext";
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
  const mergeHref = useMergeDashboardHref();

  const attendanceFilters = filter?.attendanceFilters ?? [];
  const gpaFilters = filter?.gpaFilters ?? [];
  const setAttendanceFilters = filter?.setAttendanceFilters;
  const setGpaFilters = filter?.setGpaFilters;

  const attendanceYellowActive = attendanceFilters.includes("yellow");
  const attendanceRedActive = attendanceFilters.includes("red");
  const gpaYellowActive = gpaFilters.includes("yellow");
  const gpaRedActive = gpaFilters.includes("red");

  const active =
    attendanceYellowActive || attendanceRedActive
      ? "attendance"
      : gpaYellowActive || gpaRedActive
        ? "gpa"
        : selectedAlert || "all";

  const attendanceHref = mergeHref({ selected_alert: "attendance" });
  const gpaHref = mergeHref({ selected_alert: "gpa" });

  const toggleAttendanceYellow = () => {
    if (!setAttendanceFilters) return;
    if (attendanceYellowActive) {
      setAttendanceFilters([]);
      return;
    }
    setAttendanceFilters(["yellow"]);
    setGpaFilters?.([]);
  };

  const toggleAttendanceRed = () => {
    if (!setAttendanceFilters) return;
    if (attendanceRedActive) {
      setAttendanceFilters([]);
      return;
    }
    setAttendanceFilters(["red"]);
    setGpaFilters?.([]);
  };

  const toggleGpaYellow = () => {
    if (!setGpaFilters) return;
    if (gpaYellowActive) {
      setGpaFilters([]);
      return;
    }
    setGpaFilters(["yellow"]);
    setAttendanceFilters?.([]);
  };

  const toggleGpaRed = () => {
    if (!setGpaFilters) return;
    if (gpaRedActive) {
      setGpaFilters([]);
      return;
    }
    setGpaFilters(["red"]);
    setAttendanceFilters?.([]);
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
          yellowActive={attendanceYellowActive}
          redActive={attendanceRedActive}
          onYellowClick={toggleAttendanceYellow}
          onRedClick={toggleAttendanceRed}
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
          yellowActive={gpaYellowActive}
          redActive={gpaRedActive}
          onYellowClick={toggleGpaYellow}
          onRedClick={toggleGpaRed}
        />
      </div>
    </div>
  );
}
