"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { useMonitoringStudents } from "@/hooks/useMonitoringStudents";
import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { StudentProfileLink } from "./StudentProfileLink";
import { TopChannelsSkeleton } from "./skeleton";
import {
  getAttendanceSummariesForEnrollments,
  getEnrollmentAttendanceKey,
  type AttendanceSummary,
  getAttendanceAlertLevel,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import type { AlertDimensionFilter } from "@/app/(home)/dashboard/fetch";

type Props = {
  className?: string;
  returnToUrl?: string;
  /** When provided (e.g. from enrollment hook + MasterFilter), used instead of fetching. Table shows filtered data. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Attendance alert filters (red / yellow / good) from MasterFilter. */
  attendanceFilters?: AlertDimensionFilter[];
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

/**
 * Deduplicate enrollment records by unique ID
 * This fixes the bug where duplicate records (like Hafiz Shabbir Ahmed and Hafiz Ismail)
 * were appearing multiple times regardless of filters
 */
function deduplicateEnrollments(data: EnrollmentRecord[]): EnrollmentRecord[] {
  const seen = new Set<string>();
  return data.filter((record) => {
    const id = record.Id ?? `${record.SapNo}-${record.CrCode}-${record.Section}`;
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function TopChannelsTableClient({
  className,
  returnToUrl = "/",
  enrollmentData: enrollmentDataProp,
  attendanceFilters,
}: Props) {
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(!enrollmentDataProp);
  const [error, setError] = useState<Error | null>(null);
  const [sortConfig, setSortConfig] = useState<
    { key: SortKey; direction: SortDirection } | null
  >(null);
  const [rowsPerPage, setRowsPerPage] = useState<number | "all">(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [attendanceSummaries, setAttendanceSummaries] = useState<
    Map<string, AttendanceSummary> | null
  >(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Track previous prop data to detect actual changes
  const prevPropDataRef = useRef<EnrollmentRecord[] | null | undefined>(null);

  // CRITICAL FIX: Always deduplicate prop data to prevent duplicate records
  const hasPropData = enrollmentDataProp != null && Array.isArray(enrollmentDataProp);
  
  // Apply deduplication to prevent Hafiz Shabbir Ahmed and Hafiz Ismail duplicates
  const deduplicatedPropData = useMemo(() => {
    if (!hasPropData) return [];
    return deduplicateEnrollments(enrollmentDataProp);
  }, [enrollmentDataProp, hasPropData]);

  // Use deduplicated data when prop is provided, otherwise use fetched state
  const displayEnrollments = hasPropData ? deduplicatedPropData : enrollments;

  const { data: monitoringData } = useMonitoringStudents();

  const monitoredByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    const classes = monitoringData?.classes ?? [];
    for (const c of classes) {
      const key = `${normalizeCourseCode(
        typeof c.CrCode === "string" ? c.CrCode : String(c.CrCode ?? "")
      )}__${c.SecCode ?? ""}`;
      map.set(key, (map.get(key) ?? 0) + (c.Att ?? 0));
    }
    return map;
  }, [monitoringData]);

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

  const sortedEnrollments = useMemo(() => {
    const rows = [...displayEnrollments];
    if (!sortConfig) return rows;

    const { key, direction } = sortConfig;
    const factor = direction === "asc" ? 1 : -1;

    return rows.sort((a, b) => {
      const getString = (value: unknown) =>
        typeof value === "string" ? value.toLowerCase() : (value ?? "").toString().toLowerCase();
      const getNumber = (value: unknown) =>
        typeof value === "number" ? value : value == null ? 0 : Number(value) || 0;

      switch (key) {
        case "name": {
          const aName = getString(a.Name);
          const bName = getString(b.Name);
          if (aName === bName) {
            return a.SapNo.localeCompare(b.SapNo) * factor;
          }
          return aName.localeCompare(bName) * factor;
        }
        case "department": {
          const aDept = getString(a.DeptName);
          const bDept = getString(b.DeptName);
          return aDept.localeCompare(bDept) * factor;
        }
        case "program": {
          const aProgram = getString(a.DegreeTitle ?? a.DegreeCode);
          const bProgram = getString(b.DegreeTitle ?? b.DegreeCode);
          return aProgram.localeCompare(bProgram) * factor;
        }
        case "course": {
          const aCourse = getString(`${a.CrCode ?? ""} ${a.CrTitle ?? ""}`);
          const bCourse = getString(`${b.CrCode ?? ""} ${b.CrTitle ?? ""}`);
          return aCourse.localeCompare(bCourse) * factor;
        }
        case "teacher": {
          const aTeacher = getString(a.Teacher);
          const bTeacher = getString(b.Teacher);
          return aTeacher.localeCompare(bTeacher) * factor;
        }
        case "classesHeld": {
          const aKey = `${normalizeCourseCode(
            typeof a.CrCode === "string" ? a.CrCode : String(a.CrCode ?? "")
          )}__${a.Section ?? ""}`;
          const bKey = `${normalizeCourseCode(
            typeof b.CrCode === "string" ? b.CrCode : String(b.CrCode ?? "")
          )}__${b.Section ?? ""}`;
          const aVal = getNumber(monitoredByCourseSection.get(aKey));
          const bVal = getNumber(monitoredByCourseSection.get(bKey));
          return (aVal - bVal) * factor;
        }
        case "attendance":
        case "gpa":
        case "intervention":
        default:
          return 0;
      }
    });
  }, [displayEnrollments, monitoredByCourseSection, sortConfig]);

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
    // CRITICAL FIX: Check if prop data has actually changed to prevent stale renders
    const propDataChanged = 
      enrollmentDataProp !== prevPropDataRef.current ||
      (enrollmentDataProp && prevPropDataRef.current && 
       enrollmentDataProp.length !== prevPropDataRef.current.length);

    if (hasPropData && !propDataChanged) {
      // Data hasn't changed, skip processing
      setIsLoading(false);
      return;
    }

    // Update ref to current prop data
    prevPropDataRef.current = enrollmentDataProp;

    if (hasPropData) {
      // Prop data provided - use it directly (deduplicated via useMemo above)
      setIsLoading(false);
      setError(null);
      // Clear internal state when using props to prevent stale data mixing
      setEnrollments([]);
      return;
    }

    // No prop data - fetch from API
    let cancelled = false;
    fetch("/api/enrollment", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load enrollment data");
        return res.json();
      })
      .then((raw: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(raw) ? (raw as EnrollmentRecord[]) : [];
        // Also deduplicate fetched data
        const deduplicated = deduplicateEnrollments(list);
        setEnrollments(deduplicated);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enrollmentDataProp]);

  useEffect(() => {
    const rows = displayEnrollments;
    if (!rows.length) {
      setAttendanceSummaries(null);
      return;
    }

    setIsAttendanceLoading(true);
    getAttendanceSummariesForEnrollments(rows, monitoredByCourseSection)
      .then((map) => {
        setAttendanceSummaries(map);
      })
      .catch(() => {
        setAttendanceSummaries(null);
      })
      .finally(() => {
        setIsAttendanceLoading(false);
      });
  }, [displayEnrollments, monitoredByCourseSection]);

  // Calculate student count per course
  const courseIdToStudentCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of displayEnrollments) {
      const key = e.CrCode ?? e.CrTitle ?? "";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [displayEnrollments]);

  const [searchQuery, setSearchQuery] = useState("");

  const classAverageByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    const counts = new Map<string, number>();
    if (!attendanceSummaries) return map;

    for (const row of displayEnrollments) {
      const sectionKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? "")
      )}__${row.Section ?? ""}`;
      const attKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attKey);
      if (!summary) continue;

      const prevSum = map.get(sectionKey) ?? 0;
      const prevCount = counts.get(sectionKey) ?? 0;
      map.set(sectionKey, prevSum + summary.percentage);
      counts.set(sectionKey, prevCount + 1);
    }

    for (const [key, sum] of map.entries()) {
      const count = counts.get(key) ?? 1;
      map.set(key, sum / count);
    }

    return map;
  }, [attendanceSummaries, displayEnrollments]);

  const filteredAndSortedEnrollments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = q
      ? sortedEnrollments.filter((row) => {
          const name = (row.Name ?? "").toLowerCase();
          const sap = (row.SapNo ?? "").toLowerCase();
          return name.includes(q) || sap.includes(q);
        })
      : sortedEnrollments;

    if (attendanceFilters?.length && attendanceSummaries) {
      const allowed = new Set<string | null>();
      for (const f of attendanceFilters) {
        if (f === "red") allowed.add("critical");
        else if (f === "yellow") allowed.add("warning");
        else if (f === "good") allowed.add(null);
      }
      base = base.filter((row) => {
        const courseKey = row.CrCode ?? row.CrTitle ?? "";
        const rowKey =
          row.Id ?? `${row.SapNo}-${courseKey}-${row.CrTitle}-${row.Name}`;
        const monitorKey = `${normalizeCourseCode(
          typeof row.CrCode === "string"
            ? row.CrCode
            : String(row.CrCode ?? "")
        )}__${row.Section ?? ""}`;
        const attendanceKey = getEnrollmentAttendanceKey(row);
        const summary = attendanceSummaries.get(attendanceKey);
        const classAvg =
          classAverageByCourseSection.get(monitorKey ?? "") ?? null;
        const level =
          summary && classAvg != null
            ? getAttendanceAlertLevel(summary.percentage, classAvg)
            : null;
        return allowed.size ? allowed.has(level) : true;
      });
    }

    return base;
  }, [
    searchQuery,
    sortedEnrollments,
    attendanceFilters,
    attendanceSummaries,
    classAverageByCourseSection,
  ]);

  const totalResults = filteredAndSortedEnrollments.length;

  const totalPages =
    rowsPerPage === "all" || totalResults === 0
      ? 1
      : Math.ceil(totalResults / rowsPerPage);

  useEffect(() => {
    // Reset to first page whenever filters/search/sort or page size change
    setCurrentPage(1);
  }, [searchQuery, attendanceFilters, sortConfig, rowsPerPage]);

  useEffect(() => {
    // Clamp current page when total results change
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [currentPage, totalPages]);

  const paginatedEnrollments = useMemo(() => {
    if (rowsPerPage === "all") {
      return filteredAndSortedEnrollments;
    }
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredAndSortedEnrollments.slice(startIndex, endIndex);
  }, [filteredAndSortedEnrollments, rowsPerPage, currentPage]);

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

  if (!hasPropData && isLoading) {
    return <TopChannelsSkeleton />;
  }

  if (!hasPropData && error) {
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
      {displayEnrollments.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No enrollment data found.
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
                  className="min-w-[140px] !text-left cursor-pointer select-none"
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
              {paginatedEnrollments.map((row) => {
                const courseKey = row.CrCode ?? row.CrTitle ?? "";
                const totalForCourse = courseIdToStudentCount.get(courseKey) ?? 0;
                const rowKey = row.Id ?? `${row.SapNo}-${courseKey}-${row.CrTitle}-${row.Name}`;
                const monitorKey = `${normalizeCourseCode(
                  typeof row.CrCode === "string"
                    ? row.CrCode
                    : String(row.CrCode ?? "")
                )}__${row.Section ?? ""}`;
                const monitoredCount = monitoredByCourseSection.get(monitorKey);
                const attendanceKey = getEnrollmentAttendanceKey(row);
                const summary = attendanceSummaries?.get(attendanceKey);
                const classAvg =
                  classAverageByCourseSection.get(monitorKey ?? "") ?? null;
                const alertLevel =
                  summary && classAvg != null
                    ? getAttendanceAlertLevel(summary.percentage, classAvg)
                    : null;
                const attendanceColorClass =
                  alertLevel === "critical"
                    ? "text-red-600"
                    : alertLevel === "warning"
                    ? "text-yellow-600"
                    : "";

                return (
                  <TableRow
                    key={rowKey}
                    className="text-center text-base font-medium text-dark dark:text-white"
                  >
                    <TableCell className="!text-left font-medium">
                      {returnToUrl ? (
                        <StudentProfileLink
                          sapId={row.SapNo}
                          returnToUrl={returnToUrl}
                          className="flex flex-col gap-1"
                          title="View profile"
                        >
                          <span className="text-base font-medium text-green-500">{row.Name ?? "—"}</span>
                          <span className="text-sm text-[#1f4a3d]">SAPID: {row.SapNo}</span>
                        </StudentProfileLink>
                      ) : (
                        row.Name ?? "—"
                      )}
                    </TableCell>
                   
                    <TableCell className="!text-left text-dark-6">
                      {row.DeptName.replace("Department of", "") ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.DegreeTitle ?? row.DegreeCode ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      <div className="flex flex-col gap-1">
                        <span>{row.CrCode}-{row.CrTitle ?? row.CrCode ?? "—"}</span>
                        <span className="text-sm text-[#1f4a3d]">
                          {totalForCourse} students
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="!text-left">
                      {row.Teacher ?? "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {monitoredCount != null ? monitoredCount : "—"}
                    </TableCell>
                    <TableCell className="!text-left">
                      {summary ? (
                        <div className="flex flex-col">
                          <span className={attendanceColorClass}>
                            {summary.percentage.toFixed(1)}%
                          </span>
                          {classAvg != null && (
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              {classAvg.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : isAttendanceLoading ? (
                        "Calculating..."
                      ) : monitoredCount != null ? (
                        `0.0% (0/${monitoredCount})`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="!text-left">
                      -
                    </TableCell>
                    <TableCell className="!text-left">-</TableCell>
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