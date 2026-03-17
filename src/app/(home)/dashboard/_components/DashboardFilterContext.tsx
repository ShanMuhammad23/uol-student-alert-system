"use client";

import {
  createContext,
  useContext,
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
  interventionFilters: string[];
  resolutionFilters: string[];
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

