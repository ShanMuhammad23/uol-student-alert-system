"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EffectivenessScoreRow, EiRating } from "@/lib/effectiveness-scoring";
import { EI_GRADE_LABELS } from "@/lib/ei-metric-definitions";
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
  defaultDimensionType?: "faculty" | "department" | "instructor" | "all";
  showFacultyTab?: boolean;
};

type SortKey =
  | "dimension_name"
  | "ei_score"
  | "login_rate_pct"
  | "intervention_coverage_pct"
  | "attendance_posting_pct"
  | "total_alerts";

const RATING_STYLES: Record<EiRating, string> = {
  A: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700",
  B: "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700",
  C: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  D: "bg-red-100 text-red-800 ring-red-300 dark:bg-red-900/40 dark:text-red-100 dark:ring-red-700",
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

function EiBadge({ rating, score }: { rating: EiRating; score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        RATING_STYLES[rating]
      )}
      title={EI_GRADE_LABELS[rating]}
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
  const [dimensionFilter, setDimensionFilter] = useState<
    "faculty" | "department" | "instructor" | "all"
  >(defaultDimensionType);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ei_score");
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
        avgEi: 0,
        avgLogin: null as number | null,
        avgCoverage: null as number | null,
        totalAlerted: 0,
        ratingCounts: { A: 0, B: 0, C: 0, D: 0 } as Record<EiRating, number>,
      };
    }
    const ratingCounts = { A: 0, B: 0, C: 0, D: 0 } as Record<EiRating, number>;
    let eiSum = 0;
    let loginSum = 0;
    let loginN = 0;
    let coverageSum = 0;
    let coverageN = 0;
    let totalAlerted = 0;
    for (const row of filteredRows) {
      eiSum += row.ei_score;
      ratingCounts[row.ei_rating] += 1;
      totalAlerted += row.total_alerts;
      if (row.login_rate_pct != null) {
        loginSum += row.login_rate_pct;
        loginN += 1;
      }
      if (row.intervention_coverage_pct != null) {
        coverageSum += row.intervention_coverage_pct;
        coverageN += 1;
      }
    }
    return {
      avgEi: eiSum / filteredRows.length,
      avgLogin: loginN ? loginSum / loginN : null,
      avgCoverage: coverageN ? coverageSum / coverageN : null,
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
              <FilterButton
                active={dimensionFilter === "instructor"}
                onClick={() => setDimensionFilter("instructor")}
                label="Instructors"
              />
              <FilterButton
                active={dimensionFilter === "all"}
                onClick={() => setDimensionFilter("all")}
                label="All"
              />
            </>
          ) : (
            <FilterButton
              active={dimensionFilter === "department"}
              onClick={() => setDimensionFilter("department")}
              label="Departments"
            />
          )}
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
          label="Average EI"
          value={summary.avgEi.toFixed(1)}
          hint="Effectiveness Index (0–100)"
          tone={summary.avgEi >= 75 ? "emerald" : summary.avgEi >= 50 ? "amber" : "red"}
        />
        <SummaryCard
          label="Log-in rate"
          value={formatPct(summary.avgLogin)}
          hint="Users active in past 7 days"
        />
        <SummaryCard
          label="Intervention coverage"
          value={formatPct(summary.avgCoverage)}
          hint="Alerts with intervention started"
        />
        <SummaryCard
          label="Students in alert"
          value={summary.totalAlerted.toLocaleString()}
          hint={`${summary.ratingCounts.A} A · ${summary.ratingCounts.B} B · ${summary.ratingCounts.C} C · ${summary.ratingCounts.D} D`}
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
                  <button type="button" onClick={() => toggleSort("ei_score")} className="inline-flex items-center gap-1">
                    EI {sortIndicator("ei_score")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("login_rate_pct")} className="inline-flex items-center gap-1">
                    Login {sortIndicator("login_rate_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("attendance_posting_pct")} className="inline-flex items-center gap-1">
                    Attendance {sortIndicator("attendance_posting_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("intervention_coverage_pct")} className="inline-flex items-center gap-1">
                    Coverage {sortIndicator("intervention_coverage_pct")}
                  </button>
                </th>
                <th className="px-4 py-3">TTFA</th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("total_alerts")} className="inline-flex items-center gap-1">
                    Alerted {sortIndicator("total_alerts")}
                  </button>
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
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
        <p className="font-semibold text-slate-700 dark:text-slate-300">How EI is calculated</p>
        <p className="mt-2">
          Effectiveness Index follows the official criteria: Log-in rate (15%), Attendance posting
          (25%), Faculty intervention process (35%), and Wellbeing intervention (25%). Grades: A ≥
          90%, B ≥ 75%, C ≥ 50%, D &lt; 50%.
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
          <EiBadge rating={row.ei_rating} score={row.ei_score} />
        </td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.login_rate_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.attendance_posting_pct)}</td>
        <td className="px-4 py-3 tabular-nums">{formatPct(row.intervention_coverage_pct)}</td>
        <td className="px-4 py-3 tabular-nums">
          {formatDays(row.median_days_to_first_action)}
        </td>
        <td className="px-4 py-3 tabular-nums">{row.total_alerts}</td>
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
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.values(row.criteria_breakdown).map((criterion) => (
                <div
                  key={criterion.code}
                  className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  title={`${criterion.tooltip}\n\nFormula: ${criterion.formula}\nPI: ${criterion.piTarget}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {criterion.label}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {(criterion.contribution * 100).toFixed(1)} pts
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {criterion.denominator > 0
                      ? `${criterion.numerator}/${criterion.denominator}`
                      : "—"}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      score {(criterion.score * 100).toFixed(0)}%
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {criterion.piTarget}
                  </p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
