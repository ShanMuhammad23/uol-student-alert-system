"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Row = {
  courseId: string;
  courseTitle: string | null;
  sectionCode: string | null;
  eventPackageId: string | null;
  classType: string;
  latestStatus: string | null;
  latestInterventionAt: string | null;
};

function humanizeStatus(status: string | null): string {
  if (!status) return "—";
  if (status === "in-progress") return "In-Progress";
  if (status === "no-action-required") return "No Action Required";
  return status
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function InterventionStudentSearchTab() {
  const [sapId, setSapId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = sapId.trim();
    if (!trimmed) {
      setError("Enter a student number.");
      setRows([]);
      setSearchedFor(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/interventions/student-courses?sapId=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch student interventions");
      }
      const body = (await res.json()) as { rows?: Row[] };
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setSearchedFor(trimmed);
    } catch (e) {
      setRows([]);
      setSearchedFor(trimmed);
      setError(e instanceof Error ? e.message : "Failed to fetch student interventions");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:max-w-xs">
          <label
            htmlFor="intervention-search-sap"
            className="mb-1 block text-sm font-medium text-dark dark:text-white"
          >
            Student Number
          </label>
          <input
            id="intervention-search-sap"
            type="text"
            value={sapId}
            onChange={(e) => setSapId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Enter SAP ID"
            className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={isLoading}
          className={cn(
            "inline-flex h-[42px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90",
            "focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {searchedFor && !error && rows.length === 0 && !isLoading && (
        <div className="mt-4 rounded-md border border-dashed border-stroke py-6 text-center text-dark-6 dark:border-dark-3">
          No intervention courses found for {searchedFor}.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md border border-stroke dark:border-dark-3">
          <table className="w-full text-left">
            <thead className="border-b border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2">
              <tr className="text-xs uppercase text-dark-6 dark:text-dark-5">
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Class Type</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Intervention Status</th>
                <th className="px-4 py-3">Latest Intervention</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.courseId}-${row.sectionCode ?? ""}-${row.eventPackageId ?? ""}`}
                  className="border-b border-stroke text-sm text-dark last:border-b-0 dark:border-dark-3 dark:text-white"
                >
                  <td className="px-4 py-3">
                    {row.courseId}
                    {row.courseTitle ? ` - ${row.courseTitle}` : ""}
                  </td>
                  <td className="px-4 py-3">{row.classType || "N/A"}</td>
                  <td className="px-4 py-3">{row.sectionCode || "—"}</td>
                  <td className="px-4 py-3">{humanizeStatus(row.latestStatus)}</td>
                  <td className="px-4 py-3">
                    {row.latestInterventionAt
                      ? new Date(row.latestInterventionAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
