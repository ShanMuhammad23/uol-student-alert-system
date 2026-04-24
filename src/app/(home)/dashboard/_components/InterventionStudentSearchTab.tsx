"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  courseId: string;
  courseTitle: string | null;
  facultyName: string | null;
  departmentName: string | null;
  degreeTitle: string | null;
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
        <div className="mt-4">
          <div className="mb-3 text-sm text-dark-6 dark:text-white">
            Total Intervention Rows:{" "}
            <span className="font-semibold text-dark dark:text-white">
              {rows.length.toLocaleString()}
            </span>
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
              <TableRow className="border-none uppercase [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                <TableHead className="min-w-[130px] !text-left">Faculty</TableHead>
                <TableHead className="min-w-[180px] !text-left">Department</TableHead>
                <TableHead className="min-w-[180px] !text-left">Degree</TableHead>
                <TableHead className="min-w-[220px] !text-left">Course</TableHead>
                <TableHead className="min-w-[100px] !text-left">Class Type</TableHead>
                <TableHead className="min-w-[100px] !text-left">Section</TableHead>
                <TableHead className="min-w-[180px] !text-left">Intervention Status</TableHead>
                <TableHead className="min-w-[180px] !text-left">Latest Intervention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.courseId}-${row.sectionCode ?? ""}-${row.eventPackageId ?? ""}`}
                  className="text-base font-medium text-dark dark:text-white"
                >
                  <TableCell className="!text-left text-sm text-dark-6 dark:text-white">
                    {row.facultyName || "—"}
                  </TableCell>
                  <TableCell className="!text-left text-sm text-dark-6 dark:text-white">
                    {row.departmentName || "—"}
                  </TableCell>
                  <TableCell className="!text-left text-sm">
                    {row.degreeTitle || "—"}
                  </TableCell>
                  <TableCell className="!text-left text-sm">
                    {row.courseId}
                    {row.courseTitle ? ` - ${row.courseTitle}` : ""}
                  </TableCell>
                  <TableCell className="!text-left text-sm">{row.classType || "N/A"}</TableCell>
                  <TableCell className="!text-left text-sm">{row.sectionCode || "—"}</TableCell>
                  <TableCell className="!text-left text-sm">{humanizeStatus(row.latestStatus)}</TableCell>
                  <TableCell className="!text-left text-sm">
                    {row.latestInterventionAt
                      ? new Date(row.latestInterventionAt).toLocaleString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
