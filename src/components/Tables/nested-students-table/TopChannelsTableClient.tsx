"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { StudentProfileLink } from "./StudentProfileLink";
import { TopChannelsSkeleton } from "./skeleton";
import { InterventionStatusBadge } from "@/app/(home)/dashboard/_components/intervention-status-badge";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";

type Props = {
  className?: string;
  returnToUrl?: string;
  masterFilter?: MasterFilterParams;
  attendanceFilters?: AlertDimensionFilter[];
  gpaFilters?: AlertDimensionFilter[];
  interventionFilters?: string[];
  resolutionFilters?: string[];
};

type SortKey =
  | "name"
  | "department"
  | "program"
  | "course"
  | "teacher"
  | "classesHeld"
  | "attendance"
  | "gpa"
  | "intervention";

type SortDirection = "asc" | "desc";

type TopTableRow = {
  sapId: string;
  studentName: string;
  departmentName: string;
  programTitle: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  sectionCode: string | null;
  totalClassesHeld: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  latestInterventionStatus: string | null;
  courseStudentCount: number;
};

export function TopChannelsTableClient({
  className,
  returnToUrl = "/",
  masterFilter,
  attendanceFilters,
  gpaFilters,
  interventionFilters,
  resolutionFilters,
}: Props) {
  const [rows, setRows] = useState<TopTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortConfig, setSortConfig] = useState<
    { key: SortKey; direction: SortDirection } | null
  >(null);
  const [rowsPerPage, setRowsPerPage] = useState<number | "all">(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const totalPages =
    rowsPerPage === "all" || totalResults === 0
      ? 1
      : Math.ceil(totalResults / rowsPerPage);

  const renderSortIcon = (key: SortKey) => {
    const isActive = sortConfig?.key === key;
    const direction = sortConfig?.direction ?? "asc";

    return (
      <span className="ml-1 inline-flex flex-col justify-center text-[10px] text-dark-6 dark:text-dark-5">
        <ArrowUpIcon
          className={cn(
            "h-2 w-2",
            isActive && direction === "asc" ? "text-green-500" : "opacity-40"
          )}
        />
        <ArrowDownIcon
          className={cn(
            "h-2 w-2 -mt-0.5",
            isActive && direction === "desc" ? "text-green-500" : "opacity-40"
          )}
        />
      </span>
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    const effectivePageSize = rowsPerPage === "all" ? 100000 : rowsPerPage;
    const normalizedAttendanceFilters =
      attendanceFilters?.includes("all" as AlertDimensionFilter)
        ? undefined
        : attendanceFilters;
    const normalizedGpaFilters =
      gpaFilters?.includes("all" as AlertDimensionFilter) ? undefined : gpaFilters;
    fetch("/api/students/top-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        page: currentPage,
        pageSize: effectivePageSize,
        sortKey: sortConfig?.key ?? "name",
        sortDirection: sortConfig?.direction ?? "asc",
        filters: {
          ...(masterFilter ?? {}),
          attendanceFilters: normalizedAttendanceFilters,
          gpaFilters: normalizedGpaFilters,
          interventionFilters,
          resolutionFilters:
            resolutionFilters?.length && !resolutionFilters.includes("all")
              ? resolutionFilters.filter((v) => v !== "all")
              : undefined,
          search: debouncedSearch || undefined,
        },
      }),
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to load students"))
      )
      .then((body: { rows?: TopTableRow[]; total?: number }) => {
        setRows(Array.isArray(body.rows) ? body.rows : []);
        setTotalResults(Number(body.total ?? 0));
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [
    masterFilter,
    attendanceFilters,
    gpaFilters,
    interventionFilters,
    resolutionFilters,
    currentPage,
    rowsPerPage,
    sortConfig,
    debouncedSearch,
  ]);

  useEffect(() => {
    // Reset to first page whenever filters/search/sort or page size change
    setCurrentPage(1);
  }, [
    debouncedSearch,
    attendanceFilters,
    gpaFilters,
    interventionFilters,
    resolutionFilters,
    sortConfig,
    rowsPerPage,
    masterFilter,
  ]);

  useEffect(() => {
    // Clamp current page when total results change
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [currentPage, totalPages]);

  const startItem =
    totalResults === 0
      ? 0
      : rowsPerPage === "all"
      ? 1
      : (currentPage - 1) * (rowsPerPage as number) + 1;

  const endItem =
    rowsPerPage === "all"
      ? totalResults
      : Math.min(currentPage * (rowsPerPage as number), totalResults);

  if (isLoading) {
    return <TopChannelsSkeleton />;
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-red-500 bg-red-50 dark:bg-red-950/30 py-8 text-center text-red-700 dark:text-red-400">
          <p className="font-medium">Failed to load enrollment data</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12 overflow-x-auto",
        className
      )}
    >
      {rows.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No student data found.
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-dark-6 dark:text-dark-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="font-medium">
                Total results:{" "}
                <span className="font-semibold text-dark dark:text-white">
                  {totalResults.toLocaleString()}
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="text-dark-6 dark:text-dark-5">Rows per page:</span>
                <select
                  value={rowsPerPage === "all" ? "all" : rowsPerPage.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "all") {
                      setRowsPerPage("all");
                    } else {
                      setRowsPerPage(Number(value));
                    }
                  }}
                  className="rounded-md border border-stroke bg-white px-2 py-1 text-xs sm:text-sm text-dark outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                  <option value="all">All</option>
                </select>
                <span className="text-dark-6 dark:text-dark-5">
                  Showing{" "}
                  <span className="font-semibold text-dark dark:text-white">
                    {startItem.toLocaleString()}-{endItem.toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-dark dark:text-white">
                    {totalResults.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
            <div className="relative w-full md:w-80">
              <label className="sr-only" htmlFor="student-search">
                Search by name or SAP ID
              </label>
              <input
                id="student-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student by name or SAP ID"
                className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
          </div>

          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
              <TableRow className="border-none uppercase [&>th]:text-center [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                <TableHead
                  className="min-w-[160px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Name - SAPID</span>
                    {renderSortIcon("name")}
                  </div>
                </TableHead>

                <TableHead
                  className="min-w-[140px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("department")}
                >
                  <div className="flex items-center gap-1">
                    <span>Department</span>
                    {renderSortIcon("department")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[120px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("program")}
                >
                  <div className="flex items-center gap-1">
                    <span>Program</span>
                    {renderSortIcon("program")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[160px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("course")}
                >
                  <div className="flex items-center gap-1">
                    <span>Course</span>
                    {renderSortIcon("course")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[160px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("teacher")}
                >
                  <div className="flex items-center gap-1">
                    <span>Instructor Name</span>
                    {renderSortIcon("teacher")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[140px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("classesHeld")}
                >
                  <div className="flex items-center gap-1">
                    <span>Classes Held</span>
                    {renderSortIcon("classesHeld")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[140px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("attendance")}
                >
                  <div className="flex items-center gap-1">
                    <span>Attendance %</span>
                    {renderSortIcon("attendance")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[140px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("gpa")}
                >
                  <div className="flex items-center gap-1">
                    <span>GPA</span>
                    {renderSortIcon("gpa")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[160px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("intervention")}
                >
                  <div className="flex items-center gap-1">
                    <span>Intervention Status</span>
                    {renderSortIcon("intervention")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rowKey = `${row.sapId}-${row.courseId}-${row.sectionCode ?? ""}`;
                const alertLevel = row.attendanceAlertLevel;
                const attendanceColorClass =
                  alertLevel === "critical"
                    ? "text-red-600"
                    : alertLevel === "warning"
                    ? "text-yellow-600"
                    : "";
                const hasAttendanceAlert =
                  alertLevel === "critical" || alertLevel === "warning";
                const hasGpaAlert =
                  row.gpaAlertLevel === "critical" || row.gpaAlertLevel === "warning";
                const hasAnyAlert = hasAttendanceAlert || hasGpaAlert;
                const latestStatus = row.latestInterventionStatus;

                const classesHeld = row.totalClassesHeld ?? 0;
                const classesAttended = row.classesAttended ?? 0;
                const attendance = row.attendancePercentage;
                const classAvg = row.classAverageAttendance;
                const gpa = row.gpaCurrent;

                return (
                  <TableRow
                    key={rowKey}
                    className="text-center text-base font-medium text-dark dark:text-white"
                  >
                    <TableCell className="!text-left font-medium">
                      {returnToUrl ? (
                        <StudentProfileLink
                          sapId={row.sapId}
                          returnToUrl={returnToUrl}
                          courseCode={row.courseId}
                          section={row.sectionCode ?? null}
                          classAverage={classAvg}
                          className="flex flex-col gap-1"
                          title="View profile"
                        >
                          <span className="text-base font-medium text-green-500">
                            {row.studentName ?? "—"}
                          </span>
                          <span className="text-sm text-[#1f4a3d] dark:text-white">
                            SAPID: {row.sapId}
                          </span>
                        </StudentProfileLink>
                      ) : (
                        row.studentName ?? "—"
                      )}
                    </TableCell>
                   
                    <TableCell className="!text-left text-dark-6">
                      {row.departmentName?.replace("Department of", "") ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.programTitle ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      <div className="flex flex-col gap-1">
                        <span>{row.courseId}-{row.courseTitle ?? row.courseId ?? "—"}</span>
                        <span className="text-sm text-[#1f4a3d] dark:text-white">
                          {row.courseStudentCount ?? 0} students
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.instructorName ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {classesHeld === 0 ? "—" : `${classesHeld}`}
                    </TableCell>
                    <TableCell className="!text-left">
                      {attendance != null ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-2">
                            <span className={attendanceColorClass}>
                              {attendance.toFixed(1)}%
                            </span>{" "}
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              ({classesAttended}/{classesHeld})
                            </span>
                          </span>
                          {classAvg != null && (
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              {classAvg.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="!text-left">
                      <span>{typeof gpa === "number" ? gpa.toFixed(2) : "-"}</span>
                    </TableCell>
                    <TableCell className="!text-left">
                      <InterventionStatusBadge
                        status={latestStatus}
                        goodStanding={!hasAnyAlert}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalResults > 0 && rowsPerPage !== "all" && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-dark-6 dark:text-dark-5 sm:flex-row sm:text-sm">
              <div>
                Page{" "}
                <span className="font-semibold text-dark dark:text-white">
                  {currentPage.toLocaleString()}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-dark dark:text-white">
                  {totalPages.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "rounded-md border border-stroke px-3 py-1 text-xs sm:text-sm transition dark:border-dark-3",
                    currentPage === 1
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-gray-100 dark:hover:bg-dark-3"
                  )}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={cn(
                    "rounded-md border border-stroke px-3 py-1 text-xs sm:text-sm transition dark:border-dark-3",
                    currentPage === totalPages
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-gray-100 dark:hover:bg-dark-3"
                  )}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}