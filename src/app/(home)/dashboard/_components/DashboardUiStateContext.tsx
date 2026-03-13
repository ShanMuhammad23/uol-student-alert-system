"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ViewMode = "table" | "nested";

type DashboardUiState = {
  viewMode: ViewMode;
  setViewMode: (view: ViewMode) => void;
  expandedIds: string[];
  isExpanded: (id: string) => boolean;
  toggleExpanded: (id: string) => void;
  setExpandedIds: (ids: string[]) => void;
};

const DashboardUiStateContext = createContext<DashboardUiState | undefined>(
  undefined,
);

type ProviderProps = {
  children: ReactNode;
  initialViewMode: ViewMode;
  initialExpandedIds?: string[];
};

export function DashboardUiStateProvider({
  children,
  initialViewMode,
  initialExpandedIds = [],
}: ProviderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [expandedIds, setExpandedIds] = useState<string[]>(initialExpandedIds);

  const isExpanded = useCallback(
    (id: string) => expandedIds.includes(id),
    [expandedIds],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const value = useMemo<DashboardUiState>(
    () => ({
      viewMode,
      setViewMode,
      expandedIds,
      isExpanded,
      toggleExpanded,
      setExpandedIds,
    }),
    [expandedIds, isExpanded, toggleExpanded, viewMode],
  );

  return (
    <DashboardUiStateContext.Provider value={value}>
      {children}
    </DashboardUiStateContext.Provider>
  );
}

export function useDashboardUiState(): DashboardUiState {
  const ctx = useContext(DashboardUiStateContext);
  if (!ctx) {
    throw new Error(
      "useDashboardUiState must be used within a DashboardUiStateProvider",
    );
  }
  return ctx;
}

