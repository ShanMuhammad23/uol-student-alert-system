"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeFeiRating,
  normalizeDateString,
  type EffectivenessScoreRow,
  type FeiRating,
} from "@/lib/effectiveness-scoring";
import type { InterventionRoleScopeStats } from "@/lib/db/interventions";
import { cn } from "@/lib/utils";
import { fontNum, fontUI } from "../fonts";
import { mapRowToFacultyView } from "../map-faculty";
import {
  formatTrendLabel,
  type FacultyEffectivenessView,
} from "../types";

type Tab = "overview" | "breakdown" | "table";

type SortKey =
  | "name"
  | "grade"
  | "fei"
  | "coverage"
  | "critCoverage"
  | "ttfc"
  | "wellbeingPct"
  | "recovery"
  | "conclusionRate"
  | "staleRate"
  | "repeatAlert"
  | "attendancePost"
  | "alerted";

type Props = {
  faculties: FacultyEffectivenessView[];
  snapshotDate: string;
  trendDates: string[];
  interventionStats: InterventionRoleScopeStats;
};

function formatInterventionStatusSub(stats: InterventionRoleScopeStats): string {
  const parts: string[] = [];
  if (stats.initiated > 0) parts.push(`${stats.initiated} initiated`);
  if (stats.inProgress > 0) parts.push(`${stats.inProgress} in progress`);
  if (stats.resolved > 0) parts.push(`${stats.resolved} resolved`);
  if (stats.noActionRequired > 0) parts.push(`${stats.noActionRequired} not required`);
  if (stats.referred > 0) parts.push(`${stats.referred} referred`);
  return parts.length ? parts.join(" · ") : "No intervention records yet";
}

const GRADE_CONFIG: Record<
  FeiRating,
  { color: string; bg: string; label: string }
> = {
  A: { color: "#10B981", bg: "rgba(16,185,129,0.15)", label: "Exemplary" },
  B: { color: "#3B82F6", bg: "rgba(59,130,246,0.15)", label: "Effective" },
  C: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Developing" },
  D: { color: "#F97316", bg: "rgba(249,115,22,0.15)", label: "At Risk" },
  E: { color: "#F43F5E", bg: "rgba(244,63,94,0.15)", label: "Critical" },
};

const GRADE_ORDER: Record<FeiRating, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Faculty" },
  { key: "grade", label: "Grade" },
  { key: "fei", label: "FEI" },
  { key: "coverage", label: "Coverage %" },
  { key: "critCoverage", label: "Crit. Cov %" },
  { key: "ttfc", label: "TTFC (d)" },
  { key: "wellbeingPct", label: "Wellbeing %" },
  { key: "recovery", label: "Recovery %" },
  { key: "conclusionRate", label: "Conclusion %" },
  { key: "staleRate", label: "Stale %" },
  { key: "repeatAlert", label: "Repeat %" },
  { key: "attendancePost", label: "Attend. Post %" },
  { key: "alerted", label: "Alerted" },
];

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return {
    isDark,
    text: isDark ? "#F8FAFC" : "#0F172A",
    textMuted: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.55)",
    textFaint: isDark ? "rgba(248,250,252,0.35)" : "rgba(15,23,42,0.4)",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    refLine: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    ringTrack: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    barTrack: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    tickUI: { fontFamily: fontUI, fill: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.55)", fontSize: 10 },
    tickNum: { fontFamily: fontNum, fill: isDark ? "rgba(248,250,252,0.35)" : "rgba(15,23,42,0.45)", fontSize: 10 },
    tooltip: {
      background: isDark ? "#1E293B" : "#FFFFFF",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10,
      fontSize: 12,
      fontFamily: fontNum,
      color: isDark ? "#F8FAFC" : "#0F172A",
    },
  };
}

