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

  const roleScope = useMemo(() => {
    if (!user?.role) return null;
    if (user.role === "dean") {
      return {
        role: "dean" as const,
        facultyId: user.faculty_id ?? null,
        departmentIds: null as string[] | null,
        courseIds: null as string[] | null,
        staffId: null as string | null,
      };
    }
    if (user.role === "hod") {
      return {
        role: "hod" as const,
        facultyId: null as string | null,
        departmentIds: user.department_ids ?? null,
        courseIds: null as string[] | null,
        staffId: null as string | null,
      };
    }
    return {
      role: "teacher" as const,
      facultyId: null as string | null,
      departmentIds: null as string[] | null,
      courseIds: user.course_ids ?? null,
      staffId: user.id ?? null,
    };
  }, [user]);

  useEffect(() => {
    if (!roleScope) return;
    const controller = new AbortController();

    const fetchResolved = async (
      interventionType: "attendance" | "gpa",
      alertLevel: "warning" | "critical"
    ) => {
      const res = await fetch("/api/interventions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleScope.role,
          interventionType,
          alertLevel,
          facultyId: roleScope.facultyId,
          departmentIds: roleScope.departmentIds,
          courseIds: roleScope.courseIds,
          staffId: roleScope.staffId,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load resolved counts");
      const body = (await res.json()) as { resolved?: number };
      return body.resolved ?? 0;
    };

    Promise.all([
      fetchResolved("attendance", "warning"),
      fetchResolved("attendance", "critical"),
      fetchResolved("gpa", "warning"),
      fetchResolved("gpa", "critical"),
    ])
      .then(([attendanceYellow, attendanceRed, gpaYellow, gpaRed]) => {
        setResolved({
          attendanceYellow,
          attendanceRed,
          gpaYellow,
          gpaRed,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResolved({
          attendanceYellow: 0,
          attendanceRed: 0,
          gpaYellow: 0,
          gpaRed: 0,
        });
      });

    return () => controller.abort();
  }, [roleScope]);

  const netAttendanceYellow = Math.max(0, yellowAttendance - resolved.attendanceYellow);
  const netAttendanceRed = Math.max(0, redAttendance - resolved.attendanceRed);
  const netGpaYellow = Math.max(0, yellowGpa - resolved.gpaYellow);
  const netGpaRed = Math.max(0, redGpa - resolved.gpaRed);

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
          yellowCount={netAttendanceYellow}
          redCount={netAttendanceRed}
          grossYellowCount={yellowAttendance}
          grossRedCount={redAttendance}
          totalStudents={totalStudents}
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
          data={{
            yellow: netGpaYellow,
            red: netGpaRed,
            grossYellow: yellowGpa,
            grossRed: redGpa,
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
