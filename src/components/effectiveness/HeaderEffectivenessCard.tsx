"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import type { EffectivenessScoreRow } from "@/lib/effectiveness-scoring";
import { EI_GRADE_LABELS } from "@/lib/ei-metric-definitions";
import { FEI_GRADE_CONFIG } from "@/lib/fei-rating-styles";
import { Sheet } from "@/components/ui/sheet";
import { EffectivenessDetailMulti } from "./EffectivenessDetailContent";
import { cn } from "@/lib/utils";

type HeaderEffectivenessResponse = {
  snapshotDate: string;
  rows: EffectivenessScoreRow[];
  summary?: {
    eiScore: number;
    eiRating: EffectivenessScoreRow["ei_rating"];
    label: string;
  };
};

function shouldShowForUser(
  user: AppUser | null | undefined,
  pathname: string,
  asParam: string | null,
  facultyParam: string | null
): boolean {
  if (!user) return false;
  if (user.role === "dean" || user.role === "hod") return true;
  if (user.role === "instructor" || user.role === "teacher") return true;
  if (
    user.role === "superadmin" &&
    pathname === "/dashboard" &&
    asParam === "dean" &&
    facultyParam
  ) {
    return true;
  }
  return false;
}

export function HeaderEffectivenessCard({ user }: { user?: AppUser | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asParam = searchParams.get("as");
  const facultyParam = searchParams.get("faculty");

  const [data, setData] = useState<HeaderEffectivenessResponse | null>(null);
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
    return `/api/dashboard/header-effectiveness${qs ? `?${qs}` : ""}`;
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
      const body = (await res.json()) as HeaderEffectivenessResponse;
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

  const summary = data?.summary;
  const gradeCfg = summary ? FEI_GRADE_CONFIG[summary.eiRating] : null;

  return (
    <>
      <div
        className={cn(
          "hidden shrink-0 rounded-lg border px-3 py-2 sm:block",
          gradeCfg
            ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60"
            : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
        )}
        style={
          gradeCfg
            ? { borderColor: `${gradeCfg.color}33`, background: gradeCfg.bg }
            : undefined
        }
      >
        <div className="flex items-center gap-3 relative">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Effectiveness
            </p>
            {loading && !summary ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : summary && gradeCfg ? (
              <>
                <p
                  className="text-base font-extrabold leading-none tabular-nums"
                  style={{ color: gradeCfg.color }}
                >
                   {Math.round(summary.eiScore)}
                  <span className="ml-1.5 text-lg font-bold">{summary.eiRating} </span>
                </p>
               
              </>
            ) : (
              <p className="text-xs text-slate-400">No data yet</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!data?.rows?.length}
            className="whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            See details
          </button>
        </div>
      </div>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Effectiveness Index"
        description={
          summary
            ? `${summary.label} · ${EI_GRADE_LABELS[summary.eiRating]} · snapshot ${data?.snapshotDate ?? "—"}`
            : undefined
        }
      >
        {data?.rows?.length ? (
          <EffectivenessDetailMulti
            rows={data.rows}
            snapshotDate={data.snapshotDate}
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No effectiveness scores available for your scope yet. Run the effectiveness
            ETL or use live compute from the Effectiveness page.
          </p>
        )}
      </Sheet>
    </>
  );
}
