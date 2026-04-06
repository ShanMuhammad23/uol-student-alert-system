"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppUser, AlertFilter } from "../../fetch";
import { AttendanceOverviewCardClient } from "./AttendanceOverviewCardClient";
import { OverviewCard } from "./card";
import { useDashboardFilter } from "../DashboardFilterContext";
import { useMergeDashboardHref } from "../useDashboardHref";

type PropsType = {
  selectedAlert: AlertFilter | string;
  user?: AppUser | null;
  totalStudents: number;
  yellowGpa: number;
  redGpa: number;
  yellowAttendance: number;
  redAttendance: number;
};

export function OverviewCardsGroup({
  selectedAlert,
  user,
  totalStudents,
  yellowGpa,
  redGpa,
  yellowAttendance,
  redAttendance,
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

  const [resolved, setResolved] = useState({
    attendanceYellow: 0,
    attendanceRed: 0,
    gpaYellow: 0,
    gpaRed: 0,
  });
  const [liveCounts, setLiveCounts] = useState({
    totalStudents,
    grossAttendanceYellow: yellowAttendance,
    grossAttendanceRed: redAttendance,
    attendanceUpdatedCount: 0,
    attendanceHeldCount: 0,
    grossGpaYellow: yellowGpa,
    grossGpaRed: redGpa,
  });

  const roleScope = useMemo(() => {
    if (!user?.role) return null;
    if (user.role === "dean") {
      return {
        role: "dean" as const,
        facultyId: user.faculty_id ?? null,
        departmentIds: null as string[] | null,
        courseIds: null as string[] | null,
        pernr: null as string | null,
      };
    }
    if (user.role === "hod") {
      return {
        role: "hod" as const,
        facultyId: null as string | null,
        departmentIds: user.department_ids ?? null,
        courseIds: null as string[] | null,
        pernr: null as string | null,
      };
    }
    return {
      role: "teacher" as const,
      facultyId: null as string | null,
      departmentIds: null as string[] | null,
      courseIds: user.course_ids ?? null,
      pernr: user.sap_id ?? null,
    };
  }, [user]);

  useEffect(() => {
    setLiveCounts({
      totalStudents,
      grossAttendanceYellow: yellowAttendance,
      grossAttendanceRed: redAttendance,
      attendanceUpdatedCount: 0,
      attendanceHeldCount: 0,
      grossGpaYellow: yellowGpa,
      grossGpaRed: redGpa,
    });
  }, [totalStudents, yellowAttendance, redAttendance, yellowGpa, redGpa]);

  useEffect(() => {
    if (!roleScope || !filter) return;
    const controller = new AbortController();

    fetch("/api/dashboard/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleScope,
        masterFilter: filter.masterFilter,
        gpaFilters: filter.gpaFilters,
        attendanceFilters: filter.attendanceFilters,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load live overview counts");
        return (await res.json()) as {
          totalStudents: number;
          attendance: {
            grossYellow: number;
            grossRed: number;
            resolvedYellow: number;
            resolvedRed: number;
            updatedAttendance: number;
            totalClassesHeld: number;
          };
          gpa: {
            grossYellow: number;
            grossRed: number;
            resolvedYellow: number;
            resolvedRed: number;
          };
        };
      })
      .then((body) => {
        setLiveCounts({
          totalStudents: body.totalStudents,
          grossAttendanceYellow: body.attendance.grossYellow,
          grossAttendanceRed: body.attendance.grossRed,
          attendanceUpdatedCount: body.attendance.updatedAttendance ?? 0,
          attendanceHeldCount: body.attendance.totalClassesHeld ?? 0,
          grossGpaYellow: body.gpa.grossYellow,
          grossGpaRed: body.gpa.grossRed,
        });
        setResolved({
          attendanceYellow: body.attendance.resolvedYellow,
          attendanceRed: body.attendance.resolvedRed,
          gpaYellow: body.gpa.resolvedYellow,
          gpaRed: body.gpa.resolvedRed,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [
    roleScope,
    filter,
    filter?.masterFilter,
    filter?.gpaFilters,
    filter?.attendanceFilters,
  ]);

  const netAttendanceYellow = liveCounts.grossAttendanceYellow;
  const netAttendanceRed = liveCounts.grossAttendanceRed;
  const netGpaYellow = Math.max(0, liveCounts.grossGpaYellow - resolved.gpaYellow);
  const netGpaRed = Math.max(0, liveCounts.grossGpaRed - resolved.gpaRed);

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
    <div className="flex h-full flex-col gap-2">
      <div
        className="rounded-[10px] bg-white dark:bg-gray-dark p-4 shadow-xl transition-shadow md:min-w-[240px] flex-1 border border-gray-200 data-[active=true]:ring-2 data-[active=true]:ring-primary data-[active=true]:shadow-md dark:border-dark-3"
        data-active={active === "attendance"}
      >
        <AttendanceOverviewCardClient
          label="Attendance"
          titleHref={attendanceHref}
          isActive={active === "attendance"}
          yellowCount={netAttendanceYellow}
          redCount={netAttendanceRed}
          grossYellowCount={liveCounts.grossAttendanceYellow}
          grossRedCount={liveCounts.grossAttendanceRed}
          totalStudents={liveCounts.totalStudents}
          updatedAttendanceCount={liveCounts.attendanceUpdatedCount}
          totalHeldCount={liveCounts.attendanceHeldCount}
          attendanceFilters={filter?.attendanceFilters}
          yellowActive={attendanceYellowActive}
          redActive={attendanceRedActive}
          onYellowClick={toggleAttendanceYellow}
          onRedClick={toggleAttendanceRed}
        />
      </div>
      <div
        className="rounded-[10px] bg-white dark:bg-gray-dark p-4 shadow-xl transition-shadow md:min-w-[240px] flex-1 border border-gray-200 data-[active=true]:ring-2 data-[active=true]:ring-primary data-[active=true]:shadow-md dark:border-dark-3"
        data-active={active === "gpa"}
      >
        <OverviewCard
          label="GPA"
          titleHref={gpaHref}
          totalStudents={liveCounts.totalStudents}
          data={{
            yellow: netGpaYellow,
            red: netGpaRed,
            grossYellow: liveCounts.grossGpaYellow,
            grossRed: liveCounts.grossGpaRed,
          }}
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
