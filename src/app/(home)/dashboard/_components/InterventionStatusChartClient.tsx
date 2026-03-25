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

type Props = {
  title: string;
  user?: AppUser | null;
  masterFilter?: MasterFilterParams;
  gpaFilters?: AlertDimensionFilter[];
  attendanceFilters?: AlertDimensionFilter[];
  /** Which overview card is active (`attendance` or `gpa`), used for chart totals. */
  selectedAlert?: string;
  /** Used when selectedAlert === "gpa" and no slice is selected. */
  yellowGpa?: number;
  redGpa?: number;
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
  selectedAlert,
  yellowGpa = 0,
  redGpa = 0,
}: Props): JSX.Element {
  const debug =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_INTERVENTION_DEBUG === "true" ||
    process.env.NEXT_PUBLIC_INTERVENTION_DEBUG === "1";
  const dashboardFilter = useDashboardFilter();

  const setAttendanceFilters = dashboardFilter?.setAttendanceFilters;
  const setGpaFilters = dashboardFilter?.setGpaFilters;

  const selectedAlertMode = useMemo(() => {
    if (dashboardFilter?.gpaFilters?.length) return "gpa" as const;
    if (dashboardFilter?.attendanceFilters?.length) return "attendance" as const;
    return selectedAlert === "gpa" ? ("gpa" as const) : ("attendance" as const);
  }, [dashboardFilter?.gpaFilters, dashboardFilter?.attendanceFilters, selectedAlert]);

  const masterFilter =
    dashboardFilter?.masterFilter ?? masterFilterProp ?? {};
  const gpaFilters = dashboardFilter?.gpaFilters ?? gpaFiltersProp ?? [];
  const attendanceFilters =
    dashboardFilter?.attendanceFilters ?? attendanceFiltersProp ?? [];

  const effectiveSlice: InterventionChartSlice | null = useMemo(() => {
    // Red has precedence over yellow if both are present.
    if (attendanceFilters.includes("red")) return "attendance_red";
    if (attendanceFilters.includes("yellow")) return "attendance_yellow";
    if (gpaFilters.includes("red")) return "gpa_red";
    if (gpaFilters.includes("yellow")) return "gpa_yellow";
    return null;
  }, [attendanceFilters, gpaFilters]);

  const { data: enrollmentData } = useEnrollmentData();
  const [interventionCounts, setInterventionCounts] = useState<{
    initiated: number;
    inProgress: number;
    referred: number;
    resolved: number;
  }>({ initiated: 0, inProgress: 0, referred: 0, resolved: 0 });

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
    if (
      effectiveSlice !== "gpa_yellow" &&
      effectiveSlice !== "gpa_red"
    ) {
      setGpaCohortSapIds(null);
      setGpaCohortLoading(false);
      return;
    }

    const segment = effectiveSlice === "gpa_red" ? "red" : "yellow";
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
  }, [effectiveSlice, masterFilter, gpaFilters, attendanceFilters]);

  const interventionTypeForDb = useMemo<"attendance" | "gpa">(() => {
    if (
      effectiveSlice === "attendance_yellow" ||
      effectiveSlice === "attendance_red"
    ) {
      return "attendance";
    }
    if (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") {
      return "gpa";
    }
    return selectedAlertMode;
  }, [effectiveSlice, selectedAlertMode]);

  const totalAlerts = useMemo(() => {
    if (effectiveSlice === "attendance_yellow") return yellowAttendanceSap.length;
    if (effectiveSlice === "attendance_red") return redAttendanceSap.length;
    if (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") {
      return gpaCohortSapIds?.length ?? 0;
    }
    // No slice selected: use overview-card totals.
    if (selectedAlertMode === "gpa") return yellowGpa + redGpa;
    return unionAttendanceSap.length;
  }, [
    effectiveSlice,
    yellowAttendanceSap,
    redAttendanceSap,
    gpaCohortSapIds,
    selectedAlertMode,
    yellowGpa,
    redGpa,
    unionAttendanceSap,
  ]);

  const alertLevelForRequest = useMemo<"warning" | "critical" | null>(() => {
    if (effectiveSlice === "attendance_yellow" || effectiveSlice === "gpa_yellow") {
      return "warning";
    }
    if (effectiveSlice === "attendance_red" || effectiveSlice === "gpa_red") {
      return "critical";
    }
    return null;
  }, [effectiveSlice]);

  const clearSegmentFilters = () => {
    setAttendanceFilters?.([]);
    setGpaFilters?.([]);
  };

  useEffect(() => {
    if (!user?.role) return;

    const roleScope =
      user.role === "teacher" ? "teacher" : (user.role as "dean" | "hod");

    const controller = new AbortController();
    fetch("/api/interventions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: roleScope,
        interventionType: interventionTypeForDb,
        alertLevel: alertLevelForRequest,
        facultyId: user.role === "dean" ? user.faculty_id : null,
        departmentIds: user.role === "hod" ? user.department_ids : null,
        staffId: user.role === "teacher" ? user.id : null,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load intervention counts");
        return res.json() as Promise<{
          initiated?: number;
          inProgress?: number;
          referred?: number;
          resolved?: number;
        }>;
      })
      .then((counts) => {
        setInterventionCounts({
          initiated: counts.initiated ?? 0,
          inProgress: counts.inProgress ?? 0,
          referred: counts.referred ?? 0,
          resolved: counts.resolved ?? 0,
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setInterventionCounts({
          initiated: 0,
          inProgress: 0,
          referred: 0,
          resolved: 0,
        });
      });

    return () => controller.abort();
  }, [
    user?.role,
    user?.faculty_id,
    user?.department_ids,
    user?.id,
    interventionTypeForDb,
    alertLevelForRequest,
  ]);

  const { initiated, inProgress, referred, resolved, notStarted } = useMemo(() => {
    const totalInterventionStudents =
      interventionCounts.initiated +
      interventionCounts.inProgress +
      interventionCounts.referred +
      interventionCounts.resolved;
    return {
      initiated: interventionCounts.initiated,
      inProgress: interventionCounts.inProgress,
      referred: interventionCounts.referred,
      resolved: interventionCounts.resolved,
      notStarted: Math.max(0, totalAlerts - totalInterventionStudents),
    };
  }, [interventionCounts, totalAlerts]);

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

  const subtitle = sliceDescription(effectiveSlice);

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
        {effectiveSlice != null && (
          <button
            type="button"
            onClick={clearSegmentFilters}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      {gpaCohortLoading &&
      (effectiveSlice === "gpa_yellow" || effectiveSlice === "gpa_red") ? (
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
      {debug && (
        <div className="px-2 pt-2">
          <p className="text-[10px] text-neutral-500">
            Role: {user?.role ?? "—"}; Slice: {effectiveSlice ?? "—"}; Intervention type:{" "}
            {interventionTypeForDb}. Total alerts: {totalAlerts}
          </p>
          <p className="text-[10px] text-neutral-500">
            DB counts: initiated={initiated}, in-progress={inProgress}, referred=
            {referred}, resolved={resolved}, notStarted={notStarted}
          </p>
        </div>
      )}
    </div>
  );
}
