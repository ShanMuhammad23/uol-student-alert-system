"use client";

import { useEffect, useRef, useState } from "react";
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
import { TOP_CHANNELS_TABLE_SCROLL_ID } from "./table-scroll-anchor";

type Props = {
  className?: string;
  returnToUrl?: string;
  masterFilter?: MasterFilterParams;
  attendanceFilters?: AlertDimensionFilter[];
  gpaFilters?: AlertDimensionFilter[];
  classStatusFilters?: string[];
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
  eventPackageId?: string | null;
  totalClassesHeld: number;
  attendanceMarkedClasses: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaPrevious: number | null;
  gpaChange: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  latestInterventionStatus: string | null;
  courseStudentCount: number;
  isActive?: boolean;
};

export function TopChannelsTableClient({
  className,
  returnToUrl = "/",
  masterFilter,
  attendanceFilters,
  gpaFilters,
  classStatusFilters,
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
  const [totalUniqueStudents, setTotalUniqueStudents] = useState<
    number | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const roleScope = (() => {
    try {
      const parsed = new URL(returnToUrl, "http://localhost");
      const asRole = parsed.searchParams.get("as")?.trim().toLowerCase();
      const facultyId = parsed.searchParams.get("faculty")?.trim();
      if (asRole === "dean" && facultyId) {
        return { role: "dean" as const, facultyId };
      }
      return undefined;
    } catch {
      return undefined;
    }
  })();

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

  const buildTopTableRequest = (
    page: number,
    pageSize: number,
    uniqueStudentsForTotal: boolean
  ) => {
    const normalizedAttendanceFilters =
      attendanceFilters?.includes("all" as AlertDimensionFilter)
        ? undefined
        : attendanceFilters;
    const normalizedGpaFilters =
      gpaFilters?.includes("all" as AlertDimensionFilter) ? undefined : gpaFilters;
    return {
      page,
      pageSize,
      sortKey: sortConfig?.key ?? "name",
      sortDirection: sortConfig?.direction ?? "asc",
      roleScope,
      filters: {
        ...(masterFilter ?? {}),
        attendanceFilters: normalizedAttendanceFilters,
        gpaFilters: normalizedGpaFilters,
        classStatusFilters:
          classStatusFilters?.length && !classStatusFilters.includes("all")
            ? classStatusFilters.filter((v) => v !== "all")
            : undefined,
        interventionFilters,
        resolutionFilters:
          resolutionFilters?.length && !resolutionFilters.includes("all")
            ? resolutionFilters.filter((v) => v !== "all")
            : undefined,
        search: debouncedSearch || undefined,
      },
      uniqueStudentsForTotal,
    };
  };

  const csvEscape = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const interventionStatusLabel = (status: string | null): string => {
    if (!status) return "Not Started";
    if (status === "in-progress") return "In-Progress";
    if (status === "no-action-required") return "No Action Required";
    return status
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const exportAllFilteredStudentsCsv = async () => {
    setIsExportingCsv(true);
    setError(null);
    // User requested auto switch to all mode before exporting.
    setRowsPerPage("all");
    setCurrentPage(1);
    try {
      const res = await fetch("/api/students/top-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTopTableRequest(1, 100000, false)),
      });
      if (!res.ok) throw new Error("Failed to export student listing");
      const body = (await res.json()) as { rows?: TopTableRow[] };
      const exportRows = Array.isArray(body.rows) ? body.rows : [];

      const headers = [
        "Name",
        "SAP ID",
        "Department",
        "Program",
        "Course",
        "Instructor Name",
        "Classes Held",
        "Attendance %",
        "GPA",
        "Intervention Status",
      ];

      const lines = [headers.join(",")];
      for (const row of exportRows) {
        const classesHeld = row.totalClassesHeld ?? 0;
        const posted = row.attendanceMarkedClasses ?? 0;
        const classesAttended = row.classesAttended ?? 0;
        const attendanceValue =
          row.attendancePercentage != null
            ? `${row.attendancePercentage.toFixed(1)}% (${classesAttended}/${posted})`
            : "—";
        const gpaValue =
          typeof row.gpaCurrent === "number" ? row.gpaCurrent.toFixed(2) : "—";
        const courseValue = `${row.courseId}-${row.courseTitle ?? row.courseId ?? "—"}`;

        const values = [
          row.studentName ?? "—",
          row.sapId ?? "—",
          row.departmentName?.replace("Department of", "") ?? "—",
          row.programTitle ?? "—",
          courseValue,
          row.instructorName ?? "—",
          classesHeld === 0 ? "—" : String(classesHeld),
          attendanceValue,
          gpaValue,
          interventionStatusLabel(row.latestInterventionStatus),
        ].map((v) => csvEscape(String(v)));
        lines.push(values.join(","));
      }

      const csv = lines.join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `student-top-table-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsExportingCsv(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setError(null);
    const effectivePageSize = rowsPerPage === "all" ? 100000 : rowsPerPage;
    fetch("/api/students/top-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(
        buildTopTableRequest(currentPage, effectivePageSize, true)
      ),
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to load students"))
      )
      .then((body: {
        rows?: TopTableRow[];
        total?: number;
        totalUniqueStudents?: number;
      }) => {
        const incomingRows = Array.isArray(body.rows) ? body.rows : [];
        // Defensive client-side guard: render only active enrollments.
        setRows(incomingRows.filter((row) => row.isActive !== false));
        setTotalResults(Number(body.total ?? 0));
        setTotalUniqueStudents(
          (body.totalUniqueStudents ?? (body as any).total_unique_students) == null
            ? null
            : Number(body.totalUniqueStudents ?? (body as any).total_unique_students)
        );
        hasLoadedOnceRef.current = true;
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
    classStatusFilters,
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
    classStatusFilters,
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
    return <TopChannelsSkeleton className={className} />;
  }

  if (error) {
    return (
      <div
        id={TOP_CHANNELS_TABLE_SCROLL_ID}
        className={cn(
          "scroll-mt-24 rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
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
      id={TOP_CHANNELS_TABLE_SCROLL_ID}
      className={cn(
        "scroll-mt-24 grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12 overflow-x-auto",
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
                Total Students:{" "}
                <span className="font-semibold text-dark dark:text-white">
                  {(totalUniqueStudents ?? totalResults).toLocaleString()}
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
                  </span>{" "} rows out
                  of{" "}
                  <span className="font-semibold text-dark dark:text-white">
                    {totalResults.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center md:ml-auto">
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
              <button
                type="button"
                onClick={exportAllFilteredStudentsCsv}
                disabled={isExportingCsv}
                className={cn(
                  "inline-flex h-[42px] shrink-0 items-center justify-center rounded-lg border border-primary px-4 text-sm font-medium text-primary transition hover:bg-primary/10",
                  "focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {isExportingCsv ? "Exporting..." : "Export CSV"}
              </button>
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
                    <span className="whitespace-normal leading-tight">
                      Classes Held{" "}
                      <span className="block text-[10px] font-normal normal-case text-dark-6 dark:text-dark-5">
                        vs posted below
                      </span>
                    </span>
                    {renderSortIcon("classesHeld")}
                  </div>
                </TableHead>
                <TableHead
                  className="min-w-[160px] !text-left cursor-pointer select-none"
                  onClick={() => handleSort("attendance")}
                >
                  <div className="flex items-center gap-1">
                    <span className="whitespace-normal leading-tight">
                      Attendance %{" "}
                      <span className="block text-[10px] font-normal normal-case text-dark-6 dark:text-dark-5">
                        attended / posted
                      </span>
                    </span>
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
                const rowKey = `${row.sapId}-${row.courseId}-${row.sectionCode ?? ""}-${row.eventPackageId ?? ""}-${row.programTitle ?? ""}-${row.instructorName ?? ""}`;
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
                const attendancePosted = row.attendanceMarkedClasses ?? 0;
                const classesAttended = row.classesAttended ?? 0;
                const notUpdatedVsHeld = classesHeld - attendancePosted;
                const attendance = row.attendancePercentage;
                const classAvg = row.classAverageAttendance;
                const gpa = row.gpaCurrent;
                const gpaPrev = row.gpaPrevious;
                const gpaChange = row.gpaChange;
                const gpaLevel = row.gpaAlertLevel ?? null;
                const gpaValueColorClass =
                  gpaLevel === "critical"
                    ? "text-red-600 dark:text-red-500"
                    : gpaLevel === "warning"
                      ? "text-yellow-600 dark:text-yellow-500"
                      : "";
                const hasTrend =
                  typeof gpaChange === "number" && Number.isFinite(gpaChange);
                const isDrop = hasTrend && gpaChange < 0;
                const gpaDeviationClass =
                  gpaLevel === "critical"
                    ? "text-red-600 dark:text-red-500"
                    : gpaLevel === "warning"
                      ? "text-yellow-600 dark:text-yellow-500"
                      : hasTrend
                        ? "text-dark dark:text-white"
                        : "text-dark-6 dark:text-dark-5";

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
                    <TableCell className="!text-left text-sm">
                      {row.programTitle ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{row.courseId}-{row.courseTitle ?? row.courseId ?? "—"}</span>
                        {row.eventPackageId ? (
                          <span className="text-xs text-dark-6 dark:text-white">
                            Class Instance: {row.eventPackageId}
                          </span>
                        ) : null}
                        <span className="text-sm text-[#1f4a3d] dark:text-white">
                          {row.courseStudentCount ?? 0} students
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!text-left text-sm">
                      {row.instructorName ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {classesHeld === 0 ? (
                        "—"
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span>{classesHeld}</span>
                          <span className="text-xs text-dark-6 dark:text-dark-5">
                            Posted: {attendancePosted}
                          </span>
                          {notUpdatedVsHeld === 0 ? (
                            <span className="text-green-500 text-xs">
                             Posted
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "text-xs",
                                notUpdatedVsHeld > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {notUpdatedVsHeld < 0 ? "Duplicate Posting" : "Not Posted"} ({notUpdatedVsHeld})
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="!text-left">
                      {attendance != null ? (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-2">
                            <span className={attendanceColorClass}>
                              {attendance.toFixed(1)}%
                            </span>{" "}
                            <span className="text-xs text-dark-6 dark:text-white">
                              ({classesAttended}/{attendancePosted})
                            </span>
                          </span>
                          {classAvg != null && (
                            <span className="text-xs text-dark-6 dark:text-white">
                              Class Avg: {classAvg.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="!text-left">
                      <div className="flex flex-col">
                        <span className={gpaValueColorClass}>
                          {typeof gpa === "number" ? gpa.toFixed(2) : "-"}
                        </span>
                        <span className={cn("text-xs", gpaDeviationClass)}>
                          {hasTrend ? (
                            <>
                              {isDrop ? (
                                <span className="text-red-600 dark:text-red-400">▼</span>
                              ) : (
                                <span className="text-green-500 dark:text-green-400">▲</span>
                              )}{" "}
                              {Math.abs(gpaChange).toFixed(2)}
                              {typeof gpaPrev === "number" ? ` vs ${gpaPrev.toFixed(2)}` : ""}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
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