"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Which alert cohort the intervention chart should break down (matches overview card counts). */
export type InterventionChartSlice =
  | "attendance_yellow"
  | "attendance_red"
  | "gpa_yellow"
  | "gpa_red";

type InterventionSliceContextValue = {
  slice: InterventionChartSlice | null;
  setSlice: (slice: InterventionChartSlice | null) => void;
  clearSlice: () => void;
};

const InterventionSliceContext =
  createContext<InterventionSliceContextValue | undefined>(undefined);

export function InterventionSliceProvider({ children }: { children: ReactNode }) {
  const [slice, setSliceState] = useState<InterventionChartSlice | null>(null);

  const setSlice = useCallback((next: InterventionChartSlice | null) => {
    setSliceState(next);
  }, []);

  const clearSlice = useCallback(() => setSliceState(null), []);

  const value = useMemo(
    () => ({ slice, setSlice, clearSlice }),
    [slice, setSlice, clearSlice]
  );

  return (
    <InterventionSliceContext.Provider value={value}>
      {children}
    </InterventionSliceContext.Provider>
  );
}

export function useInterventionSlice() {
  const ctx = useContext(InterventionSliceContext);
  if (!ctx) {
    throw new Error("useInterventionSlice must be used within InterventionSliceProvider");
  }
  return ctx;
}
