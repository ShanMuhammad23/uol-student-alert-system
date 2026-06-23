"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type InterventionOpenOutOfAlertRow = {
  sapId: string;
  studentName: string;
  addedByName: string;
  status: string;
};

type ReminderResponse = {
  openOutOfAlertCount: number;
  totalIntervenedCount: number;
  rows: InterventionOpenOutOfAlertRow[];
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

function formatStatus(status: string): string {
  if (status === "in-progress") return "In-Progress";
  if (status === "no-action-required") return "No Action Required";
  return status
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function HeaderInterventionReminderCard({ user }: { user?: AppUser | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asParam = searchParams.get("as");
  const facultyParam = searchParams.get("faculty");

  const [data, setData] = useState<ReminderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
      setData({
        openOutOfAlertCount: Number(body.openOutOfAlertCount ?? 0),
        totalIntervenedCount: Number(body.totalIntervenedCount ?? 0),
        rows: Array.isArray(body.rows) ? body.rows : [],
      });
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

  const rows = data?.rows ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading && !data}
        className={cn(
          "hidden max-w-[300px] shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition",
          "hover:border-amber-300 hover:bg-amber-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
          "disabled:cursor-wait disabled:opacity-70 sm:block",
          "dark:border-amber-900/50 dark:bg-amber-950/40 dark:hover:border-amber-800 dark:hover:bg-amber-950/60"
        )}
        title="View open interventions for students no longer in alert"
      >
        {loading && !data ? (
          <p className="text-xs text-amber-700/70 dark:text-amber-300/70">Loading…</p>
        ) : (
          <p className="text-[11px] leading-snug text-amber-900 dark:text-amber-100">
            <span className="text-base font-extrabold tabular-nums">{count}</span>
            {" of your intervened students are out of alert but cases are still open. "}
            <span className="font-medium underline decoration-amber-600/50 underline-offset-2">
              Tap to view list
            </span>
          </p>
        )}
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Open interventions — out of alert"
        description={`${count} student${count === 1 ? "" : "s"} with initiated, in-progress, or referred cases and no current alert.`}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No open cases to show.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">SAP ID</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Added by</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.sapId}
                    className="text-slate-800 dark:text-slate-200"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                      {row.sapId}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{row.studentName}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.addedByName}
                    </td>
                    <td className="px-3 py-2.5 text-xs capitalize text-slate-600 dark:text-slate-400">
                      {formatStatus(row.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </>
  );
}
