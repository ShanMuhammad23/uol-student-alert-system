"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "filterScrollY";
const RETURN_FROM_STUDENT_SCROLL_KEY = "dashboardReturnScrollY";

/**
 * Call this before programmatic filter navigation (router.push/replace)
 * so we can restore scroll after the page re-renders.
 */
export function saveScrollBeforeFilterNav() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(window.scrollY));
  } catch {
    // ignore
  }
}

/** Save dashboard scroll before navigating to a student profile page. */
export function saveScrollBeforeStudentProfileNav() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      RETURN_FROM_STUDENT_SCROLL_KEY,
      String(window.scrollY)
    );
  } catch {
    // ignore
  }
}

/**
 * Renders nothing. When searchParams change and we have a saved scroll position
 * (from saveScrollBeforeFilterNav), restores it so the page doesn't jump to top.
 */
export function FilterScrollPreserve() {
  const searchParams = useSearchParams();
  const serialized = searchParams.toString();
  const prevSerialized = useRef(serialized);
  const isInitial = useRef(true);

  useEffect(() => {
    // Restore scroll when returning from student profile to dashboard.
    let y: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(RETURN_FROM_STUDENT_SCROLL_KEY);
      if (raw != null) {
        window.sessionStorage.removeItem(RETURN_FROM_STUDENT_SCROLL_KEY);
        y = parseInt(raw, 10);
      }
    } catch {
      // ignore
    }
    if (y === null || !Number.isFinite(y)) return;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y!, behavior: "smooth" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    // Skip the first mount (initial load) so we don't restore on fresh load with query params
    if (isInitial.current) {
      isInitial.current = false;
      prevSerialized.current = serialized;
      return;
    }
    if (serialized === prevSerialized.current) return;
    prevSerialized.current = serialized;

    let y: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw != null) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        y = parseInt(raw, 10);
      }
    } catch {
      // ignore
    }

    if (y === null || !Number.isFinite(y)) return;

    // Restore after paint so layout is complete
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y!);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [serialized]);

  return null;
}
