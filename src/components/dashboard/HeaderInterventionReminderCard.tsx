"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type InterventionOpenOutOfAlertRow = {
  sapId: string;
  studentName: string;
  addedByName: string;
  status: string;
  interventionId: string;
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
  const [remindState, setRemindState] = useState<
    Record<string, "sending" | "sent" | "error">
  >({});

  const visible = shouldShowForUser(user, pathname, asParam, facultyParam);
  const canRemind =
    user?.role === "dean" ||
    user?.role === "hod" ||
    user?.role === "superadmin";

  const remindInitiator = useCallback(
    async (interventionId: string) => {
      if (!interventionId) return;
      setRemindState((prev) => ({ ...prev, [interventionId]: "sending" }));
      try {
        const res = await fetch(
          "/api/dashboard/header-intervention-reminder/remind",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interventionId,
              faculty: facultyParam ?? undefined,
            }),
          }
        );
        setRemindState((prev) => ({
          ...prev,
          [interventionId]: res.ok ? "sent" : "error",
        }));
      } catch {
        setRemindState((prev) => ({ ...prev, [interventionId]: "error" }));
      }
    },
    [facultyParam]
  );

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
          "hidden h-12 max-w-[13.5rem] shrink-0 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-left transition xl:block 2xl:max-w-[16.5rem]",
          "hover:border-amber-300 hover:bg-amber-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
          "disabled:cursor-wait disabled:opacity-70",
          "dark:border-amber-900/50 dark:bg-amber-950/40 dark:hover:border-amber-800 dark:hover:bg-amber-950/60"
        )}
        title="View open interventions for students no longer in alert"
      >
        {loading && !data ? (
          <p className="text-[11px] leading-tight text-amber-700/70 dark:text-amber-300/70">
            Loading…
          </p>
        ) : (
          <p className="line-clamp-2 text-[11px] leading-snug text-amber-900 dark:text-amber-100">
            <span className="text-sm font-extrabold tabular-nums">{count}</span>
            {" out of alert — cases still open. "}
            <span className="font-medium underline decoration-amber-600/50 underline-offset-2">
              View
            </span>
          </p>
        )}
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        className="w-auto max-w-2xl"
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
                  <th className="px-3 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Added by</th>
                  <th className="px-3 py-2.5">Status</th>
                  {canRemind ? (
                    <th className="px-3 py-2.5">Remind Initiator</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.sapId}
                    className="text-slate-800 dark:text-slate-200"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/students/${encodeURIComponent(row.sapId)}`}
                        onClick={() => setOpen(false)}
                        className="block truncate font-medium outline-none hover:text-emerald-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary dark:hover:text-emerald-400"
                      >
                        {row.studentName}
                      </Link>
                      <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {row.sapId}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.addedByName}
                    </td>
                    <td className="px-3 py-2.5 text-xs capitalize text-slate-600 dark:text-slate-400">
                      {formatStatus(row.status)}
                    </td>
                    {canRemind ? (
                      <td className="px-3 py-2.5">
                        {(() => {
                          const state = remindState[row.interventionId];
                          if (state === "sent") {
                            return (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                Sent
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              disabled={state === "sending"}
                              onClick={() =>
                                void remindInitiator(row.interventionId)
                              }
                              title={
                                state === "error"
                                  ? "Failed to send — click to retry"
                                  : `Email ${row.addedByName} to resolve this case`
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                                state === "error"
                                  ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                              )}
                            >
                              <BellRing className="size-3.5" aria-hidden />
                              {state === "sending"
                                ? "Sending…"
                                : state === "error"
                                  ? "Retry"
                                  : "Remind"}
                            </button>
                          );
                        })()}
                      </td>
                    ) : null}
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