function sortFaculties(
  list: FacultyEffectivenessView[],
  key: SortKey,
  dir: "asc" | "desc"
): FacultyEffectivenessView[] {
  return [...list].sort((a, b) => {
    if (key === "name") {
      const cmp = a.name.localeCompare(b.name);
      return dir === "desc" ? -cmp : cmp;
    }
    const av = key === "grade" ? GRADE_ORDER[a.grade] : a[key];
    const bv = key === "grade" ? GRADE_ORDER[b.grade] : b[key];
    return dir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
  });
}

function formatSnapshotDate(value: unknown): string {
  const dateStr = normalizeDateString(value);
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Panel({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function FEIRing({
  faculty,
  selected,
  onClick,
}: {
  faculty: FacultyEffectivenessView;
  selected: boolean;
  onClick: (f: FacultyEffectivenessView) => void;
}) {
  const theme = useChartTheme();
  const cfg = GRADE_CONFIG[faculty.grade];
  const r = 38;
  const cx = 50;
  const cy = 50;
  const stroke = 7;
  const circ = 2 * Math.PI * r;
  const dash = (faculty.fei / 100) * circ;

  const components = [
    { label: "Outcome", val: faculty.outcome, color: "#10B981" },
    { label: "Wellbeing", val: faculty.wellbeing, color: "#7C3AED" },
    { label: "Response", val: faculty.response, color: "#3B82F6" },
    { label: "Readiness", val: faculty.readiness, color: "#F59E0B" },
    { label: "Sustained", val: faculty.sustained, color: "#F43F5E" },
  ];

  return (
    <button
      type="button"
      onClick={() => onClick(faculty)}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-2xl border px-4 pb-4 pt-5 text-left transition-all",
        selected
          ? "border-2 bg-emerald-50/50 dark:bg-emerald-950/20"
          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600"
      )}
      style={selected ? { borderColor: cfg.color } : undefined}
    >
      <div
        className="absolute right-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {faculty.grade} · {cfg.label}
      </div>

      <div className="mb-2 flex justify-center">
        <svg viewBox="0 0 100 100" width={90} height={90}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.ringTrack} strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={cfg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fill={theme.text}
            fontSize={20}
            fontWeight={700}
            style={{ fontFamily: fontNum }}
          >
            {faculty.fei}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={theme.textFaint} fontSize={9}>
            FEI Score
          </text>
        </svg>
      </div>

      <div className="mb-3 text-center">
        <div className="text-sm font-bold text-slate-900 dark:text-white">{faculty.name}</div>
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">{faculty.alerted}</span> alerted ·{" "}
          <span className="font-mono tabular-nums">{faculty.nTotal}</span> enrolled
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className="w-[52px] text-right text-[9px] text-slate-500 dark:text-slate-400">
              {c.label}
            </div>
            <div
              className="h-1 flex-1 rounded-sm"
              style={{ background: theme.barTrack }}
            >
              <div
                className="h-full rounded-sm transition-all duration-500"
                style={{ width: `${c.val}%`, background: c.color }}
              />
            </div>
            <div
              className="w-6 text-[9px] font-semibold tabular-nums"
              style={{ color: c.color, fontFamily: fontNum }}
            >
              {c.val}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "#10B981",
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: string;
}) {
  return (
    <Panel className="flex flex-col gap-1 p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <span className="text-lg">{icon}</span>
      </div>
      <div
        className="text-[28px] font-extrabold leading-tight tabular-nums"
        style={{ color, fontFamily: fontNum }}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>
      ) : null}
    </Panel>
  );
}

function GradeDistributionStatCard({
  grades,
  totalFaculties,
}: {
  grades: { grade: FeiRating; count: number; color: string }[];
  totalFaculties: number;
}) {
  return (
    <Panel className="flex flex-col justify-center gap-3 p-5 sm:col-span-2 lg:col-span-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Grade Distribution
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {grades.map(({ grade, count, color }) => (
          <span
            key={grade}
            className="inline-flex items-baseline gap-1 text-2xl font-extrabold tabular-nums leading-none"
            style={{ fontFamily: fontNum }}
          >
            <span style={{ color }}>{grade}</span>
            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
              ({count})
            </span>
          </span>
        ))}
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        {totalFaculties} {totalFaculties === 1 ? "faculty" : "faculties"} tracked in FEI index
      </div>
    </Panel>
  );
}

