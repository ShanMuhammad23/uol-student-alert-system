"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import type { AppUser } from "../fetch";
import type { InterventionChartSlice } from "./InterventionSliceContext";

/** Matches `/api/interventions/status` role-scope payload + chart breakdown buckets. */
export type CohortInterventionCounts = {
  initiated: number;
  inProgress: number;
  referred: number;
  resolved: number;
  noActionRequired: number;
  totalInterventionStudents: number;
};

export type InterventionCohortStatsMap = Record<
  InterventionChartSlice,
  CohortInterventionCounts
>;

function emptyCohort(): CohortInterventionCounts {
  return {
    initiated: 0,
    inProgress: 0,
    referred: 0,
    resolved: 0,
    noActionRequired: 0,
    totalInterventionStudents: 0,
  };
}

function defaultMap(): InterventionCohortStatsMap {
  return {
    attendance_yellow: emptyCohort(),
    attendance_red: emptyCohort(),
    gpa_yellow: emptyCohort(),
    gpa_red: emptyCohort(),
  };
}

function roleForInterventionsApi(user: AppUser): "dean" | "hod" | "teacher" | null {
  if (user.role === "dean") return "dean";
  if (user.role === "hod") return "hod";
  if (user.role === "teacher" || user.role === "instructor") return "teacher";
  return null;
}

async function fetchCohortStats(
  signal: AbortSignal,
  user: AppUser,
  interventionType: "attendance" | "gpa",
  alertLevel: "warning" | "critical"
): Promise<CohortInterventionCounts> {
  const role = roleForInterventionsApi(user);
  if (!role) return emptyCohort();

  const facultyIdForRequest = user.role === "dean" ? user.faculty_id ?? null : null;
  const staffIdForRequest =
    user.role === "teacher" || user.role === "instructor" ? user.id ?? null : null;
  const courseIdsForRequest =
    user.role === "teacher" || user.role === "instructor" ? user.course_ids ?? null : null;
  const departmentIdsForRequest = user.role === "hod" ? user.department_ids ?? null : null;

  const res = await fetch("/api/interventions/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role,
      interventionType,
      alertLevel,
      facultyId: facultyIdForRequest,
      departmentIds: departmentIdsForRequest,
      courseIds: courseIdsForRequest,
      staffId: staffIdForRequest,
    }),
    signal,
  });
  if (!res.ok) return emptyCohort();
  const body = (await res.json()) as Partial<CohortInterventionCounts>;
  return {
    initiated: body.initiated ?? 0,
    inProgress: body.inProgress ?? 0,
    referred: body.referred ?? 0,
    resolved: body.resolved ?? 0,
    noActionRequired: body.noActionRequired ?? 0,
    totalInterventionStudents: body.totalInterventionStudents ?? 0,
  };
}

type InterventionCohortStatsContextValue = {
  stats: InterventionCohortStatsMap;
  loading: boolean;
};

const InterventionCohortStatsContext =
  createContext<InterventionCohortStatsContextValue | undefined>(undefined);

export function InterventionCohortStatsProvider({
  user,
  children,
}: {
  user: AppUser | null | undefined;
  children: ReactNode;
}): ReactElement {
  const [stats, setStats] = useState<InterventionCohortStatsMap>(() => defaultMap());
  const [loading, setLoading] = useState(false);

  const departmentIdsKey = useMemo(() => {
    if (user?.role !== "hod") return "";
    return (user?.department_ids ?? []).join(",");
  }, [user?.role, user?.department_ids]);

  const courseIdsKey = useMemo(() => {
    if (user?.role !== "teacher" && user?.role !== "instructor") return "";
    return (user?.course_ids ?? []).join(",");
  }, [user?.role, user?.course_ids]);

  useEffect(() => {
    if (!user?.role || !roleForInterventionsApi(user)) {
      setStats(defaultMap());
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        fetchCohortStats(controller.signal, user, "attendance", "warning"),
        fetchCohortStats(controller.signal, user, "attendance", "critical"),
        fetchCohortStats(controller.signal, user, "gpa", "warning"),
        fetchCohortStats(controller.signal, user, "gpa", "critical"),
      ])
        .then(([aY, aR, gY, gR]) => {
          if (controller.signal.aborted) return;
          setStats({
            attendance_yellow: aY,
            attendance_red: aR,
            gpa_yellow: gY,
            gpa_red: gR,
          });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setStats(defaultMap());
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [
    user,
    user?.role,
    user?.faculty_id,
    user?.id,
    user?.sap_id,
    departmentIdsKey,
    courseIdsKey,
  ]);

  const value = useMemo(() => ({ stats, loading }), [stats, loading]);

  return (
    <InterventionCohortStatsContext.Provider value={value}>
      {children}
    </InterventionCohortStatsContext.Provider>
  );
}

export function useInterventionCohortStats(): InterventionCohortStatsContextValue {
  const ctx = useContext(InterventionCohortStatsContext);
  if (!ctx) {
    throw new Error(
      "useInterventionCohortStats must be used within InterventionCohortStatsProvider"
    );
  }
  return ctx;
}

export function interventionClosedCount(c: CohortInterventionCounts): number {
  return c.resolved + c.noActionRequired;
}
