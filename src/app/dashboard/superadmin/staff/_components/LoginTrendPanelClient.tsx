"use client";

import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveFacultyNameFromIdOrName, toShortFacultyName } from "@/lib/faculty-name";
import type {
  LoginTrendDailyPoint,
  LoginTrendFacultyPoint,
} from "@/lib/staff-directory-queries";

type Props = {
  daily: LoginTrendDailyPoint[];
  byFaculty: LoginTrendFacultyPoint[];
};

function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return {
    isDark,
    textMuted: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.55)",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tick: {
      fill: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.55)",
      fontSize: 11,
    },
    tooltip: {
      background: isDark ? "#1E293B" : "#FFFFFF",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10,
      fontSize: 12,
      color: isDark ? "#F8FAFC" : "#0F172A",
    },
  };
}

function truncateLabel(name: string, max = 28): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function LoginTrendPanelClient({ daily, byFaculty }: Props) {
  const theme = useChartTheme();

  const facultyChartData = [...byFaculty]
    .sort((a, b) => b.login_pct - a.login_pct)
    .map((f) => {
      const resolved =
        resolveFacultyNameFromIdOrName(f.faculty_id, f.faculty_name) ??
        f.faculty_name ??
        f.faculty_id;
      const short = toShortFacultyName(resolved) ?? resolved;
      return {
        name: truncateLabel(short),
        fullName: resolved,
        loginPct: f.login_pct,
        loggedIn: f.logged_in_7d,
        total: f.total_staff,
      };
    });

  const totalStaff = byFaculty.reduce((sum, f) => sum + f.total_staff, 0);
  const totalLoggedIn = byFaculty.reduce((sum, f) => sum + f.logged_in_7d, 0);
  const overallPct =
    totalStaff > 0 ? Math.round((totalLoggedIn / totalStaff) * 1000) / 10 : 0;

  return (
    <div className="space-y-6 bg-white py-4 rounded">
      <div className="grid gap-4 sm:grid-cols-2 border-b">
        <div className=" px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Staff logged in (past 7 days)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {totalLoggedIn}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {totalStaff}
            </span>
          </p>
        </div>
        <div className=" px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Overall login %
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {overallPct}%
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 px-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Logins per day
          </h2>
          <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Same staff as above, grouped by the date of their last login
          </p>
          {daily.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No login data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily} margin={{ top: 16, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={theme.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={theme.tick}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={theme.tooltip}
                  formatter={(value) => [Number(value) || 0, "Logins"]}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as LoginTrendDailyPoint | undefined;
                    return point?.date ?? "";
                  }}
                />
                <Bar dataKey="logins" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  <LabelList
                    dataKey="logins"
                    position="top"
                    style={{ fill: theme.textMuted, fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Faculty login %
          </h2>
          <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Staff logged in past 7 days ÷ total staff in faculty
          </p>
          {facultyChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No faculty staff data available.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(280, facultyChartData.length * 32)}
            >
              <BarChart
                layout="vertical"
                data={facultyChartData}
                margin={{ top: 4, right: 36, bottom: 0, left: 4 }}
              >
                <CartesianGrid stroke={theme.grid} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={theme.tick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ ...theme.tick, fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={theme.tooltip}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as
                      | { loggedIn?: number; total?: number; fullName?: string }
                      | undefined;
                    return [
                      `${Number(value) || 0}% (${row?.loggedIn ?? 0}/${row?.total ?? 0})`,
                      "Login %",
                    ];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                    return row?.fullName ?? "";
                  }}
                />
                <Bar dataKey="loginPct" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  <LabelList
                    dataKey="loginPct"
                    position="right"
                    formatter={(v) => `${Number(v) || 0}%`}
                    style={{ fill: theme.textMuted, fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
