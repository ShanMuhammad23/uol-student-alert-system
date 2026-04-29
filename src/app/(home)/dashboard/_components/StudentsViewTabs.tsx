"use client";

import { cn } from "@/lib/utils";
import { useDashboardUiState } from "./DashboardUiStateContext";
import { useRef, useState, useEffect, useCallback } from "react";

type Props = {
  className?: string;
};

type TabConfig = {
  id: string;
  label: React.ReactNode;
  viewMode: string;
  badge?: number | null;
};

export function StudentsViewTabs({ className }: Props) {
  const { viewMode, setViewMode, attendanceMissingTotal } = useDashboardUiState();
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const tabs: TabConfig[] = [
    { id: "table", label: "Table view", viewMode: "table" },
    { id: "nested", label: "Nested view", viewMode: "nested" },
    {
      id: "attendance-missing",
      label: "Attendance Missing",
      viewMode: "attendance-missing",
      badge: attendanceMissingTotal,
    },
    {
      id: "intervention-search",
      label: "Search Intervention By Student Number",
      viewMode: "intervention-search",
    },
    {
      id: "intervention-teacher-search",
      label: "Search Intervention By Teacher Name or Pernr",
      viewMode: "intervention-teacher-search",
    },
  ];

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeIndex = tabs.findIndex((t) => t.viewMode === viewMode);
    const tabButtons = container.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    const activeButton = tabButtons[activeIndex];
    
    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [viewMode, tabs]);

  useEffect(() => {
    updateIndicator();
    const handleResize = () => updateIndicator();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateIndicator]);

  const activeIndex = tabs.findIndex((t) => t.viewMode === viewMode);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center rounded-xl border border-stroke/60 bg-gray-100/80 p-1.5 backdrop-blur-sm dark:border-dark-3/60 dark:bg-dark-2/80",
        className,
      )}
      role="tablist"
      aria-label="Students list view"
    >
      {/* Sliding Active Background */}
      <div
        className="absolute top-1.5 h-[calc(100%-12px)] rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:bg-gray-dark dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:ring-white/10"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transform: hoveredIndex !== null && hoveredIndex !== activeIndex 
            ? "scale(0.96)" 
            : "scale(1)",
        }}
        aria-hidden="true"
      />

      {tabs.map((tab, index) => {
        const isActive = viewMode === tab.viewMode;
        const isHovered = hoveredIndex === index;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setViewMode(tab.viewMode as any)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={cn(
              "relative z-10 flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-dark-2",
              isActive
                ? "text-primary dark:text-primary"
                : "text-dark-6 hover:text-dark dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span className={cn(
                "transition-transform duration-200",
                isHovered && !isActive && "translate-y-[-0.5px]",
              )}>
                {tab.label}
              </span>
              
              {typeof tab.badge === "number" && (
                <span
                  className={cn(
                    "inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none transition-all duration-300",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "bg-red-50 text-red-600 ring-1 ring-red-100 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800/50",
                    tab.badge > 0 && !isActive && "animate-pulse",
                  )}
                  aria-label={`Total missing attendance ${tab.badge}`}
                >
                  {tab.badge.toLocaleString()}
                </span>
              )}
            </span>

            {/* Subtle hover glow for inactive tabs */}
            {!isActive && isHovered && (
              <span className="absolute inset-0 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] transition-opacity duration-200" />
            )}
          </button>
        );
      })}
    </div>
  );
}