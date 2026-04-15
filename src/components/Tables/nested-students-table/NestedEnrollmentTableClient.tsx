"use client";

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
import type { DepartmentStats, ProgramStats, InstructorStats } from "@/lib/enrollment";
import { StudentProfileLink } from "./StudentProfileLink";
import { useDashboardUiState } from "@/app/(home)/dashboard/_components/DashboardUiStateContext";
import {
  getEnrollmentAttendanceKey,
  getAttendanceAlertLevel,
  normalizeCourseCode,
} from "@/lib/attendance-utils";
import { InterventionStatusBadge } from "@/app/(home)/dashboard/_components/intervention-status-badge";
import { useEffect, useMemo, useState } from "react";
import type {
  AlertDimensionFilter,
  MasterFilterParams,
  CourseStats,
} from "@/app/(home)/dashboard/fetch";

type NestedEnrollmentRow = EnrollmentRecord & {
  gpaCurrent: number | null;
  gpaPrevious: number | null;
  gpaChange: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  totalClassesHeld: number;
  attendanceMarkedClasses: number;
  classesAttended: number;
  latestInterventionStatus: string | null;
};

type GroupedEnrollment = {
  byDept: Map<
    string,
    Map<string, Map<string, NestedEnrollmentRow[]>>
  >;
};

function toClassContextKey(params: {
  courseCode: string;
  sectionCode?: string | null;
  eventPackageId?: string | null;
  programTitle?: string | null;
  instructorName?: string | null;
}): string {
  return [
    normalizeCourseCode(params.courseCode),
    (params.sectionCode ?? "").trim(),
    (params.eventPackageId ?? "").trim(),
    (params.programTitle ?? "").trim().toLowerCase(),
    (params.instructorName ?? "").trim().toLowerCase(),
  ].join("__");
}

function groupEnrollmentByDeptProgramCourse(
  records: NestedEnrollmentRow[]
): GroupedEnrollment {
  const byDept = new Map<
    string,
    Map<string, Map<string, NestedEnrollmentRow[]>>
  >();

  for (const row of records) {
    const deptName = row.DeptName ?? "Unknown Department";
    const program = row.DegreeTitle ?? row.DegreeCode ?? "Unknown Program";
    const courseCode = String(row.CrCode ?? row.CrTitle ?? "Unknown Course");
    const sectionCode = String(row.Section ?? "").trim();
    const instructorName = String(row.Teacher ?? "").trim();
    const eventPackageId = String(
      (row as unknown as { Packnumber?: string }).Packnumber ?? ""
    ).trim();
    const courseKey = `${courseCode}__${sectionCode}__${eventPackageId}__${instructorName}`;

    if (!byDept.has(deptName)) {
      byDept.set(deptName, new Map());
    }
    const byProgram = byDept.get(deptName)!;
    if (!byProgram.has(program)) {
      byProgram.set(program, new Map());
    }
    const byCourse = byProgram.get(program)!;
    if (!byCourse.has(courseKey)) {
      byCourse.set(courseKey, []);
    }
    byCourse.get(courseKey)!.push(row);
  }

  return { byDept };
}

type Props = {
  className?: string;
  returnToUrl?: string;
  /** Enrollment data (same source as table view). When null/empty, shows empty state. */
  enrollmentData: EnrollmentRecord[] | null;
  masterFilter?: MasterFilterParams;
  /** Attendance alert filters (red / yellow / good) from MasterFilter. */
  attendanceFilters?: AlertDimensionFilter[];
  /** GPA alert filters (red / yellow / good) from MasterFilter. */
  gpaFilters?: AlertDimensionFilter[];
  classStatusFilters?: string[];
  interventionFilters?: string[];
  resolutionFilters?: string[];
  /** Optional server stats; when provided, badges use this single source of truth. */
  departmentStats?: DepartmentStats[];
  programStats?: ProgramStats[];
  courseStats?: CourseStats[];
  instructorStats?: InstructorStats[];
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
  latestWellbeingStatus?: "open" | "closed" | null;
  latestWellbeingCategory?: string | null;
};

