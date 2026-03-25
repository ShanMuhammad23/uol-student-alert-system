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
import { useDashboardFilter } from "./DashboardFilterContext";
import type { InterventionChartSlice } from "./InterventionSliceContext";
import { useInterventionSlice } from "./InterventionSliceContext";

type Props = {
  title: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
};

function deduplicateEnrollments(
  data: import("@/lib/enrollment").EnrollmentRecord[]
) {
  const seen = new Set<string>();
  return data.filter((record) => {
    const id =
      record.Id ?? `${record.SapNo}-${record.CrCode}-${record.Section}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function aggregateStatusesForCohort(
  cohortSapIds: string[],
  interventionStatuses: Map<string, string | null>
) {
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
    else initiated += 1;
  }

  // Row-level total alerts minus students with at least one intervention status in DB.
  const totalInterventionStudents = initiated + inProgress + referred + resolved;
  const notStarted = Math.max(0, cohortSapIds.length - totalInterventionStudents);

  return { initiated, inProgress, referred, resolved, notStarted };
}

function sliceDescription(slice: InterventionChartSlice | null): string | null {
  if (!slice) return null;
  const map: Record<InterventionChartSlice, string> = {
    attendance_yellow: "Yellow attendance alerts",
    attendance_red: "Red attendance alerts",
    gpa_yellow: "Yellow GPA alerts",
    gpa_red: "Red GPA alerts",
  };
  return map[slice];
}

export function InterventionStatusChartClient({
  title,
  user,
  masterFilter: masterFilterProp,
  gpaFilters: gpaFiltersProp,
  attendanceFilters: attendanceFiltersProp,
}: Props): JSX.Element {
  const dashboardFilter = useDashboardFilter();
  const { slice, clearSlice } = useInterventionSlice();

  const masterFilter =
    dashboardFilter?.masterFilter ?? masterFilterProp ?? {};
  const gpaFilters = dashboardFilter?.gpaFilters ?? gpaFiltersProp ?? [];
  const attendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFiltersProp ?? [];

  const { data: enrollmentData } = useEnrollmentData();
  const [interventionStatuses, setInterventionStatuses] = useState<
    Map<string, string | null>
  >(new Map());

  const [gpaCohortSapIds, setGpaCohortSapIds] = useState<string[] | null>(
    null
  );
  const [gpaCohortLoading, setGpaCohortLoading] = useState(false);

  const matchesAttendanceFilters = (
    level: "critical" | "warning" | null
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
    const anyUser = user as { department_ids?: string[]; sap_id?: string };

    if (user.role === "dean" && user.faculty_id) {
      list = list.filter((r) => r.FacId === user.faculty_id);
    } else if (
      user.role === "hod" &&
      Array.isArray(anyUser.department_ids) &&
      anyUser.department_ids.length
    ) {
      const deptSet = new Set<string>(anyUser.department_ids);
      list = list.filter(
        (r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId)
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
    const raw = filterEnrollmentByMasterFilter(
      scopedEnrollmentData,
      mf,
      user.role === "dean" ? user.faculty_id ?? undefined : undefined
    );
    return deduplicateEnrollments(raw);
  }, [scopedEnrollmentData, masterFilter, user]);

  const {
    attendanceSummaries,
    classAverageByCourseSection,
  } = useAttendanceAlerts(filteredEnrollments ?? []);

  const { yellowAttendanceSap, redAttendanceSap, unionAttendanceSap } =
    useMemo(() => {
      const yellow: string[] = [];
      const red: string[] = [];
      if (!attendanceSummaries) {
        return {
          yellowAttendanceSap: yellow,
          redAttendanceSap: red,
          unionAttendanceSap: [] as string[],
        };
      }

      for (const row of filteredEnrollments ?? []) {
        const sectionKey = `${normalizeCourseCode(
          typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? "")
        )}__${row.Section ?? ""}`;
        const attKey = getEnrollmentAttendanceKey(row);
        const summary = attendanceSummaries.get(attKey);
        if (!summary) continue;
        const classAvg = classAverageByCourseSection.get(sectionKey);
        if (classAvg == null) continue;
        const level = getAttendanceAlertLevel(summary.percentage, classAvg);
        if (!matchesAttendanceFilters(level)) continue;
        const sap = String(row.SapNo ?? "").trim();
        if (!sap) continue;
        if (level === "critical") red.push(sap);
        else if (level === "warning") yellow.push(sap);
      }

      const union = [...yellow, ...red];
      return {
        yellowAttendanceSap: yellow,
        redAttendanceSap: red,
        unionAttendanceSap: union,
      };
    }, [
      attendanceSummaries,
      filteredEnrollments,
      classAverageByCourseSection,
      attendanceFilters,
    ]);

  useEffect(() => {
    if (slice !== "gpa_yellow" && slice !== "gpa_red") {
      setGpaCohortSapIds(null);
      setGpaCohortLoading(false);
      return;
    }

    const segment = slice === "gpa_red" ? "red" : "yellow";
    const controller = new AbortController();
    setGpaCohortLoading(true);
    setGpaCohortSapIds(null);

    fetch("/api/dashboard/gpa-alert-sap-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment,
        masterFilter:
          masterFilter && Object.keys(masterFilter).length > 0
            ? masterFilter
            : undefined,
        gpaFilters: gpaFilters?.length ? gpaFilters : undefined,
        attendanceFilters: attendanceFilters?.length
          ? attendanceFilters
          : undefined,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("gpa cohort");
        return res.json() as Promise<{ sapIds?: string[] }>;
      })
      .then((body) => {
        setGpaCohortSapIds(body.sapIds ?? []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setGpaCohortSapIds([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setGpaCohortLoading(false);
      });

    return () => controller.abort();
  }, [slice, masterFilter, gpaFilters, attendanceFilters]);

  const targetCohort = useMemo((): string[] | null => {
    if (!slice) return unionAttendanceSap;
    if (slice === "attendance_yellow") return yellowAttendanceSap;
    if (slice === "attendance_red") return redAttendanceSap;
    if (slice === "gpa_yellow" || slice === "gpa_red") {
      if (gpaCohortLoading || gpaCohortSapIds === null) return null;
      return gpaCohortSapIds;
    }
    return unionAttendanceSap;
  }, [
    slice,
    unionAttendanceSap,
    yellowAttendanceSap,
    redAttendanceSap,
    gpaCohortSapIds,
    gpaCohortLoading,
  ]);

  const targetCohortUniqueSapIds = useMemo(() => {
    if (!targetCohort) return [];
    return Array.from(
      new Set(targetCohort.map((s) => String(s).trim()).filter(Boolean))
    );
  }, [targetCohort]);

  useEffect(() => {
    if (!targetCohortUniqueSapIds.length) {
      setInterventionStatuses(new Map());
      return;
    }
    const controller = new AbortController();
    fetch("/api/interventions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sapIds: targetCohortUniqueSapIds }),
      signal: controller.signal,
    })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<Record<string, string | null>>)
          : Promise.reject(new Error("Failed to load intervention statuses"))
      )
      .then((data) => {
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

    return () => controller.abort();
  }, [targetCohortUniqueSapIds]);

  const { initiated, inProgress, referred, resolved, notStarted } =
    useMemo(() => {
      if (targetCohort === null) {
        return {
          initiated: 0,
          inProgress: 0,
          referred: 0,
          resolved: 0,
          notStarted: 0,
        };
      }
      return aggregateStatusesForCohort(targetCohort, interventionStatuses);
    }, [targetCohort, interventionStatuses]);

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

  const subtitle = sliceDescription(slice);

  return (
    <div className="px-2 pb-2">
      <div className="flex flex-wrap items-start justify-between gap-2 px-2">
        <div className="min-w-0 flex-1">
          {subtitle ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </p>
          ) : null
          }
        </div>
        {slice != null && (
          <button
            type="button"
            onClick={clearSlice}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      {gpaCohortLoading && (slice === "gpa_yellow" || slice === "gpa_red") ? (
        <p className="px-2 py-8 text-center text-sm text-neutral-500">
          Loading cohort…
        </p>
      ) : (
        <InterventionStatusChart
          title={title}
          data={data}
          statusColors={statusColors}
        />
      )}
    </div>
  );
}
