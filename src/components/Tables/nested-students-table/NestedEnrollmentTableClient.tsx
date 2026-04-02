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
  classesAttended: number;
  latestInterventionStatus: string | null;
};

type GroupedEnrollment = {
  byDept: Map<
    string,
    Map<string, Map<string, NestedEnrollmentRow[]>>
  >;
};

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
    const courseKey = row.CrCode ?? row.CrTitle ?? "Unknown Course";

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
  totalClassesHeld: number;
  classesAttended: number;
  attendancePercentage: number | null;
  classAverageAttendance: number | null;
  attendanceAlertLevel: "warning" | "critical" | null;
  gpaCurrent: number | null;
  gpaPrevious: number | null;
  gpaChange: number | null;
  gpaAlertLevel: "warning" | "critical" | null;
  latestInterventionStatus: string | null;
};

export function NestedEnrollmentTableClient({
  className,
  returnToUrl = "/",
  enrollmentData: _enrollmentData,
  masterFilter,
  attendanceFilters,
  gpaFilters,
  interventionFilters,
  resolutionFilters,
}: Props) {
  const { expandedIds, setExpandedIds } = useDashboardUiState();
  const [dbRows, setDbRows] = useState<TopTableRow[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

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
        filters: {
          ...(masterFilter ?? {}),
          attendanceFilters: normalizedAttendanceFilters,
          gpaFilters: normalizedGpaFilters,
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
  }, [masterFilter, attendanceFilters, gpaFilters, interventionFilters, resolutionFilters]);

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
        Id: `${r.sapId}-${r.courseId}-${r.sectionCode ?? ""}`,
        gpaCurrent: r.gpaCurrent ?? null,
        gpaPrevious: r.gpaPrevious ?? null,
        gpaChange: r.gpaChange ?? null,
        gpaAlertLevel: r.gpaAlertLevel ?? null,
        attendanceAlertLevel: r.attendanceAlertLevel ?? null,
        attendancePercentage: r.attendancePercentage ?? null,
        classAverageAttendance: r.classAverageAttendance ?? null,
        totalClassesHeld: r.totalClassesHeld ?? 0,
        classesAttended: r.classesAttended ?? 0,
        latestInterventionStatus: r.latestInterventionStatus ?? null,
      })),
    [dbRows]
  );

  const openAccordionBg = "bg-primary dark:bg-primary/10";
  const closedAccordionBg = "bg-gray-50 dark:bg-dark-2";

  const attendanceSummaries = useMemo(() => {
    const map = new Map<
      string,
      { absences: number; totalHeld: number; attended: number; percentage: number }
    >();
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const db = dbRows[i];
      if (!db) continue;
      const key = getEnrollmentAttendanceKey(row);
      map.set(key, {
        absences: Math.max(0, db.totalClassesHeld - db.classesAttended),
        totalHeld: db.totalClassesHeld,
        attended: db.classesAttended,
        percentage: db.attendancePercentage ?? 0,
      });
    }
    return map;
  }, [list, dbRows]);

  const classAverageByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dbRows) {
      const key = `${normalizeCourseCode(r.courseId)}__${r.sectionCode ?? ""}`;
      if (r.classAverageAttendance != null) map.set(key, r.classAverageAttendance);
    }
    return map;
  }, [dbRows]);

  const monitoredByCourseSection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dbRows) {
      const key = `${normalizeCourseCode(r.courseId)}__${r.sectionCode ?? ""}`;
      map.set(key, r.totalClassesHeld ?? 0);
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
        const monitorKey = `${normalizeCourseCode(
          typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
        )}__${row.Section ?? ""}`;
        const attendanceKey = getEnrollmentAttendanceKey(row);
        const summary = attendanceSummaries.get(attendanceKey);
        const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
        const level =
          summary && classAvg != null
            ? getAttendanceAlertLevel(summary.percentage, classAvg, summary.totalHeld)
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

  const sortedDepts = Array.from(byDept.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  const getAttendanceAlertCounts = (
    rows: EnrollmentRecord[]
  ): { red: number; yellow: number } => {
    if (!rows.length || !attendanceSummaries) return { red: 0, yellow: 0 };
    let red = 0;
    let yellow = 0;
    for (const row of rows) {
      const monitorKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;
      const attendanceKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attendanceKey);
      const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
      const level =
        summary && classAvg != null
          ? getAttendanceAlertLevel(summary.percentage, classAvg, summary.totalHeld)
          : null;
      if (level === "critical") red += 1;
      if (level === "warning") yellow += 1;
    }
    return { red, yellow };
  };

  const getGpaAlertCounts = (
    rows: EnrollmentRecord[]
  ): { red: number; yellow: number } => {
    if (!rows.length) return { red: 0, yellow: 0 };
    let red = 0;
    let yellow = 0;
    for (const row of rows) {
      const level = (row as NestedEnrollmentRow).gpaAlertLevel ?? null;
      if (level === "critical") red += 1;
      if (level === "warning") yellow += 1;
    }
    return { red, yellow };
  };

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
        <button
          type="button"
          onClick={() => setExpandedIds([])}
          className={cn(
            "fixed right-4 bottom-6 z-50 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg outline-none transition",
            "focus-visible:ring-2 focus-visible:ring-primary",
            "bg-white border-stroke hover:bg-gray-50 dark:bg-gray-dark dark:border-dark-3 dark:hover:bg-dark-3"
          )}
          aria-label="Collapse all accordions"
        >
          Collapse all
        </button>
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
                     {deptAttendanceAlerts.yellow}
                    </span>
                    {" | "}
                    <span className="font-semibold text-red-600">
                      {deptAttendanceAlerts.red}
                    </span>
                  </span>

                  <span className={cn("text-sm ", deptIsOpen ? "text-white" : "text-dark-6")}>
                    GPA:{" "}
                    <span className="font-semibold text-yellow-600">
                      {deptGpaAlerts.yellow}
                    </span>
                    {" | "}
                    <span className="font-semibold text-red-600">
                      {deptGpaAlerts.red}
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
                                {programAttendanceAlerts.yellow}
                              </span>
                              {" | "}
                              <span className="font-semibold text-red-600">
                                {programAttendanceAlerts.red}
                              </span>
                            </span>

                            <span className={cn("text-sm", progIsOpen ? "text-white" : "text-dark-6")}>
                              GPA:{" "}
                              <span className="font-semibold text-yellow-600">
                                {programGpaAlerts.yellow}
                              </span>
                              {" | "}
                              <span className="font-semibold text-red-600">
                                {programGpaAlerts.red}
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
                              const courseTitle =
                                rows[0]?.CrTitle ?? rows[0]?.CrCode ?? courseKey;
                              const courseIsOpen = expandedIds.includes(courseSectionId);

                              const courseAttendanceAlerts =
                                getAttendanceAlertCounts(rows);
                              const courseGpaAlerts = getGpaAlertCounts(rows);

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
                                          {courseKey}
                                        </span>
                                        {courseTitle && courseTitle !== courseKey && (
                                          <span className="ml-2 text-xs text-dark-6 dark:text-white">
                                            ({courseTitle})
                                          </span>
                                        )}
                                      </span>
                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        Instructor(s):{" "}
                                        <span className="font-semibold text-dark dark:text-white">
                                          {rows[0]?.Teacher ?? "—"}
                                        </span>
                                        {" · "}
                                        {rows.length} student
                                        {rows.length !== 1 ? "s" : ""}
                                      </span>
                                      <div className="flex items-center gap-2">
                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        Attendance:{" "}
                                        <span className="font-semibold text-yellow-600">
                                          {courseAttendanceAlerts.yellow}
                                        </span>
                                        {" | "}
                                        <span className="font-semibold text-red-600">
                                          {courseAttendanceAlerts.red}
                                        </span>
                                      </span>

                                      <span className={cn("text-sm", courseIsOpen ? "text-white" : "text-dark-6")}>
                                        GPA:{" "}
                                        <span className="font-semibold text-yellow-600">
                                          {courseGpaAlerts.yellow}
                                        </span>
                                        {" | "}
                                        <span className="font-semibold text-red-600">
                                          {courseGpaAlerts.red}
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
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {rows.map((row, idx) => {
                                          const rowKey =
                                            row.Id ??
                                            `${row.SapNo}-${courseKey}-${idx}`;
                                          const monitorKey = `${normalizeCourseCode(
                                            typeof row.CrCode === "string"
                                              ? row.CrCode
                                              : String(row.CrCode ?? ""),
                                          )}__${row.Section ?? ""}`;
                                          const monitoredCount =
                                            monitoredByCourseSection.get(monitorKey);
                                          const attendanceKey =
                                            getEnrollmentAttendanceKey(row);
                                          const summary =
                                            attendanceSummaries?.get(attendanceKey);
                                          const classAvg =
                                            classAverageByCourseSection.get(
                                              monitorKey ?? "",
                                            ) ?? null;
                                          const alertLevel =
                                            summary && classAvg != null
                                              ? getAttendanceAlertLevel(
                                                  summary.percentage,
                                                  classAvg,
                                                  summary.totalHeld,
                                                )
                                              : null;
                                          const attendanceColorClass =
                                            alertLevel === "critical"
                                              ? "text-red-600"
                                              : alertLevel === "warning"
                                              ? "text-yellow-600"
                                              : "";
                                          const hasAttendanceAlert =
                                            alertLevel === "critical" ||
                                            alertLevel === "warning";
                                          const gpaLevel = row.gpaAlertLevel ?? null;
                                          const cgpa = row.gpaCurrent;
                                          const gpaColorClass =
                                            gpaLevel === "critical"
                                              ? "text-red-600"
                                              : gpaLevel === "warning"
                                                ? "text-yellow-600"
                                                : "";
                                          const gpaPrev = row.gpaPrevious;
                                          const gpaChange = row.gpaChange;
                                          const hasGpaTrend =
                                            typeof gpaChange === "number" &&
                                            Number.isFinite(gpaChange);
                                          const gpaDropped = hasGpaTrend && gpaChange < 0;
                                          const gpaTrendClass = gpaDropped
                                            ? "text-red-600"
                                            : hasGpaTrend
                                              ? "text-emerald-600"
                                              : "text-dark-6 dark:text-dark-5";
                                          const hasGpaAlert =
                                            gpaLevel === "critical" ||
                                            gpaLevel === "warning";
                                          const latestStatus =
                                            row.latestInterventionStatus ??
                                            interventionStatuses.get(row.SapNo) ??
                                            null;

                                          const classesHeld = summary?.totalHeld ?? 0;
                                          const classesAttended =
                                            summary?.attended ?? 0;
                                          const classesScheduled =
                                            monitoredCount != null
                                              ? monitoredCount
                                              : summary?.totalHeld ?? 0;
                                          const hasClassLoadSpike =
                                            hasAttendanceAlert &&
                                            classesHeld > 0 &&
                                            classesScheduled > 0 &&
                                            classesHeld / classesScheduled > 0.25;
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
                                                {classesHeld === 0 &&
                                                classesScheduled === 0
                                                  ? "—"
                                                  : `${classesHeld}/${classesScheduled}`}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {summary ? (
                                                  <div className="flex flex-col">
                                                    <span className="inline-flex items-center gap-2">
                                                      <span
                                                        className={attendanceColorClass}
                                                      >
                                                        {summary.percentage.toFixed(
                                                          1,
                                                        )}
                                                        % ({classesAttended}/{classesHeld})
                                                      </span>
                                                      {hasClassLoadSpike && (
                                                        <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                          (C)
                                                        </span>
                                                      )}
                                                    </span>
                                                    {classAvg != null && (
                                                      <span className="text-xs text-dark-6 dark:text-white">
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
                                                <div className="flex flex-col">
                                                  <span className={gpaColorClass}>
                                                    {typeof cgpa === "number"
                                                      ? cgpa.toFixed(2)
                                                      : "-"}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "text-xs",
                                                      gpaTrendClass
                                                    )}
                                                  >
                                                    {hasGpaTrend
                                                      ? `${gpaDropped ? "▼" : "▲"} ${Math.abs(
                                                          gpaChange
                                                        ).toFixed(2)}${
                                                          typeof gpaPrev === "number"
                                                            ? ` vs ${gpaPrev.toFixed(2)}`
                                                            : ""
                                                        }`
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
