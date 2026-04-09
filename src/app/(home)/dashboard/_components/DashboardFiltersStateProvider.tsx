"use client";

import { useMemo, useState, type ReactNode } from "react";

import { DashboardFilterProvider } from "./DashboardFilterContext";
import type { MasterFilterParams } from "@/lib/enrollment";
import type { AlertDimensionFilter } from "../fetch";

type Props = {
  initial: {
    masterFilter: MasterFilterParams;
    gpaFilters: AlertDimensionFilter[];
    attendanceFilters: AlertDimensionFilter[];
    classStatusFilters: string[];
    interventionFilters: string[];
    resolutionFilters: string[];
  };
  children: ReactNode;
};

/**
 * Single owner of dashboard filter state.
 * Used to make top-to-bottom selections update the same source of truth (client-only).
 */
export function DashboardFiltersStateProvider({
  initial,
  children,
}: Props) {
  const [masterFilter, setMasterFilter] = useState<MasterFilterParams>(
    initial.masterFilter,
  );
  const [gpaFilters, setGpaFilters] = useState<AlertDimensionFilter[]>(
    initial.gpaFilters,
  );
  const [attendanceFilters, setAttendanceFilters] =
    useState<AlertDimensionFilter[]>(initial.attendanceFilters);
  const [classStatusFilters, setClassStatusFilters] = useState<string[]>(
    initial.classStatusFilters
  );
  const [interventionFilters, setInterventionFilters] = useState<string[]>(
    initial.interventionFilters,
  );
  const [resolutionFilters, setResolutionFilters] = useState<string[]>(
    initial.resolutionFilters,
  );

  const value = useMemo(
    () => ({
      masterFilter,
      gpaFilters,
      attendanceFilters,
      classStatusFilters,
      interventionFilters,
      resolutionFilters,
      setMasterFilter,
      setGpaFilters,
      setAttendanceFilters,
      setClassStatusFilters,
      setInterventionFilters,
      setResolutionFilters,
    }),
    [
      masterFilter,
      gpaFilters,
      attendanceFilters,
      classStatusFilters,
      interventionFilters,
      resolutionFilters,
    ],
  );

  return <DashboardFilterProvider value={value}>{children}</DashboardFilterProvider>;
}

