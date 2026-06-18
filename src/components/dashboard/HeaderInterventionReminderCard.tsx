"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import { cn } from "@/lib/utils";

type ReminderResponse = {
  openOutOfAlertCount: number;
  totalIntervenedCount: number;
};

function shouldShowForUser(
  user: AppUser | null | undefined,
  pathname: string,
  asParam: string | null,
  facultyParam: string | null
): boolean {
  if (!user) return false;
  if (pathname !== "/dashboard") return false;
  if (user.role === "dean" || user.role === "hod") return true;
  if (user.role === "instructor" || user.role === "teacher") return true;
  if (
    user.role === "superadmin" &&
    asParam === "dean" &&
    facultyParam
  ) {
    return true;
  }
  return false;
}

export function HeaderInterventionReminderCard({ user }: { user?: AppUser | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asParam = searchParams.get("as");
  const facultyParam = searchParams.get("faculty");

  const [data, setData] = useState<ReminderResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const visible = shouldShowForUser(user, pathname, asParam, facultyParam);

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (
      user?.role === "superadmin" &&
      pathname === "/dashboard" &&
      asParam === "dean" &&
      facultyParam
    ) {
      params.set("faculty", facultyParam);
    }
    const qs = params.toString();
    return `/api/dashboard/header-intervention-reminder${qs ? `?${qs}` : ""}`;
  }, [user?.role, pathname, asParam, facultyParam]);

  const load = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        setData(null);
        return;
      }
      const body = (await res.json()) as ReminderResponse;
      setData(body);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, visible]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!visible) return null;

  const count = data?.openOutOfAlertCount ?? 0;
  if (!loading && count === 0) return null;

  return (
    <div
      className={cn(
        "hidden max-w-[280px] shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 sm:block",
        "dark:border-amber-900/50 dark:bg-amber-950/40"
      )}
      title="Students with open intervention cases who are no longer in alert"
    >
      {loading && !data ? (
        <p className="text-xs text-amber-700/70 dark:text-amber-300/70">Loading…</p>
      ) : (
        <p className="text-[11px] leading-snug text-amber-900 dark:text-amber-100">
          <span className="text-base font-extrabold tabular-nums">{count}</span>
          {" of your intervened students are out of alert but cases are still open. "}
          <span className="font-medium">Please close them if necessary.</span>
        </p>
      )}
    </div>
  );
}
