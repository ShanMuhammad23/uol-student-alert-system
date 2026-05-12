"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AlertSnapshotTrendPoint } from "@/app/(home)/dashboard/fetch";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { cn } from "@/lib/utils";
import { AlertSnapshotsLineChart } from "./AlertSnapshotsLineChart";

type FacultyOption = {
  facultyId: string;
  facultyName: string;
};

type Props = {
  points: AlertSnapshotTrendPoint[];
  facultyOptions: FacultyOption[];
  validSelectedFaculty: string;
};

export function SuperadminAlertTrendsCollapsible({
  points,
  facultyOptions,
  validSelectedFaculty,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Alert snapshot</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Trend lines over time — expand to filter by faculty and view the chart
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-slate-200 px-6 pb-6 pt-2 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Alert trends</h3>
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label htmlFor="superadmin-alert-faculty" className="sr-only">
                Faculty filter
              </label>
              <select
                id="superadmin-alert-faculty"
                name="faculty"
                defaultValue={validSelectedFaculty}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">All Faculties</option>
                {facultyOptions.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {resolveFacultyNameFromIdOrName(
                      f.facultyId,
                      f.facultyName.replace("Faculty of ", "")
                    ) ?? f.facultyId}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Apply
              </button>
            </form>
          </div>
          <div className="mt-4">
            <AlertSnapshotsLineChart points={points} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
