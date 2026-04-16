"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { useDashboardUiState } from "@/app/(home)/dashboard/_components/DashboardUiStateContext";
import { calculateMissingAttendance } from "@/lib/attendance-missing";

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

type CourseSummary = {
  key: string;
  courseId: string;
  courseTitle: string;
  sectionCode: string | null;
  eventPackageId: string | null;
  instructors: Set<string>;
  held: number;
  posted: number;
  missing: number;
  students: Set<string>;
};

type ProgramSummary = {
  name: string;
  courses: Map<string, CourseSummary>;
};

type DepartmentSummary = {
  name: string;
  programs: Map<string, ProgramSummary>;
};

export function AttendanceMissingTableClient({
  className,
  returnToUrl = "/",
  masterFilter,
  attendanceFilters,
  gpaFilters,
  classStatusFilters,
  interventionFilters,
  resolutionFilters,
}: Props) {
  const { expandedIds, setExpandedIds, setAttendanceMissingTotal } = useDashboardUiState();
  const [rows, setRows] = useState<TopTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const roleScope = useMemo(() => {
    try {
      const parsed = new URL(returnToUrl, "http://localhost");
      const asRole = parsed.searchParams.get("as")?.trim().toLowerCase();
      const facultyId = parsed.searchParams.get("faculty")?.trim();
      if (asRole === "dean" && facultyId) {
        return { role: "dean" as const, facultyId };
      }
      if (asRole === "wellbeing") {
        return { role: "wellbeing" as const };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }, [returnToUrl]);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setError(null);
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
        page: 1,
        pageSize: 100000,
        sortKey: "department",
        sortDirection: "asc",
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
        },
      }),
    })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Failed to load attendance missing summary"))
      )
      .then((body: { rows?: TopTableRow[] }) => {
        const incomingRows = Array.isArray(body.rows) ? body.rows : [];
        setRows(incomingRows.filter((row) => row.isActive !== false));
        hasLoadedOnceRef.current = true;
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setRows([]);
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
    roleScope,
  ]);

  const summaryByDepartment = useMemo(() => {
    // Match `/api/dashboard/overview`: merge max(held) and max(posted) across *all* enrollments
    // per class key, then compute missing once. Skipping rows with per-student missing <= 0
    // would under-merge held/posted and inflate totals vs the overview card.
    type ClassAgg = {
      courseKey: string;
      courseId: string;
      courseTitle: string;
      sectionCode: string | null;
      eventPackageId: string | null;
      deptName: string;
      programName: string;
      held: number;
      posted: number;
      instructors: Set<string>;
      students: Set<string>;
    };
    const byClass = new Map<string, ClassAgg>();

    for (const row of rows) {
      const held = Number(row.totalClassesHeld ?? 0);
      const posted = Number(row.attendanceMarkedClasses ?? 0);
      const courseKey = `${row.courseId}__${row.sectionCode ?? "NO_SECTION"}__${row.eventPackageId ?? "NO_EVENT_PACKAGE"}__${row.courseTitle ?? row.courseId}`;
      const deptName = row.departmentName || "Unknown Department";
      const programName = row.programTitle || "Unknown Program";

      let agg = byClass.get(courseKey);
      if (!agg) {
        agg = {
          courseKey,
          courseId: row.courseId,
          courseTitle: row.courseTitle ?? row.courseId,
          sectionCode: row.sectionCode ?? null,
          eventPackageId: row.eventPackageId ?? null,
          deptName,
          programName,
          held,
          posted,
          instructors: new Set<string>(),
          students: new Set<string>(),
        };
        byClass.set(courseKey, agg);
      } else {
        if (held > agg.held) agg.held = held;
        if (posted > agg.posted) agg.posted = posted;
      }
      agg.instructors.add(row.instructorName || "—");
      agg.students.add(row.sapId);
    }

    const depts = new Map<string, DepartmentSummary>();
    for (const agg of byClass.values()) {
      const missing = calculateMissingAttendance(agg.held, agg.posted);
      if (missing <= 0) continue;

      const deptName = agg.deptName;
      const programName = agg.programName;

      if (!depts.has(deptName)) {
        depts.set(deptName, { name: deptName, programs: new Map() });
      }
      const dept = depts.get(deptName)!;

      if (!dept.programs.has(programName)) {
        dept.programs.set(programName, {
          name: programName,
          courses: new Map(),
        });
      }
      const program = dept.programs.get(programName)!;

      program.courses.set(agg.courseKey, {
        key: agg.courseKey,
        courseId: agg.courseId,
        courseTitle: agg.courseTitle,
        sectionCode: agg.sectionCode,
        eventPackageId: agg.eventPackageId,
        instructors: agg.instructors,
        held: agg.held,
        posted: agg.posted,
        missing,
        students: agg.students,
      });
    }
    return depts;
  }, [rows]);

  const sortedDepartments = useMemo(
    () => Array.from(summaryByDepartment.keys()).sort((a, b) => a.localeCompare(b)),
    [summaryByDepartment]
  );

  const totalMissingAttendance = useMemo(() => {
    let total = 0;
    for (const dept of summaryByDepartment.values()) {
      for (const program of dept.programs.values()) {
        for (const course of program.courses.values()) {
          total += course.missing;
        }
      }
    }
    return total;
  }, [summaryByDepartment]);

  useEffect(() => {
    setAttendanceMissingTotal(totalMissingAttendance);
  }, [setAttendanceMissingTotal, totalMissingAttendance]);

  useEffect(() => {
    return () => setAttendanceMissingTotal(null);
  }, [setAttendanceMissingTotal]);

  const csvEscape = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const exportFilteredAttendanceMissingCsv = () => {
    setIsExportingCsv(true);
    try {
      const headers = [
        "Instructor",
        "Course",
        "Program",
        "Department",
        "Classes Held",
        "Attendance Posted",
        "Not Updated",
        "Difference",
      ];

      const lines = [headers.join(",")];

      for (const deptName of sortedDepartments) {
        const dept = summaryByDepartment.get(deptName);
        if (!dept) continue;
        const programs = Array.from(dept.programs.keys()).sort((a, b) =>
          a.localeCompare(b)
        );
        for (const programName of programs) {
          const program = dept.programs.get(programName);
          if (!program) continue;
          const courses = Array.from(program.courses.values()).sort((a, b) =>
            a.courseId.localeCompare(b.courseId)
          );
          for (const course of courses) {
            const values = [
              Array.from(course.instructors).join(", "),
              `${course.courseId}${
                course.courseTitle && course.courseTitle !== course.courseId
                  ? ` (${course.courseTitle})`
                  : ""
              }${course.sectionCode ? ` [Section: ${course.sectionCode}]` : ""}`,
              programName,
              deptName.replace(/^Department of\s+/i, ""),
              String(course.held),
              String(course.posted),
              String(course.missing),
              String(calculateMissingAttendance(course.held, course.posted)),
            ].map((v) => csvEscape(String(v)));
            lines.push(values.join(","));
          }
        }
      }

      const csv = lines.join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `attendance-missing-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingCsv(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          Loading attendance missing summary...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-red-500 bg-red-50 dark:bg-red-950/30 py-8 text-center text-red-700 dark:text-red-400">
          <p className="font-medium">Failed to load attendance missing summary</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (sortedDepartments.length === 0) {
    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No attendance missing data found.
        </div>
      </div>
    );
  }

  const openAccordionBg = "bg-primary dark:bg-primary/10";
  const closedAccordionBg = "bg-gray-50 dark:bg-dark-2";

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
        className
      )}
    >
      {expandedIds.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={exportFilteredAttendanceMissingCsv}
            disabled={isExportingCsv}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-primary",
              "border-primary text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isExportingCsv ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => setExpandedIds([])}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-primary",
              "bg-white border-stroke hover:bg-gray-50 dark:bg-gray-dark dark:border-dark-3 dark:hover:bg-dark-3"
            )}
          >
            Collapse all
          </button>
        </div>
      )}

      {expandedIds.length === 0 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={exportFilteredAttendanceMissingCsv}
            disabled={isExportingCsv}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-primary",
              "border-primary text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isExportingCsv ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {sortedDepartments.map((deptName) => {
          const dept = summaryByDepartment.get(deptName)!;
          const deptSectionId = `attendance-missing-dept-${deptName.replace(/\s+/g, "-")}`;
          const deptIsOpen = expandedIds.includes(deptSectionId);
          const programs = Array.from(dept.programs.keys()).sort((a, b) =>
            a.localeCompare(b)
          );

          let deptMissing = 0;
          let deptCourseCount = 0;
          for (const p of dept.programs.values()) {
            for (const c of p.courses.values()) {
              deptMissing += c.missing;
              deptCourseCount += 1;
            }
          }

          return (
            <details
              key={deptName}
              data-section-id={deptSectionId}
              open={deptIsOpen}
              className={cn(
                "rounded-md border border-stroke dark:border-dark-3",
                deptIsOpen ? openAccordionBg : closedAccordionBg
              )}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      "text-base font-semibold",
                      deptIsOpen ? "text-white" : "text-dark dark:text-white"
                    )}
                  >
                    Department:{" "}
                    <span className="font-bold">
                      {deptName.replace(/^Department of\s+/i, "")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      deptIsOpen ? "text-white" : "text-dark-6 dark:text-dark-5"
                    )}
                  >
                    Missing attendance records:{" "}
                    <span className="font-semibold text-red-600">{deptMissing}</span>
                    {" · "}
                    Affected courses:{" "}
                    <span className="font-semibold">{deptCourseCount}</span>
                  </span>
                </div>
                <span
                  className={cn(
                    "ml-auto text-xs transition-transform duration-200 ease-in-out",
                    deptIsOpen ? "rotate-180 text-white" : "text-dark-6 dark:text-dark-5"
                  )}
                >
                  ▼
                </span>
              </summary>

              <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                <div className="space-y-3">
                  {programs.map((programName) => {
                    const program = dept.programs.get(programName)!;
                    const progSectionId = `${deptSectionId}-prog-${programName.replace(
                      /\s+/g,
                      "-"
                    )}`;
                    const progIsOpen = expandedIds.includes(progSectionId);
                    const courses = Array.from(program.courses.values()).sort((a, b) =>
                      a.courseId.localeCompare(b.courseId)
                    );
                    const programMissing = courses.reduce((sum, c) => sum + c.missing, 0);

                    return (
                      <details
                        key={programName}
                        data-section-id={progSectionId}
                        open={progIsOpen}
                        className={cn(
                          "rounded-md border border-stroke dark:border-dark-3",
                          progIsOpen ? openAccordionBg : closedAccordionBg
                        )}
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                progIsOpen ? "text-white" : "text-dark dark:text-white"
                              )}
                            >
                              Program: <span className="font-bold">{programName}</span>
                            </span>
                            <span
                              className={cn(
                                "text-sm",
                                progIsOpen ? "text-white" : "text-dark-6 dark:text-dark-5"
                              )}
                            >
                              Missing attendance records:{" "}
                              <span className="font-semibold text-red-600">
                                {programMissing}
                              </span>
                              {" · "}
                              Affected courses:{" "}
                              <span className="font-semibold">{courses.length}</span>
                            </span>
                          </div>
                          <span
                            className={cn(
                              "ml-auto text-xs transition-transform duration-200 ease-in-out",
                              progIsOpen
                                ? "rotate-180 text-white"
                                : "text-dark-6 dark:text-dark-5"
                            )}
                          >
                            ▼
                          </span>
                        </summary>

                        <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                          <div className="space-y-2">
                            {courses.map((course) => (
                              <div
                                key={course.key}
                                className="rounded-md border border-stroke bg-gray-50 px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                              >
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="text-sm font-semibold text-dark dark:text-white">
                                    Course:{" "}
                                    <span className="font-bold text-primary dark:text-green">
                                      {course.courseId}
                                    </span>
                                    {course.sectionCode && (
                                      <span className="ml-2 text-xs font-normal text-dark-6 dark:text-dark-5">
                                        [Section: {course.sectionCode}]
                                      </span>
                                    )}
                                    {course.courseTitle &&
                                      course.courseTitle !== course.courseId && (
                                        <span className="ml-2 text-xs font-normal text-dark-6 dark:text-dark-5">
                                          ({course.courseTitle})
                                        </span>
                                      )}
                                  </div>
                                  <div className="text-xs text-dark-6 dark:text-dark-5">
                                    Instructor(s):{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {Array.from(course.instructors).join(", ")}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                                  <span className="text-dark-6 dark:text-dark-5">
                                    Held:{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {course.held}
                                    </span>
                                  </span>
                                  <span className="text-dark-6 dark:text-dark-5">
                                    Posted:{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {course.posted}
                                    </span>
                                  </span>
                                  <span className="text-dark-6 dark:text-dark-5">
                                    Missing:{" "}
                                    <span className="font-semibold text-red-600">
                                      {course.missing}
                                    </span>
                                  </span>
                                  <span className="text-dark-6 dark:text-dark-5">
                                    Students:{" "}
                                    <span className="font-semibold text-dark dark:text-white">
                                      {course.students.size}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
