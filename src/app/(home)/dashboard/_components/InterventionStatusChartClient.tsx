"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { useEnrollmentData } from "@/hooks/useEnrollmentData";
import {
  filterEnrollmentByMasterFilter,
  type MasterFilterParams as EnrollmentMasterFilterParams,
} from "@/lib/enrollment";
import {
  getAttendanceAlertLevel,
  getEnrollmentAttendanceKey,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import type {
  AppUser,
  MasterFilterParams,
  AlertDimensionFilter,
} from "../fetch";

type Props = {
  title: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  attendanceFilters?: AlertDimensionFilter[];
};

export function InterventionStatusChartClient({
  title,
  user,
  masterFilter,
  attendanceFilters,
}: Props): JSX.Element {
  const { data: enrollmentData } = useEnrollmentData();
  const [interventionStatuses, setInterventionStatuses] = useState<
    Map<string, string | null>
  >(new Map());

  const matchesAttendanceFilters = (
    level: "critical" | "warning" | null,
  ): boolean => {
    if (!attendanceFilters?.length) return true;
    const allowed = new Set<string | null>();
    for (const f of attendanceFilters) {
      if (f === "red") allowed.add("critical");
      else if (f === "yellow") allowed.add("warning");
      else if (f === "good") allowed.add(null);
    }
    return allowed.size ? allowed.has(level) : true;
  };

  const scopedEnrollmentData = useMemo(() => {
    if (!enrollmentData?.length || !user?.role) return enrollmentData ?? [];
    let list = enrollmentData;
    const anyUser = user as any;

    if (user.role === "dean" && user.faculty_id) {
      list = list.filter((r) => r.FacId === user.faculty_id);
    } else if (
      user.role === "hod" &&
      Array.isArray(anyUser.department_ids) &&
      anyUser.department_ids.length
    ) {
      const deptSet = new Set<string>(anyUser.department_ids);
      list = list.filter(
        (r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId),
      );
    } else if (user.role === "teacher" && anyUser.sap_id) {
      const pernr = String(anyUser.sap_id).trim();
      list = list.filter((r) => (r.Pernr ?? "").trim() === pernr);
    }

    return list;
  }, [enrollmentData, user]);

  const filteredEnrollments = useMemo(() => {
    if (!scopedEnrollmentData?.length || !user?.role)
      return scopedEnrollmentData ?? [];
    const mf: EnrollmentMasterFilterParams =
      masterFilter && Object.keys(masterFilter).length > 0
        ? {
            department_ids: masterFilter.department_ids,
            programs: masterFilter.programs,
            instructor_ids: masterFilter.instructor_ids,
            course_ids: masterFilter.course_ids,
          }
        : {};
    return filterEnrollmentByMasterFilter(
      scopedEnrollmentData,
      mf,
      user.role === "dean" ? user.faculty_id ?? undefined : undefined,
    );
  }, [scopedEnrollmentData, masterFilter, user]);

  const {
    attendanceSummaries,
    classAverageByCourseSection,
  } = useAttendanceAlerts(filteredEnrollments ?? []);

  const { yellowCount, redCount } = useMemo(() => {
    let yellow = 0;
    let red = 0;
    if (!attendanceSummaries) return { yellowCount: 0, redCount: 0 };

    for (const row of filteredEnrollments ?? []) {
      const sectionKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;
      const attKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attKey);
      if (!summary) continue;
      const classAvg = classAverageByCourseSection.get(sectionKey);
      if (classAvg == null) continue;
      const level = getAttendanceAlertLevel(summary.percentage, classAvg);
      if (!matchesAttendanceFilters(level)) continue;
      if (level === "critical") red += 1;
      else if (level === "warning") yellow += 1;
    }

    return { yellowCount: yellow, redCount: red };
  }, [attendanceSummaries, filteredEnrollments, classAverageByCourseSection]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/interventions/status`, {
      signal: controller.signal,
    })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Failed to load intervention statuses")),
      )
      .then((data: Record<string, string | null>) => {
        const map = new Map<string, string | null>();
        for (const [id, status] of Object.entries(data)) {
          map.set(id, status ?? null);
        }
        setInterventionStatuses(map);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setInterventionStatuses(new Map());
      });

    return () => {
      controller.abort();
    };
  }, []);

  let initiated = 0;
  let inProgress = 0;
  let referred = 0;
  let resolved = 0;

  for (const status of interventionStatuses.values()) {
    if (!status) continue;
    if (status === "initiated") initiated += 1;
    else if (status === "in-progress") inProgress += 1;
    else if (status === "referred") referred += 1;
    else if (status === "resolved") resolved += 1;
  }

  const totalAlerts = yellowCount + redCount;
  const totalInterventionStudents =
    initiated + inProgress + referred + resolved;
  const notStarted = Math.max(0, totalAlerts - totalInterventionStudents);

  const statusColors: Record<string, string> = {
    "Not Started": "#DE2649",
    Initiated: "#B5B126",
    "In-Progress": "#DBBE0F",
    Referred: "#9C5A99",
    Resolved: "#477061",
  };

  const data = [
    { x: "Not Started", y: notStarted },
    { x: "Initiated", y: initiated },
    { x: "In-Progress", y: inProgress },
    { x: "Resolved", y: resolved },
    { x: "Referred", y: referred },
  ];

  return (
    <InterventionStatusChart
      title={title}
      data={data}
      statusColors={statusColors}
    />
  );
}

