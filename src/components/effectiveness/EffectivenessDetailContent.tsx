"use client";

import type { EffectivenessScoreRow } from "@/lib/effectiveness-scoring";
import { EI_GRADE_LABELS } from "@/lib/ei-metric-definitions";
import { FEI_GRADE_CONFIG } from "@/lib/fei-rating-styles";

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} days`;
}

function categoryTotals(row: EffectivenessScoreRow) {
  const totals = { A: 0, B: 0, C: 0, D: 0 };
  for (const c of Object.values(row.criteria_breakdown)) {
    totals[c.code[0] as keyof typeof totals] += c.contribution;
  }
  return [
    { key: "A", label: "Log-in rate", pts: totals.A * 100, max: 15 },
    { key: "B", label: "Attendance posting", pts: totals.B * 100, max: 25 },
    { key: "C", label: "Faculty intervention", pts: totals.C * 100, max: 35 },
    { key: "D", label: "Wellbeing intervention", pts: totals.D * 100, max: 25 },
  ];
}

function criterionDisplayValue(
  row: EffectivenessScoreRow,
  code: keyof EffectivenessScoreRow["criteria_breakdown"]
): string {
  switch (code) {
    case "A_login":
      return formatPct(row.login_rate_pct);
    case "B_attendance":
      return formatPct(row.attendance_posting_pct);
    case "C1_ttfa":
      if (row.median_days_to_first_action != null) {
        return formatDays(row.median_days_to_first_action);
      }
      if (row.total_alerts <= 0) return "No alerts";
      if (row.alerts_with_intervention <= 0) return "No intervention yet";
      return "Pending measurement";
    case "C2_coverage":
      return formatPct(row.intervention_coverage_pct);
    case "C3_case_progression":
      return formatPct(row.faculty_case_progression_pct);
    case "C4_resolution":
      return formatPct(row.faculty_resolution_pct);
    case "D1_uptake":
      if (row.wb_referred_cases <= 0) return "No WB referrals";
      if (row.median_days_to_wb_uptake != null) {
        return formatDays(row.median_days_to_wb_uptake);
      }
      return "Pending measurement";
    case "D2_wb_progression":
      if (row.wb_referred_cases <= 0) return "No WB referrals";
      return formatPct(row.wb_case_progression_pct);
    case "D3_wb_resolution":
      if (row.wb_referred_cases <= 0) return "No WB referrals";
      return formatPct(row.wb_resolution_pct);
    default:
      return "—";
  }
}

function criterionDetailLine(
  row: EffectivenessScoreRow,
  criterion: EffectivenessScoreRow["criteria_breakdown"][keyof EffectivenessScoreRow["criteria_breakdown"]]
): string {
  if (criterion.code === "C1_ttfa") {
    if (row.median_days_to_first_action != null) {
      return `Median ${formatDays(row.median_days_to_first_action)} · PI ≤ 2 days`;
    }
    return `${row.alerts_with_intervention} / ${row.total_alerts} alerts with intervention`;
  }
  if (criterion.code === "D1_uptake" && row.wb_referred_cases <= 0) {
    return "No wellbeing referrals in scope — full credit";
  }
  if (criterion.code === "D2_wb_progression" && row.wb_referred_cases <= 0) {
    return "No wellbeing referrals in scope — full credit";
  }
  if (criterion.code === "D3_wb_resolution" && row.wb_referred_cases <= 0) {
    return "No wellbeing referrals in scope — full credit";
  }
  return criterion.denominator > 0
    ? `${criterion.numerator} / ${criterion.denominator}`
    : "—";
}

export function EffectivenessDetailContent({ row }: { row: EffectivenessScoreRow }) {
  const gradeCfg = FEI_GRADE_CONFIG[row.ei_rating];
  const categories = categoryTotals(row);

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: `${gradeCfg.color}44`,
          background: gradeCfg.bg,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Effectiveness Index
            </p>
            <p
              className="mt-1 text-3xl font-extrabold tabular-nums"
              style={{ color: gradeCfg.color }}
            >
              {Math.round(row.ei_score)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              Grade {row.ei_rating} · {EI_GRADE_LABELS[row.ei_rating]}
            </p>
          </div>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black"
            style={{
              border: `2px solid ${gradeCfg.color}`,
              color: gradeCfg.color,
            }}
          >
            {row.ei_rating}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          Snapshot {row.snapshot_date} · {row.dimension_name} (
          {row.dimension_type})
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Category contribution
        </h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-200">{cat.label}</span>
                <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {cat.pts.toFixed(1)} / {cat.max} pts
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (cat.pts / cat.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Criteria breakdown
        </h3>
        <div className="space-y-2">
          {Object.values(row.criteria_breakdown).map((criterion) => (
            <div
              key={criterion.code}
              className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {criterion.label}
                    </p>
                    <span
                      className="cursor-help text-slate-400"
                      title={`${criterion.tooltip}\n\nFormula: ${criterion.formula}\nPerformance indicator: ${criterion.piTarget}\nWeight: ${Math.round(criterion.weight * 100)}%`}
                    >
                      ⓘ
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {criterion.formula}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{(criterion.contribution * 100).toFixed(1)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {criterionDisplayValue(row, criterion.code)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {criterionDetailLine(row, criterion)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  PI: {criterion.piTarget}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Score: {(criterion.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Volume counts
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Enrolled students", value: row.total_students },
            { label: "Users (login scope)", value: row.login_total_users },
            { label: "Users logged in (7d)", value: row.login_users_meeting_pi },
            { label: "Classes held", value: row.classes_held_total },
            { label: "Classes posted", value: row.classes_posted_total },
            { label: "Total alerts", value: row.total_alerts },
            { label: "Alerts intervened", value: row.alerts_with_intervention },
            { label: "Open faculty cases", value: row.open_faculty_cases },
            { label: "Cases progression OK", value: row.faculty_cases_progression_ok },
            { label: "Total faculty cases", value: row.faculty_total_cases },
            { label: "Closed / referred", value: row.faculty_cases_closed_or_referred },
            { label: "WB referred", value: row.wb_referred_cases },
            { label: "WB open cases", value: row.wb_open_cases },
            { label: "WB progression OK", value: row.wb_cases_progression_ok },
            { label: "WB closed", value: row.wb_cases_closed },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              title={`Raw count for ${label}`}
            >
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                {value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function EffectivenessDetailMulti({
  rows,
  snapshotDate,
}: {
  rows: EffectivenessScoreRow[];
  snapshotDate: string;
}) {
  if (rows.length === 1) {
    return <EffectivenessDetailContent row={rows[0]} />;
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Snapshot {snapshotDate} · {rows.length} entities in your scope
      </p>
      {rows.map((row) => (
        <div key={`${row.dimension_type}:${row.dimension_id}`} className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {row.dimension_name}
            <span className="ml-2 text-xs font-normal capitalize text-slate-500">
              ({row.dimension_type})
            </span>
          </h3>
          <EffectivenessDetailContent row={row} />
        </div>
      ))}
    </div>
  );
}
