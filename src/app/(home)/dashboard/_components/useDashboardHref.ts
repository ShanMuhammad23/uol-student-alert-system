"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useMergeDashboardHref() {
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined) continue;
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const q = p.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [pathname, searchParams]
  );
}
