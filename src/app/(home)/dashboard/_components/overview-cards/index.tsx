"use client";

import Link from "next/link";
import type { AppUser, AlertFilter } from "../../fetch";
import { AttendanceOverviewCardClient } from "./AttendanceOverviewCardClient";
import { OverviewCard } from "./card";
import { useDashboardFilter } from "../DashboardFilterContext";

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
  const active = selectedAlert || "all";

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/?selected_alert=attendance`}
        className="rounded-[10px] transition-opacity hover:opacity-90 flex-1"
        scroll={false}
      >
        <AttendanceOverviewCardClient
          label="Attendance"
          isActive={active === "attendance"}
          user={user}
          masterFilter={filter?.masterFilter}
          attendanceFilters={filter?.attendanceFilters}
        />
      </Link>
      <Link
        href={`/?selected_alert=gpa`}
        className="rounded-[10px] transition-opacity hover:opacity-90 flex-1"
        scroll={false}
      >
        <OverviewCard
          label="GPA"
          data={{ yellow: yellowGpa, red: redGpa }}
          isActive={active === "gpa"}
          user={user}
          masterFilter={filter?.masterFilter}
          gpaFilters={filter?.gpaFilters}
          attendanceFilters={filter?.attendanceFilters}
        />
      </Link>
    </div>
  );
}