function FacultyRadar({ faculty }: { faculty: FacultyEffectivenessView }) {
  const theme = useChartTheme();
  const data = [
    { dim: "Response", score: faculty.response },
    { dim: "Wellbeing", score: faculty.wellbeing },
    { dim: "Outcome", score: faculty.outcome },
    { dim: "Readiness", score: faculty.readiness },
    { dim: "Sustained", score: faculty.sustained },
  ];
  const cfg = GRADE_CONFIG[faculty.grade];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke={theme.grid} />
        <PolarAngleAxis dataKey="dim" tick={theme.tickUI} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="score"
          stroke={cfg.color}
          fill={cfg.color}
          fillOpacity={0.18}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function FacultyTrend({
  faculty,
  trendLabels,
}: {
  faculty: FacultyEffectivenessView;
  trendLabels: string[];
}) {
  const theme = useChartTheme();
  const cfg = GRADE_CONFIG[faculty.grade];
  const data = faculty.trend.map((fei, i) => ({
    month: trendLabels[i] ?? `Pt ${i + 1}`,
    fei,
  }));

  if (!data.length) {
    return (
      <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        No historical snapshots yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis dataKey="month" tick={theme.tickUI} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={theme.tickNum} axisLine={false} tickLine={false} />
        <ReferenceLine y={70} stroke={theme.refLine} strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="fei"
          stroke={cfg.color}
          strokeWidth={2.5}
          dot={{ fill: cfg.color, r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricRow({
  label,
  value,
  benchmark,
  unit = "%",
  higherBetter = true,
}: {
  label: string;
  value: number;
  benchmark: number;
  unit?: string;
  higherBetter?: boolean;
}) {
  const theme = useChartTheme();
  const num = value;
  const good = higherBetter ? num >= benchmark : num <= benchmark;
  const color = Number.isNaN(num)
    ? "#64748B"
    : good
      ? "#10B981"
      : num > (higherBetter ? benchmark * 0.6 : benchmark * 1.4)
        ? "#F59E0B"
        : "#F43F5E";

  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 py-1.5 dark:border-slate-700/60">
      <div className="flex-1 text-xs text-slate-600 dark:text-slate-300">{label}</div>
      <div
        className="min-w-[60px] text-right text-[13px] font-bold tabular-nums"
        style={{ color, fontFamily: fontNum }}
      >
        {Number.isNaN(num) ? "—" : `${num}${unit}`}
      </div>
      <div className="h-1 w-20 rounded-sm" style={{ background: theme.barTrack }}>
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{
            width: `${Math.min(100, higherBetter ? num : Math.max(0, 100 - num))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export function FEIDashboardClient({
  faculties: initialFaculties,
  snapshotDate: initialSnapshotDate,
  trendDates,
  interventionStats: initialInterventionStats,
}: Props) {
  const theme = useChartTheme();
  const trendLabels = useMemo(
    () => trendDates.map(formatTrendLabel),
    [trendDates]
  );

  const [faculties, setFaculties] = useState(initialFaculties);
  const [snapshotDate, setSnapshotDate] = useState(initialSnapshotDate);
  const [interventionStats, setInterventionStats] = useState(initialInterventionStats);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FacultyEffectivenessView | null>(
    initialFaculties[0] ?? null
  );
  const [sortKey, setSortKey] = useState<SortKey>("fei");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/effectiveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live, dimensionType: "faculty" }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        rows: EffectivenessScoreRow[];
        snapshotDate: string;
        interventionStats?: InterventionRoleScopeStats;
      };
      if (body.interventionStats) {
        setInterventionStats(body.interventionStats);
      }
      const facultyRows = (body.rows ?? []).filter(
        (row) => row.dimension_type === "faculty"
      );
      let nextViews: FacultyEffectivenessView[] = [];
      setFaculties((prev) => {
        const trendById = new Map(prev.map((f) => [f.id, f.trend]));
        nextViews = facultyRows.map((row) =>
          mapRowToFacultyView(row, trendById.get(row.dimension_id) ?? [])
        );
        return nextViews;
      });
      setSelected((current) => {
        if (!nextViews.length) return null;
        if (current) {
          const match = nextViews.find((v) => v.id === current.id);
          if (match) return match;
        }
        return nextViews[0];
      });
      setSnapshotDate(body.snapshotDate ?? initialSnapshotDate);
    } finally {
      setLoading(false);
    }
  }, [live, initialSnapshotDate]);

  useEffect(() => {
    if (!live) return;
    void refresh();
  }, [live, refresh]);

  const totalAlerted = faculties.reduce((a, f) => a + f.alerted, 0);
  const totalIntervened = faculties.reduce((a, f) => a + f.intervened, 0);
  const totalRecovered = faculties.reduce((a, f) => a + f.recovered, 0);
  const totalEnrolled = faculties.reduce((a, f) => a + f.nTotal, 0);
  const avgFEI = faculties.length
    ? Math.round(faculties.reduce((a, f) => a + f.fei, 0) / faculties.length)
    : 0;

  const feiBarData = [...faculties]
    .sort((a, b) => b.fei - a.fei)
    .map((f) => ({
      name: f.code,
      fei: f.fei,
      grade: f.grade,
      color: GRADE_CONFIG[f.grade].color,
    }));

  const sorted = sortFaculties(faculties, sortKey, sortDir);

  const gradeDistData = (["A", "B", "C", "D", "E"] as FeiRating[]).map((grade) => ({
    grade,
    count: faculties.filter((f) => f.grade === grade).length,
    color: GRADE_CONFIG[grade].color,
  }));

  const trendChartData = trendDates.map((date, i) => {
    const row: Record<string, string | number> = {
      month: formatTrendLabel(date),
    };
    for (const f of faculties) {
      row[f.code] = f.trend[i] ?? 0;
    }
    return row;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const dataControls = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Snapshot · {formatSnapshotDate(snapshotDate)}
        {live ? " (live)" : ""}
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
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
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Loading…" : "Refresh"}
      </button>
    </div>
  );

  if (!faculties.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end">{dataControls}</div>
        <Panel className="py-12 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No effectiveness data available yet
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Run the nightly ETL (
            <code className="text-emerald-600 dark:text-emerald-400">/api/cron/effectiveness</code>
            ) after student sync, or enable <strong>Live compute</strong> to score from current
            data.
          </p>
        </Panel>
      </div>
    );
  }

  const selectedFaculty = selected ?? faculties[0];
  const cfg = GRADE_CONFIG[selectedFaculty.grade];
  const avgGrade = computeFeiRating(avgFEI);
  const coveragePct =
    totalAlerted > 0 ? Math.round((totalIntervened / totalAlerted) * 100) : 0;
  const recoveryPct =
    totalIntervened > 0 ? Math.round((totalRecovered / totalIntervened) * 100) : 0;

  return (
    <div className="space-y-6" style={{ fontFamily: fontUI }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["overview", "breakdown", "table"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg border px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
                activeTab === tab
                  ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab === "overview"
                ? "Overview"
                : tab === "breakdown"
                  ? "Breakdown"
                  : "Data Table"}
            </button>
          ))}
        </div>
        {dataControls}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          label="University FEI"
          value={avgFEI}
          sub="Weighted avg. all faculties"
          color={GRADE_CONFIG[avgGrade].color}
          icon="🎯"
        />
        <StatCard
          label="Students Alerted"
          value={totalAlerted.toLocaleString()}
          sub={`${totalEnrolled.toLocaleString()} enrolled · ${totalIntervened.toLocaleString()} reached (${coveragePct}% coverage)`}
          color="#F59E0B"
          icon="🔔"
        />
        <StatCard
          label="Interventions"
          value={interventionStats.totalInterventionStudents.toLocaleString()}
          sub={formatInterventionStatusSub(interventionStats)}
          color="#3B82F6"
          icon="🤝"
        />
        <StatCard
          label="Recovered"
          value={totalRecovered.toLocaleString()}
          sub={`${recoveryPct}% of intervened`}
          color="#10B981"
          icon="💚"
        />
        <GradeDistributionStatCard
          grades={gradeDistData}
          totalFaculties={faculties.length}
        />
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Faculty FEI Scores</h3>
        <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
          Overall effectiveness index (0–100) per faculty, sorted highest to lowest
        </p>
        <ResponsiveContainer width="100%" height={Math.max(200, feiBarData.length * 28)}>
          <BarChart data={feiBarData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...theme.tickUI, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} tick={theme.tickNum} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={theme.tooltip}
              cursor={{ fill: theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              formatter={(value, _name, item) => [
                `${value} (Grade ${(item.payload as { grade: FeiRating }).grade})`,
                "FEI",
              ]}
            />
            <ReferenceLine y={70} stroke={theme.refLine} strokeDasharray="4 2" />
            <ReferenceLine y={55} stroke={theme.refLine} strokeDasharray="2 3" />
            <Bar dataKey="fei" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {feiBarData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {activeTab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FEI Health Rings — click a faculty for details
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                {faculties.map((f) => (
                  <FEIRing
                    key={f.id}
                    faculty={f}
                    selected={selectedFaculty.id === f.id}
                    onClick={setSelected}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Panel
              className="sticky top-4"
              style={{ borderColor: `${cfg.color}33` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {selectedFaculty.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums">{selectedFaculty.nTotal}</span>{" "}
                    students enrolled
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-black"
                  style={{
                    background: cfg.bg,
                    border: `2px solid ${cfg.color}`,
                    color: cfg.color,
                  }}
                >
                  {selectedFaculty.grade}
                </div>
              </div>

              <p className="mb-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
                Component Profile
              </p>
              <FacultyRadar faculty={selectedFaculty} />

              <p className="mb-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                FEI Trend ({trendLabels.length || "no"} snapshots)
              </p>
              <FacultyTrend faculty={selectedFaculty} trendLabels={trendLabels} />

              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Raw Metrics
              </p>
              <MetricRow label="Coverage %" value={selectedFaculty.coverage} benchmark={85} />
              <MetricRow label="Critical Coverage %" value={selectedFaculty.critCoverage} benchmark={90} />
              <MetricRow label="Wellbeing Uptake %" value={selectedFaculty.wellbeingPct} benchmark={65} />
              <MetricRow label="Recovery %" value={selectedFaculty.recovery} benchmark={45} />
              <MetricRow label="Conclusion Rate %" value={selectedFaculty.conclusionRate} benchmark={55} />
              <MetricRow label="Stale Cases %" value={selectedFaculty.staleRate} benchmark={20} higherBetter={false} />
              <MetricRow label="Repeat Alert %" value={selectedFaculty.repeatAlert} benchmark={10} higherBetter={false} />
              <MetricRow label="Attendance Posting %" value={selectedFaculty.attendancePost} benchmark={90} />
              <MetricRow label="TTFC (days)" value={selectedFaculty.ttfc} benchmark={7} unit=" d" higherBetter={false} />

              <div className="mt-3.5 grid grid-cols-2 gap-2">
                {[
                  { l: "Alerted", v: selectedFaculty.alerted, c: "#F59E0B" },
                  { l: "Intervened", v: selectedFaculty.intervened, c: "#3B82F6" },
                  { l: "Concluded", v: selectedFaculty.concluded, c: "#7C3AED" },
                  { l: "Referred", v: selectedFaculty.referred, c: "#A78BFA" },
                  { l: "Recovered", v: selectedFaculty.recovered, c: "#10B981" },
                ].map(({ l, v, c }) => (
                  <div
                    key={l}
                    className="rounded-lg border bg-slate-50/80 p-2.5 dark:bg-slate-900/40"
                    style={{ borderColor: `${c}33` }}
                  >
                    <div
                      className="text-lg font-extrabold tabular-nums"
                      style={{ color: c, fontFamily: fontNum }}
                    >
                      {v}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{l}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                Grade Distribution
              </h3>
              {gradeDistData.map(({ grade, count, color }) => (
                <div key={grade} className="mb-2 flex items-center gap-2.5">
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-xs font-bold"
                    style={{
                      background: `${color}22`,
                      border: `1px solid ${color}44`,
                      color,
                    }}
                  >
                    {grade}
                  </div>
                  <div className="h-1.5 flex-1 rounded-sm" style={{ background: theme.barTrack }}>
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${faculties.length ? (count / faculties.length) * 100 : 0}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <div className="w-[60px] text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums">{count}</span> faculty
                    {count !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "breakdown" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Panel>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Coverage vs Recovery
            </h3>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
              Intervention coverage and student recovery rate by faculty
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={[...faculties]
                  .sort((a, b) => b.coverage - a.coverage)
                  .map((f) => ({
                    name: f.code,
                    Coverage: f.coverage,
                    Recovery: f.recovery,
                  }))}
                margin={{ left: 0, right: 10 }}
              >
                <CartesianGrid stroke={theme.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={theme.tickNum} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ ...theme.tickUI, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={theme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: theme.textMuted, fontFamily: fontUI }} />
                <Bar dataKey="Coverage" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={12} />
                <Bar dataKey="Recovery" fill="#10B981" radius={[0, 4, 4, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Wellbeing Pipeline per Faculty
            </h3>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
              Alerted → Intervened → Concluded → Recovered
            </p>
            <div className="flex flex-col gap-3.5">
              {faculties.map((f) => {
                const steps = [
                  { l: "Alerted", v: f.alerted, c: "#F59E0B" },
                  { l: "Intervened", v: f.intervened, c: "#3B82F6" },
                  { l: "Concluded", v: f.concluded, c: "#7C3AED" },
                  { l: "Recovered", v: f.recovered, c: "#10B981" },
                ];
                const max = Math.max(f.alerted, 1);
                return (
                  <div key={f.id}>
                    <p className="mb-1 text-[11px] font-bold" style={{ color: GRADE_CONFIG[f.grade].color }}>
                      {f.name}{" "}
                      <span className="font-normal text-slate-400">({f.grade})</span>
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {steps.map((s) => (
                        <div key={s.l} className="flex items-center gap-2">
                          <div className="w-[62px] text-right text-[10px] text-slate-500 dark:text-slate-400">
                            {s.l}
                          </div>
                          <div className="h-1.5 flex-1 rounded-sm" style={{ background: theme.barTrack }}>
                            <div
                              className="h-full rounded-sm"
                              style={{ width: `${(s.v / max) * 100}%`, background: s.c }}
                            />
                          </div>
                          <div
                            className="w-7 text-right text-[10px] font-bold tabular-nums"
                            style={{ color: s.c, fontFamily: fontNum }}
                          >
                            {s.v}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Response Speed &amp; Stale Cases
            </h3>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
              TTFC = median days to first contact · Stale = open &gt;14 days
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[...faculties]
                  .sort((a, b) => a.ttfc - b.ttfc)
                  .map((f) => ({
                    name: f.code,
                    TTFC: f.ttfc,
                    "Stale %": f.staleRate,
                  }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              >
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ ...theme.tickUI, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={theme.tickNum} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={theme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: theme.textMuted, fontFamily: fontUI }} />
                <ReferenceLine y={7} stroke="#F59E0B" strokeDasharray="4 2" />
                <Bar dataKey="TTFC" radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {faculties.map((f) => (
                    <Cell
                      key={f.code}
                      fill={f.ttfc <= 7 ? "#10B981" : f.ttfc <= 14 ? "#F59E0B" : "#F43F5E"}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Stale %" fill="#7C3AED" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              FEI Trend — All Faculties
            </h3>
            <p className="mb-4 text-[11px] text-slate-500 dark:text-slate-400">
              Historical FEI scores from nightly snapshots
            </p>
            {trendChartData.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendChartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ ...theme.tickUI, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={theme.tickNum} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={theme.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 11, color: theme.textMuted, fontFamily: fontUI }} />
                  <ReferenceLine y={70} stroke={theme.refLine} strokeDasharray="3 3" />
                  {faculties.map((f) => (
                    <Line
                      key={f.code}
                      type="monotone"
                      dataKey={f.code}
                      stroke={GRADE_CONFIG[f.grade].color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No trend data yet — run effectiveness ETL on multiple days
              </p>
            )}
          </Panel>
        </div>
      )}

      {activeTab === "table" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Detailed Metrics Table
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Click column headers to sort · click a row for faculty detail
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40">
                  {TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "cursor-pointer whitespace-nowrap border-b border-slate-200 px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-wide dark:border-slate-700",
                        sortKey === col.key
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {col.label}{" "}
                      {sortKey === col.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((f, i) => {
                  const g = GRADE_CONFIG[f.grade];
                  return (
                    <tr
                      key={f.id}
                      onClick={() => {
                        setSelected(f);
                        setActiveTab("overview");
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
                        i % 2 === 1 && "bg-slate-50/50 dark:bg-slate-900/20"
                      )}
                    >
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {f.name}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className="rounded px-2 py-0.5 text-[11px] font-bold"
                          style={{ background: g.bg, color: g.color }}
                        >
                          {f.grade}
                        </span>
                      </td>
                      <td
                        className="px-3.5 py-2.5 text-[15px] font-extrabold tabular-nums"
                        style={{ color: g.color, fontFamily: fontNum }}
                      >
                        {f.fei}
                      </td>
                      {[
                        { v: f.coverage, b: 85 },
                        { v: f.critCoverage, b: 90 },
                        { v: f.ttfc, b: 7, inv: true },
                        { v: f.wellbeingPct, b: 65 },
                        { v: f.recovery, b: 45 },
                        { v: f.conclusionRate, b: 55 },
                        { v: f.staleRate, b: 20, inv: true },
                        { v: f.repeatAlert, b: 10, inv: true },
                        { v: f.attendancePost, b: 90 },
                      ].map((cell, ci) => {
                        const good = cell.inv ? cell.v <= cell.b : cell.v >= cell.b;
                        const warn = cell.inv
                          ? cell.v <= cell.b * 1.5
                          : cell.v >= cell.b * 0.7;
                        const col = good ? "#10B981" : warn ? "#F59E0B" : "#F43F5E";
                        return (
                          <td
                            key={ci}
                            className="px-3.5 py-2.5 font-semibold tabular-nums"
                            style={{ color: col, fontFamily: fontNum }}
                          >
                            {cell.v}
                          </td>
                        );
                      })}
                      <td
                        className="px-3.5 py-2.5 font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                        style={{ fontFamily: fontNum }}
                      >
                        {f.alerted}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-5 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
            {[
              { color: "#10B981", label: "At or above target" },
              { color: "#F59E0B", label: "Approaching target" },
              { color: "#F43F5E", label: "Below target" },
            ].map(({ color, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
              >
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
        <span>
          FEI = 0.30×Outcome + 0.25×Wellbeing + 0.25×Response + 0.10×Readiness + 0.10×Sustained
        </span>
        <span>
          {live
            ? "Live compute from current data"
            : "Refreshed via ETL · /api/cron/effectiveness"}
        </span>
      </div>
    </div>
  );
}
