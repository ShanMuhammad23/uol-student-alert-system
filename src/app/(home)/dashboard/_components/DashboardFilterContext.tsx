"use client";

import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import type {
  MasterFilterParams,
} from "@/lib/enrollment";
import type { AlertDimensionFilter } from "../fetch";

type DashboardFilterContextValue = {
  masterFilter: MasterFilterParams;
  gpaFilters: AlertDimensionFilter[];
  attendanceFilters: AlertDimensionFilter[];
  classStatusFilters: string[];
  interventionFilters: string[];
  resolutionFilters: string[];
  // Setters are optional so existing providers (that only pass values)
  // don't need to be updated all at once.
  setMasterFilter?: Dispatch<SetStateAction<MasterFilterParams>>;
  setGpaFilters?: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setAttendanceFilters?: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setClassStatusFilters?: Dispatch<SetStateAction<string[]>>;
  setInterventionFilters?: Dispatch<SetStateAction<string[]>>;
  setResolutionFilters?: Dispatch<SetStateAction<string[]>>;
};

const DashboardFilterContext =
  createContext<DashboardFilterContextValue | undefined>(undefined);

type ProviderProps = {
  value: DashboardFilterContextValue;
  children: ReactNode;
};

export function DashboardFilterProvider({ value, children }: ProviderProps) {
  return (
    <DashboardFilterContext.Provider value={value}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  return useContext(DashboardFilterContext);
}

