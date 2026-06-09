"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EffectivenessScoreRow, FeiRating } from "@/lib/effectiveness";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { cn } from "@/lib/utils";

function displayDimensionName(row: EffectivenessScoreRow): string {
  if (row.dimension_type === "faculty") {
    return (
      resolveFacultyNameFromIdOrName(row.dimension_id, row.dimension_name) ??
      row.dimension_name
    );
  }
  return row.dimension_name;
}

type Props = {
  initialRows: EffectivenessScoreRow[];
  initialSnapshotDate: string;
  defaultDimensionType?: "faculty" | "department" | "all";
  showFacultyTab?: boolean;
};

type SortKey =
  | "dimension_name"
  | "fei_score"
  | "intervention_coverage_pct"
  | "alert_recovery_pct"
  | "wellbeing_uptake_pct"
  | "alerted_students";

const RATING_STYLES: Record<FeiRating, string> = {
  A: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700",
  B: "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700",
  C: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  D: "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-900/40 dark:text-orange-100 dark:ring-orange-700",
  E: "bg-red-100 text-red-800 ring-red-300 dark:bg-red-900/40 dark:text-red-100 dark:ring-red-700",
};

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}d`;
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "emerald" | "amber" | "red";
}) {
  const tones = {
    neutral: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50",
    emerald: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20",
    amber: "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20",
    red: "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20",
  };
  return (
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function FeiBadge({ rating, score }: { rating: FeiRating; score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        RATING_STYLES[rating]
      )}
    >
      <span>{rating}</span>
      <span className="font-normal opacity-80">{score.toFixed(0)}</span>
    </span>
  );
}

export function EffectivenessPanelClient({
  initialRows,
  initialSnapshotDate,
  defaultDimensionType = "department",
  showFacultyTab = false,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [snapshotDate, setSnapshotDate] = useState(initialSnapshotDate);
  const [dimensionFilter, setDimensionFilter] = useState<"faculty" | "department" | "all">(
    defaultDimensionType
  );
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("fei_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/effectiveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live,
          dimensionType:
            dimensionFilter === "all" ? undefined : dimensionFilter,
        }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        rows: EffectivenessScoreRow[];
        snapshotDate: string;
      };
      setRows(body.rows ?? []);
      setSnapshotDate(body.snapshotDate ?? initialSnapshotDate);
    } finally {
      setLoading(false);
    }
  }, [live, dimensionFilter, initialSnapshotDate]);

  useEffect(() => {
    if (!live) return;
    void refresh();
  }, [live, dimensionFilter, refresh]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (dimensionFilter !== "all") {
      list = list.filter((r) => r.dimension_type === dimensionFilter);
    }
    return [...list].sort((a, b) => {
      if (sortKey === "dimension_name") {
        const av = displayDimensionName(a);
        const bv = displayDimensionName(b);
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(a[sortKey] ?? 0);
      const bn = Number(b[sortKey] ?? 0);
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [rows, dimensionFilter, sortKey, sortDir]);

  const summary = useMemo(() => {
    if (!filteredRows.length) {
      return {
        avgFei: 0,
        avgCoverage: null as number | null,
        avgRecovery: null as number | null,
        totalAlerted: 0,
        ratingCounts: { A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<FeiRating, number>,
      };
    }
    const ratingCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 } as Record<FeiRating, number>;
    let feiSum = 0;
    let coverageSum = 0;
    let coverageN = 0;
    let recoverySum = 0;
    let recoveryN = 0;
    let totalAlerted = 0;
    for (const row of filteredRows) {
      feiSum += row.fei_score;
      ratingCounts[row.fei_rating] += 1;
      totalAlerted += row.alerted_students;
      if (row.intervention_coverage_pct != null) {
        coverageSum += row.intervention_coverage_pct;
        coverageN += 1;
      }
      if (row.alert_recovery_pct != null) {
        recoverySum += row.alert_recovery_pct;
        recoveryN += 1;
      }
    }
    return {
      avgFei: feiSum / filteredRows.length,
      avgCoverage: coverageN ? coverageSum / coverageN : null,
      avgRecovery: recoveryN ? recoverySum / recoveryN : null,
      totalAlerted,
      ratingCounts,
    };
  }, [filteredRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {showFacultyTab ? (
            <>
              <FilterButton
                active={dimensionFilter === "faculty"}
                onClick={() => setDimensionFilter("faculty")}
                label="Faculties"
              />
              <FilterButton
                active={dimensionFilter === "department"}
                onClick={() => setDimensionFilter("department")}
                label="Departments"
              />
            </>
          ) : (
            <FilterButton
              active={dimensionFilter === "department"}
              onClick={() => setDimensionFilter("department")}
              label="Departments"
            />
          )}
          {showFacultyTab ? (
            <FilterButton
              active={dimensionFilter === "all"}
              onClick={() => setDimensionFilter("all")}
              label="All"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Snapshot: <span className="font-medium">{snapshotDate}</span>
            {live ? " (live)" : ""}
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Live compute
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Average FEI"
          value={summary.avgFei.toFixed(1)}
          hint="Faculty Effectiveness Index (0–100)"
          tone={
            summary.avgFei >= 70 ? "emerald" : summary.avgFei >= 55 ? "amber" : "red"
          }
        />
        <SummaryCard
          label="Intervention coverage"
          value={formatPct(summary.avgCoverage)}
          hint="Alerted students reached"
        />
        <SummaryCard
          label="Alert recovery"
          value={formatPct(summary.avgRecovery)}
          hint="Intervened students no longer in alert"
        />
        <SummaryCard
          label="Students in alert"
          value={summary.totalAlerted.toLocaleString()}
          hint={`${summary.ratingCounts.A} A · ${summary.ratingCounts.B} B · ${summary.ratingCounts.C} C`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("dimension_name")} className="inline-flex items-center gap-1">
                    Entity {sortIndicator("dimension_name")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("fei_score")} className="inline-flex items-center gap-1">
                    FEI {sortIndicator("fei_score")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("intervention_coverage_pct")} className="inline-flex items-center gap-1">
                    Coverage {sortIndicator("intervention_coverage_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">Critical cov.</th>
                <th className="px-4 py-3">TTFC</th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("wellbeing_uptake_pct")} className="inline-flex items-center gap-1">
                    Wellbeing {sortIndicator("wellbeing_uptake_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("alert_recovery_pct")} className="inline-flex items-center gap-1">
                    Recovery {sortIndicator("alert_recovery_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("alerted_students")} className="inline-flex items-center gap-1">
                    Alerted {sortIndicator("alerted_students")}
                  </button>
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No effectiveness data yet. Run the nightly ETL or enable live compute.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const rowKey = `${row.dimension_type}:${row.dimension_id}`;
                  const isOpen = expandedId === rowKey;
                  return (
                    <RowGroup
                      key={rowKey}
                      row={row}
                      isOpen={isOpen}
                      onToggle={() => setExpandedId(isOpen ? null : rowKey)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">How FEI is calculated</p>
        <p className="mt-2">
          FEI weights student outcomes (30%), wellbeing pathway (25%), response timeliness &amp; coverage (25%),
          data readiness via attendance posting (10%), and sustained recovery / repeat-alert control (10%).
          Ratings: A ≥85, B ≥70, C ≥55, D ≥40, E &lt;40.
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
      )}
    >
      {label}
    </button>
  );
}

function RowGroup({
  row,
  isOpen,
  onToggle,
}: {
  row: EffectivenessScoreRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const displayName = displayDimensionName(row);

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-900 dark:text-white">{displayName}</div>
          <div className="text-xs capitalize text-slate-500">{row.dimension_type}</div>
        </td>
        <td className="px-4 py-3">
          <FeiBadge rating={row.fei_rating} score={row.fei_score} />
        </td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.intervention_coverage_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.critical_coverage_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{formatDays(row.median_days_to_contact)}</td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.wellbeing_uptake_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.alert_recovery_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{row.alerted_students}</td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="text-slate-400 hover:text-emerald-600"
            aria-expanded={isOpen}
          >
            {isOpen ? "▾" : "▸"}
          </button>
        </td>
      </tr>
      {isOpen ? (
        <tr className="bg-slate-50/80 dark:bg-slate-900/40">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Response score" value={row.response_score.toFixed(1)} />
              <Detail label="Wellbeing score" value={row.wellbeing_score.toFixed(1)} />
              <Detail label="Outcome score" value={row.outcome_score.toFixed(1)} />
              <Detail label="Readiness score" value={row.readiness_score.toFixed(1)} />
              <Detail label="Referred students" value={String(row.referred_students)} />
              <Detail label="Wellbeing linked" value={String(row.wellbeing_linked_students)} />
              <Detail label="Repeat alerts" value={String(row.repeat_alert_students)} />
              <Detail label="Stale interventions" value={String(row.stale_interventions)} />
              <Detail label="Attendance posting" value={formatPct(row.attendance_posting_pct)} />
              <Detail label="Referral rate" value={formatPct(row.referral_rate_pct)} />
              <Detail label="Repeat alert %" value={formatPct(row.repeat_alert_pct)} />
              <Detail label="Enrolled students" value={String(row.total_students)} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