export function NestedEnrollmentTableClient({
  className,
  returnToUrl = "/",
  enrollmentData: _enrollmentData,
  masterFilter,
  attendanceFilters,
  gpaFilters,
  classStatusFilters,
  interventionFilters,
  resolutionFilters,
  departmentStats,
  programStats,
  courseStats,
  instructorStats,
}: Props) {
  const { expandedIds, setExpandedIds } = useDashboardUiState();
  const [dbRows, setDbRows] = useState<TopTableRow[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);
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
    const controller = new AbortController();
    setIsLoadingDb(true);
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
        sortKey: "name",
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
        res.ok ? res.json() : Promise.reject(new Error("Failed to load nested students"))
      )
      .then((body: { rows?: TopTableRow[] }) => {
        setDbRows(Array.isArray(body.rows) ? body.rows : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setDbRows([]);
      })
      .finally(() => setIsLoadingDb(false));
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

  const list = useMemo<NestedEnrollmentRow[]>(
    () =>
      dbRows.map((r) => ({
        SapNo: r.sapId,
        Name: r.studentName,
        DeptCode: r.departmentName,
        DeptId: r.departmentName,
        DeptName: r.departmentName,
        DegreeTitle: r.programTitle,
        CrCode: r.courseId,
        CrTitle: r.courseTitle,
        Teacher: r.instructorName,
        Section: r.sectionCode ?? "",
        Packnumber: r.eventPackageId ?? undefined,
        Id: `${r.sapId}-${r.courseId}-${r.sectionCode ?? ""}-${r.eventPackageId ?? ""}`,
        gpaCurrent: r.gpaCurrent ?? null,
        gpaPrevious: r.gpaPrevious ?? null,
        gpaChange: r.gpaChange ?? null,
        gpaAlertLevel: r.gpaAlertLevel ?? null,
        attendanceAlertLevel: r.attendanceAlertLevel ?? null,
        attendancePercentage: r.attendancePercentage ?? null,
        classAverageAttendance: r.classAverageAttendance ?? null,
        totalClassesHeld: r.totalClassesHeld ?? 0,
        attendanceMarkedClasses: r.attendanceMarkedClasses ?? 0,
        classesAttended: r.classesAttended ?? 0,
        latestInterventionStatus: r.latestInterventionStatus ?? null,
        latestWellbeingStatus: r.latestWellbeingStatus ?? null,
        latestWellbeingCategory: r.latestWellbeingCategory ?? null,
      })),
    [dbRows]
  );

  const openAccordionBg = "bg-primary dark:bg-primary/10";
  const closedAccordionBg = "bg-gray-50 dark:bg-dark-2";

  const attendanceSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        absences: number;
        totalHeld: number;
        attendanceMarked: number;
        attended: number;
        percentage: number;
      }
    >();
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const db = dbRows[i];
      if (!db) continue;
      const key = getEnrollmentAttendanceKey(row);
      const posted = db.attendanceMarkedClasses ?? 0;
      map.set(key, {
        absences: posted - db.classesAttended,
        totalHeld: db.totalClassesHeld,
        attendanceMarked: posted,
        attended: db.classesAttended,
        percentage: db.attendancePercentage ?? 0,
      });
    }
    return map;
  }, [list, dbRows]);

  const classAverageByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dbRows) {
      const key = toClassContextKey({
        courseCode: r.courseId,
        sectionCode: r.sectionCode,
        eventPackageId: r.eventPackageId,
        programTitle: r.programTitle,
        instructorName: r.instructorName,
      });
      if (r.classAverageAttendance != null) map.set(key, r.classAverageAttendance);
    }
    return map;
  }, [dbRows]);

  const monitoredByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dbRows) {
      const key = toClassContextKey({
        courseCode: r.courseId,
        sectionCode: r.sectionCode,
        eventPackageId: r.eventPackageId,
        programTitle: r.programTitle,
        instructorName: r.instructorName,
      });
      map.set(key, r.totalClassesHeld ?? 0);
    }
    return map;
  }, [dbRows]);

  const attendancePostedByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dbRows) {
      const key = toClassContextKey({
        courseCode: r.courseId,
        sectionCode: r.sectionCode,
        eventPackageId: r.eventPackageId,
        programTitle: r.programTitle,
        instructorName: r.instructorName,
      });
      map.set(key, r.attendanceMarkedClasses ?? 0);
    }
    return map;
  }, [dbRows]);

  const isAttendanceLoading = isLoadingDb;

  const filteredList = useMemo(() => {
    let base = list;

    if (attendanceFilters?.length && attendanceSummaries) {
      const allowed = new Set<string | null>();
      for (const f of attendanceFilters) {
        if (f === "red") allowed.add("critical");
        else if (f === "yellow") allowed.add("warning");
        else if (f === "good") allowed.add(null);
      }

      base = base.filter((row) => {
        const monitorKey = toClassContextKey({
          courseCode:
            typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
          sectionCode: row.Section ?? "",
          eventPackageId: String(
            (row as unknown as { Packnumber?: string }).Packnumber ?? ""
          ),
          programTitle: row.DegreeTitle ?? row.DegreeCode ?? "",
          instructorName: row.Teacher ?? "",
        });
        const attendanceKey = getEnrollmentAttendanceKey(row);
        const summary = attendanceSummaries.get(attendanceKey);
        const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
        const level =
          summary && classAvg != null
            ? getAttendanceAlertLevel(
                summary.percentage,
                classAvg,
                summary.attendanceMarked,
              )
            : null;
        return allowed.size ? allowed.has(level) : true;
      });
    }

    if (gpaFilters?.length) {
      const allowed = new Set<"critical" | "warning" | null>();
      for (const f of gpaFilters) {
        if (f === "red") allowed.add("critical");
        else if (f === "yellow") allowed.add("warning");
        else if (f === "good") allowed.add(null);
      }

      base = base.filter((row) => {
        const level = row.gpaAlertLevel ?? null;
        return allowed.size ? allowed.has(level) : true;
      });
    }

    return base;
  }, [
    list,
    attendanceFilters,
    attendanceSummaries,
    classAverageByCourseSection,
    gpaFilters,
  ]);

  const { byDept } = groupEnrollmentByDeptProgramCourse(filteredList);

  const interventionStatuses = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of dbRows) {
      map.set(String(r.sapId ?? "").trim(), r.latestInterventionStatus ?? null);
    }
    return map;
  }, [dbRows]);
  const wellbeingBySap = useMemo(() => {
    const map = new Map<string, { status: "open" | "closed" | null; category: string | null }>();
    for (const r of dbRows) {
      map.set(String(r.sapId ?? "").trim(), {
        status: r.latestWellbeingStatus ?? null,
        category: r.latestWellbeingCategory ?? null,
      });
    }
    return map;
  }, [dbRows]);

  const sortedDepts = Array.from(byDept.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  const normalizedDepartmentStats = useMemo(() => {
    const normalize = (value: string) =>
      value.replace(/^Department of\s+/i, "").trim().toLowerCase();
    const map = new Map<string, DepartmentStats>();
    for (const stat of departmentStats ?? []) {
      const key = normalize(stat.departmentName ?? "");
      if (!key) continue;
      map.set(key, stat);
    }
    return { map, normalize };
  }, [departmentStats]);

  const normalizedProgramStats = useMemo(() => {
    const normalize = (value: string) =>
      value.replace(/^Department of\s+/i, "").trim().toLowerCase();
    const map = new Map<string, ProgramStats>();
    for (const stat of programStats ?? []) {
      const key = normalize(stat.programTitle ?? stat.programId ?? "");
      if (!key) continue;
      map.set(key, stat);
    }
    return { map, normalize };
  }, [programStats]);

  const normalizedCourseStats = useMemo(() => {
    const normalize = (value: string) =>
      value.split("|")[0]?.trim().toLowerCase() ?? value.trim().toLowerCase();
    const map = new Map<string, CourseStats>();
    for (const stat of courseStats ?? []) {
      const key = normalize(stat.courseId ?? "");
      if (!key) continue;
      map.set(key, stat);
    }
    return { map, normalize };
  }, [courseStats]);

  const normalizedInstructorStats = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    const map = new Map<string, InstructorStats>();
    for (const stat of instructorStats ?? []) {
      const key = normalize(stat.instructorName ?? stat.instructorId ?? "");
      if (!key) continue;
      map.set(key, stat);
    }
    return { map, normalize };
  }, [instructorStats]);

  const getAttendanceAlertCounts = (
    rows: EnrollmentRecord[]
  ): { red: number; yellow: number } => {
    if (!rows.length || !attendanceSummaries) return { red: 0, yellow: 0 };
    const bySap = new Map<string, "critical" | "warning" | null>();
    for (const row of rows) {
      const monitorKey = toClassContextKey({
        courseCode:
          typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
        sectionCode: row.Section ?? "",
        eventPackageId: String(
          (row as unknown as { Packnumber?: string }).Packnumber ?? ""
        ),
        programTitle: row.DegreeTitle ?? row.DegreeCode ?? "",
        instructorName: row.Teacher ?? "",
      });
      const attendanceKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attendanceKey);
      const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
      const level =
        summary && classAvg != null
            ? getAttendanceAlertLevel(
                summary.percentage,
                classAvg,
                summary.attendanceMarked,
              )
          : null;
      const sapId = String(row.SapNo ?? "").trim();
      if (!sapId) continue;
      const prev = bySap.get(sapId) ?? null;
      if (level === "critical") {
        bySap.set(sapId, "critical");
      } else if (level === "warning" && prev !== "critical") {
        bySap.set(sapId, "warning");
      } else if (!bySap.has(sapId)) {
        bySap.set(sapId, null);
      }
    }
    let red = 0;
    let yellow = 0;
    for (const level of bySap.values()) {
      if (level === "critical") red += 1;
      else if (level === "warning") yellow += 1;
    }
    return { red, yellow };
  };

  const getGpaAlertCounts = (
    rows: EnrollmentRecord[]
  ): { red: number; yellow: number } => {
    if (!rows.length) return { red: 0, yellow: 0 };
    const bySap = new Map<string, "critical" | "warning" | null>();
    for (const row of rows) {
      const level = (row as NestedEnrollmentRow).gpaAlertLevel ?? null;
      const sapId = String(row.SapNo ?? "").trim();
      if (!sapId) continue;
      const prev = bySap.get(sapId) ?? null;
      if (level === "critical") {
        bySap.set(sapId, "critical");
      } else if (level === "warning" && prev !== "critical") {
        bySap.set(sapId, "warning");
      } else if (!bySap.has(sapId)) {
        bySap.set(sapId, null);
      }
    }
    let red = 0;
    let yellow = 0;
    for (const level of bySap.values()) {
      if (level === "critical") red += 1;
      else if (level === "warning") yellow += 1;
    }
    return { red, yellow };
  };

  if (isLoadingDb) {
    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          Loading nested enrollment view...
        </div>
      </div>
    );
  }

  if (filteredList.length === 0) {
    return (
      <div
        className={cn(
          "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
          className
        )}
      >
        <div className="mt-6 rounded-md border border-dashed border-stroke py-8 text-center text-dark-6 dark:border-dark-3">
          No enrollment data found.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card mb-12",
        className
      )}
    >
      {expandedIds.length > 0 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setExpandedIds([])}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium outline-none transition",
              "focus-visible:ring-2 focus-visible:ring-primary",
              "bg-white border-stroke hover:bg-gray-50 dark:bg-gray-dark dark:border-dark-3 dark:hover:bg-dark-3"
            )}
            aria-label="Collapse all accordions"
          >
            Collapse all
          </button>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {sortedDepts.map((deptName) => {
          const byProgram = byDept.get(deptName)!;
          const deptSectionId = `enrollment-dept-${deptName.replace(/\s+/g, "-")}`;
          const sortedPrograms = Array.from(byProgram.keys()).sort((a, b) =>
            a.localeCompare(b)
          );
          const deptIsOpen = expandedIds.includes(deptSectionId);

          const deptRows: EnrollmentRecord[] = [];
          for (const prog of byProgram.values()) {
            for (const courseRows of prog.values()) {
              deptRows.push(...courseRows);
            }
          }
          const deptAttendanceAlerts = getAttendanceAlertCounts(deptRows);
          const deptGpaAlerts = getGpaAlertCounts(deptRows);
          const deptStatsFromSource = normalizedDepartmentStats.map.get(
            normalizedDepartmentStats.normalize(deptName)
          );
          const displayDeptAttendanceAlerts = deptStatsFromSource
            ? {
                yellow: deptStatsFromSource.yellowAttendance,
                red: deptStatsFromSource.redAttendance,
              }
            : deptAttendanceAlerts;
          const displayDeptGpaAlerts = deptStatsFromSource
            ? { yellow: deptStatsFromSource.yellowGpa, red: deptStatsFromSource.redGpa }
            : deptGpaAlerts;

          return (
            <details
              key={deptName}
              data-section-id={deptSectionId}
              open={deptIsOpen}
              className={cn(
                "rounded-md border border-stroke",
                deptIsOpen ? openAccordionBg : closedAccordionBg,
                "dark:border-dark-3"
              )}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col gap-1 dark:text-white">
                  <span className={cn("text-base font-semibold dark:text-white", deptIsOpen ? "text-white" : "text-dark")}>
                    Department:{" "}
                    <span className={cn("font-bold text-primary dark:text-green", deptIsOpen ? "text-white" : "text-dark")}>{deptName.replace("Department of ", "")}</span>
                  </span>
                  <div className="flex items-center gap-2">
                  <span className={cn("text-sm ", deptIsOpen ? "text-white" : "text-dark-6")}>
                    Attendance:{" "}
                    <span className="font-semibold text-yellow-600">
                     {displayDeptAttendanceAlerts.yellow}
                    </span>
                    {" | "}
                    <span className="font-semibold text-red-600">
                      {displayDeptAttendanceAlerts.red}
                    </span>
                  </span>

                  <span className={cn("text-sm ", deptIsOpen ? "text-white" : "text-dark-6")}>
                    GPA:{" "}
                    <span className="font-semibold text-yellow-600">
                      {displayDeptGpaAlerts.yellow}
                    </span>
                    {" | "}
                    <span className="font-semibold text-red-600">
                      {displayDeptGpaAlerts.red}
                    </span>
                  </span>
                  </div>
                 

                </div>
                <span
                  className={cn(
                    "ml-auto text-xs rotate-0 text-dark-6 transition-transform duration-200 ease-in-out dark:text-dark-5",
                    deptIsOpen && "rotate-180"
                  )}
                >
                  ▼
                </span>
              </summary>
              <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                <div className="space-y-3">
                  {sortedPrograms.map((programName) => {
                    const byCourse = byProgram.get(programName)!;
                    const progSectionId = `${deptSectionId}-prog-${programName.replace(/\s+/g, "-")}`;
                    const sortedCourses = Array.from(byCourse.keys()).sort((a, b) =>
                      a.localeCompare(b)
                    );
                    const progIsOpen = expandedIds.includes(progSectionId);

                    const programRows: EnrollmentRecord[] = [];
                    for (const courseRows of byCourse.values()) {
                      programRows.push(...courseRows);
                    }
                    const programAttendanceAlerts =
                      getAttendanceAlertCounts(programRows);
                    const programGpaAlerts = getGpaAlertCounts(programRows);
                    const programStatsFromSource = normalizedProgramStats.map.get(
                      normalizedProgramStats.normalize(programName)
                    );
                    const displayProgramAttendanceAlerts = programStatsFromSource
                      ? {
                          yellow: programStatsFromSource.yellowAttendance,
                          red: programStatsFromSource.redAttendance,
                        }
                      : programAttendanceAlerts;
                    const displayProgramGpaAlerts = programStatsFromSource
                      ? {
                          yellow: programStatsFromSource.yellowGpa,
                          red: programStatsFromSource.redGpa,
                        }
                      : programGpaAlerts;

                    return (
                      <details
                        key={programName}
                        data-section-id={progSectionId}
                        open={progIsOpen}
                        className={cn(
                          "rounded-md border border-stroke",
                          progIsOpen ? openAccordionBg : closedAccordionBg,
                          "dark:border-dark-3"
                        )}
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={cn("text-sm font-semibold dark:text-white", progIsOpen ? "text-white" : "text-dark")}>
                              Program:{" "}
                              <span className={cn("font-bold text-primary dark:text-green", progIsOpen ? "text-white" : "text-dark")}>
                                {programName}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                            <span className={cn("text-sm", progIsOpen ? "text-white" : "text-dark-6")}>
                              Attendance:{" "}
                              <span className="font-semibold text-yellow-600">
                                {displayProgramAttendanceAlerts.yellow}
                              </span>
                              {" | "}
                              <span className="font-semibold text-red-600">
                                {displayProgramAttendanceAlerts.red}
                              </span>
                            </span>

                            <span className={cn("text-sm", progIsOpen ? "text-white" : "text-dark-6")}>
                              GPA:{" "}
                              <span className="font-semibold text-yellow-600">
                                {displayProgramGpaAlerts.yellow}
                              </span>
                              {" | "}
                              <span className="font-semibold text-red-600">
                                {displayProgramGpaAlerts.red}
                              </span>
                            </span>
                            </div>
                           
                          </div>
                          <span
                            className={cn(
                              "ml-auto text-xs rotate-0 text-dark-6 transition-transform duration-200 ease-in-out dark:text-dark-5",
                              progIsOpen && "rotate-180"
                            )}
                          >
                            ▼
                          </span>
                        </summary>
                        <div className="border-t border-stroke bg-white px-4 py-3 dark:border-dark-3 dark:bg-gray-dark">
                          <div className="space-y-3">
                            {sortedCourses.map((courseKey) => {
                              const rows = byCourse.get(courseKey)!;
                              const courseSectionId = `${progSectionId}-course-${courseKey.replace(/\s+/g, "-")}`;
                              const firstRow = rows[0];
                              const courseCode = String(firstRow?.CrCode ?? "").trim();
                              const sectionCode = String(firstRow?.Section ?? "").trim();
                              const eventPackageId = String(
                                (firstRow as unknown as { Packnumber?: string })?.Packnumber ?? ""
                              ).trim();
                              const instructorName = String(firstRow?.Teacher ?? "").trim();
                              const courseTitle =
                                firstRow?.CrTitle ?? firstRow?.CrCode ?? courseKey;
                              const courseIsOpen = expandedIds.includes(courseSectionId);

                              const courseAttendanceAlerts =
                                getAttendanceAlertCounts(rows);
                              const courseGpaAlerts = getGpaAlertCounts(rows);
                              const courseStatsFromSource = normalizedCourseStats.map.get(
                                normalizedCourseStats.normalize(
                                  (firstRow?.CrCode ?? courseKey) as string
                                )
                              );
                              const displayCourseAttendanceAlerts = courseStatsFromSource
                                ? {
                                    yellow: courseStatsFromSource.yellowAttendance,
                                    red: courseStatsFromSource.redAttendance,
                                  }
                                : courseAttendanceAlerts;
                              const displayCourseGpaAlerts = courseStatsFromSource
                                ? {
                                    yellow: courseStatsFromSource.yellowGpa,
                                    red: courseStatsFromSource.redGpa,
                                  }
                                : courseGpaAlerts;
                              const primaryInstructorName = String(
                                firstRow?.Teacher ?? ""
                              ).trim();
                              const instructorStatsFromSource = primaryInstructorName
                                ? normalizedInstructorStats.map.get(
                                    normalizedInstructorStats.normalize(primaryInstructorName)
                                  )
                                : undefined;

                              return (
                                <details
                                  key={courseKey}
                                  data-section-id={courseSectionId}
                                  open={courseIsOpen}
                                className={cn(
                                  "rounded-md border border-stroke",
                                  courseIsOpen ? openAccordionBg : closedAccordionBg,
                                  "dark:border-dark-3"
                                )}
                                >
                                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <span className={cn("text-sm font-semibold dark:text-white", courseIsOpen ? "text-white" : "text-dark")}>
                                        Course:{" "}
                                        <span className={cn("font-bold text-primary dark:text-green", courseIsOpen ? "text-white" : "text-dark")}>
                                          {courseCode || courseKey}
                                        </span>
                                        {courseTitle && courseTitle !== courseKey && (
                                          <span className="ml-2 text-xs text-dark-6 dark:text-white">
                                            ({courseTitle})
                                          </span>
                                        )}
                                        {sectionCode && (
                                          <span className="ml-2 text-xs text-dark-6 dark:text-white">
                                            [Section {sectionCode}]
                                          </span>
                                        )}
                                        {eventPackageId && (
                                          <span className="ml-2 text-xs text-dark-6 dark:text-white">
                                            [Class {eventPackageId}]
                                          </span>
                                        )}
                                      </span>
                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        Instructor(s):{" "}
                                        <span className="font-semibold text-dark dark:text-white">
                                          {firstRow?.Teacher ?? "—"}
                                        </span>
                                        {instructorStatsFromSource && (
                                          <>
                                            {" · "}
                                            <span className="text-amber-500 font-semibold">
                                              {instructorStatsFromSource.yellowAttendance}
                                            </span>
                                            {" | "}
                                            <span className="text-red-600 font-semibold">
                                              {instructorStatsFromSource.redAttendance}
                                            </span>
                                          </>
                                        )}
                                        {" · "}
                                        {rows.length} student
                                        {rows.length !== 1 ? "s" : ""}
                                      </span>
                                      <div className="flex items-center gap-2">
                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        Attendance:{" "}
                                        <span className="font-semibold text-yellow-600">
                                          {displayCourseAttendanceAlerts.yellow}
                                        </span>
                                        {" | "}
                                        <span className="font-semibold text-red-600">
                                          {displayCourseAttendanceAlerts.red}
                                        </span>
                                      </span>

                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        GPA:{" "}
                                        <span className="font-semibold text-yellow-600">
                                          {displayCourseGpaAlerts.yellow}
                                        </span>
                                        {" | "}
                                        <span className="font-semibold text-red-600">
                                          {displayCourseGpaAlerts.red}
                                        </span>
                                      </span>
                                      </div>
                                     
                                    </div>
                                    <span
                                      className={cn(
                                        "ml-auto text-xs rotate-0 text-dark-6 transition-transform duration-200 ease-in-out dark:text-dark-5",
                                        courseIsOpen && "rotate-180"
                                      )}
                                    >
                                      ▼
                                    </span>
                                  </summary>
                                  <div className="overflow-x-auto border-t border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="border-stroke dark:border-dark-3 [&>th]:bg-gray-50 dark:[&>th]:bg-dark-2">
                                          <TableHead className="!text-left">
                                            Name / SAP ID
                                          </TableHead>
                                      
                                          <TableHead className="!text-left">
                                            Classes Held
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Attendance %
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            GPA
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Intervention Status
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Wellbeing Status
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {rows.map((row, idx) => {
                                          const rowKey =
                                            row.Id ??
                                            `${row.SapNo}-${courseKey}-${row.Section ?? ""}-${(row as unknown as { Packnumber?: string }).Packnumber ?? ""}-${row.Teacher ?? ""}-${idx}`;
                                          const monitorKey = toClassContextKey({
                                            courseCode:
                                              typeof row.CrCode === "string"
                                                ? row.CrCode
                                                : String(row.CrCode ?? ""),
                                            sectionCode: row.Section ?? "",
                                            eventPackageId: String(
                                              (row as unknown as { Packnumber?: string }).Packnumber ?? ""
                                            ),
                                            programTitle:
                                              row.DegreeTitle ?? row.DegreeCode ?? "",
                                            instructorName: row.Teacher ?? "",
                                          });
                                          const monitoredCount =
                                            monitoredByCourseSection.get(monitorKey);
                                          const postedCount =
                                            attendancePostedByCourseSection.get(
                                              monitorKey,
                                            );
                                          const attendanceKey =
                                            getEnrollmentAttendanceKey(row);
                                          const summary =
                                            attendanceSummaries?.get(attendanceKey);
                                          const classAvg =
                                            classAverageByCourseSection.get(
                                              monitorKey ?? "",
                                            ) ?? null;
                                          const computedAlertLevel =
                                            summary && classAvg != null
                                              ? getAttendanceAlertLevel(
                                                  summary.percentage,
                                                  classAvg,
                                                  summary.attendanceMarked,
                                                )
                                              : null;
                                          const displayAttendanceAlertLevel =
                                            row.attendanceAlertLevel ??
                                            computedAlertLevel;
                                          const attendanceColorClass =
                                            displayAttendanceAlertLevel === "critical"
                                              ? "text-red-600"
                                              : displayAttendanceAlertLevel === "warning"
                                                ? "text-yellow-600"
                                                : "";
                                          const hasAttendanceAlert =
                                            displayAttendanceAlertLevel === "critical" ||
                                            displayAttendanceAlertLevel === "warning";
                                          const gpaLevel = row.gpaAlertLevel ?? null;
                                          const cgpa = row.gpaCurrent;
                                          const gpaValueColorClass =
                                            gpaLevel === "critical"
                                              ? "text-red-600 dark:text-red-500"
                                              : gpaLevel === "warning"
                                                ? "text-yellow-600 dark:text-yellow-500"
                                                : "";
                                          const gpaPrev = row.gpaPrevious;
                                          const gpaChange = row.gpaChange;
                                          const hasGpaTrend =
                                            typeof gpaChange === "number" &&
                                            Number.isFinite(gpaChange);
                                          const gpaDropped = hasGpaTrend && gpaChange < 0;
                                          const gpaDeviationClass =
                                            gpaLevel === "critical"
                                              ? "text-red-600 dark:text-red-500"
                                              : gpaLevel === "warning"
                                                ? "text-yellow-600 dark:text-yellow-500"
                                                : hasGpaTrend
                                                  ? "text-dark dark:text-white"
                                                  : "text-dark-6 dark:text-dark-5";
                                          const hasGpaAlert =
                                            gpaLevel === "critical" ||
                                            gpaLevel === "warning";
                                          const latestStatus =
                                            row.latestInterventionStatus ??
                                            interventionStatuses.get(row.SapNo) ??
                                            null;
                                          const wellbeing = wellbeingBySap.get(
                                            String(row.SapNo ?? "").trim()
                                          );

                                          const classesHeld =
                                            row.totalClassesHeld ??
                                            summary?.totalHeld ??
                                            0;
                                          const attendancePosted =
                                            row.attendanceMarkedClasses ??
                                            summary?.attendanceMarked ??
                                            0;
                                          const classesAttended =
                                            row.classesAttended ??
                                            summary?.attended ??
                                            0;
                                          const notUpdatedVsHeld =
                                            classesHeld - attendancePosted;
                                          const attendancePct =
                                            row.attendancePercentage ??
                                            summary?.percentage ??
                                            null;
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
                                                    courseCode={
                                                      typeof row.CrCode === "string"
                                                        ? row.CrCode
                                                        : String(row.CrCode ?? "")
                                                    }
                                                    section={row.Section ?? null}
                                                    className="flex flex-col gap-0.5"
                                                    title="View profile"
                                                  >
                                                    <span className="text-base font-medium text-green-500 dark:text-green">
                                                      {row.Name ?? "—"}
                                                    </span>
                                                    <span className="text-sm text-[#1f4a3d] dark:text-white">
                                                      SAPID: {row.SapNo}
                                                    </span>
                                                  </StudentProfileLink>
                                                ) : (
                                                  <div className="flex flex-col gap-0.5">
                                                    <span>{row.Name ?? "—"}</span>
                                                    <span className="text-sm text-dark-6">
                                                      {row.SapNo}
                                                    </span>
                                                  </div>
                                                )}
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
                                                      <span className="text-xs text-green-500">
                                                        All held sessions posted
                                                      </span>
                                                    ) : (
                                                      <span
                                                        className={cn(
                                                          "text-xs",
                                                          notUpdatedVsHeld > 0
                                                            ? "text-red-600 dark:text-red-400"
                                                            : "text-amber-600 dark:text-amber-400",
                                                        )}
                                                      >
                                                        Not updated vs held (
                                                        {notUpdatedVsHeld})
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {summary && attendancePct != null ? (
                                                  <div className="flex flex-col">
                                                    <span className="inline-flex items-center gap-2">
                                                      <span
                                                        className={attendanceColorClass}
                                                      >
                                                        {attendancePct.toFixed(1)}%
                                                      </span>{" "}
                                                      <span className="text-xs text-dark-6 dark:text-white">
                                                        ({classesAttended}/
                                                        {attendancePosted})
                                                      </span>
                                                    </span>
                                                    {classAvg != null && (
                                                      <span className="text-xs text-dark-6 dark:text-white">
                                                       Class Avg: {classAvg.toFixed(1)}%
                                                      </span>
                                                    )}
                                                  </div>
                                                ) : isAttendanceLoading ? (
                                                  "Calculating..."
                                                ) : monitoredCount != null ? (
                                                  <div className="flex flex-col">
                                                    <span className="inline-flex items-center gap-2">
                                                      <span>0.0%</span>{" "}
                                                      <span className="text-xs text-dark-6 dark:text-white">
                                                        (0/
                                                        {postedCount ??
                                                          monitoredCount}
                                                        )
                                                      </span>
                                                    </span>
                                                  </div>
                                                ) : (
                                                  "—"
                                                )}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                <div className="flex flex-col">
                                                  <span className={gpaValueColorClass}>
                                                    {typeof cgpa === "number"
                                                      ? cgpa.toFixed(2)
                                                      : "-"}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "text-xs",
                                                      gpaDeviationClass
                                                    )}
                                                  >
                                                    {hasGpaTrend
                                                      ? <>
                                                      {gpaDropped ? (
                                                        <span className="text-red-600 dark:text-red-400">▼</span>
                                                      ) : (
                                                        <span className="text-green-500 dark:text-green-400">▲</span>
                                                      )}{" "}
                                                      {Math.abs(gpaChange).toFixed(2)}${typeof gpaPrev === "number"
                                                        ? ` vs ${gpaPrev.toFixed(2)}`
                                                        : ""}
                                                      </>
                                                      : "—"}
                                                  </span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                <InterventionStatusBadge
                                                  status={latestStatus}
                                                  goodStanding={
                                                    !hasAttendanceAlert && !hasGpaAlert
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {wellbeing?.status ? (
                                                  <span
                                                    className={cn(
                                                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
                                                      wellbeing.status === "closed"
                                                        ? "bg-green-600"
                                                        : "bg-amber-600"
                                                    )}
                                                  >
                                                    {wellbeing.status === "closed" ? "Closed" : "Open"}
                                                    {wellbeing.category
                                                      ? ` - ${wellbeing.category}`
                                                      : ""}
                                                  </span>
                                                ) : (
                                                  "—"
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
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
            </details>
          );
        })}
      </div>
    </div>
  );
}
