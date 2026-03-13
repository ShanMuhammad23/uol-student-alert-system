"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useDashboardUiState } from "./DashboardUiStateContext";

type Props = { children: ReactNode };

/**
 * Wraps the student list so that when a <details> summary is clicked,
 * we update the shared expandedIds state instead of mutating the URL.
 * Each details must have data-section-id set.
 */
export function ExpandableListUrlSync({ children }: Props) {
  const { toggleExpanded } = useDashboardUiState();
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "SUMMARY") return;
      const details = target.closest("details");
      const id = details?.getAttribute("data-section-id");
      if (!id) return;
      e.preventDefault();
      toggleExpanded(id);
    },
    [toggleExpanded],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("click", handleClick as EventListener);
    return () => el.removeEventListener("click", handleClick as EventListener);
  }, [handleClick]);

  return <div ref={ref}>{children}</div>;
}

