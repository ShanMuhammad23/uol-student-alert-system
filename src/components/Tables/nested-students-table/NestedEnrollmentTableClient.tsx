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
import { useAttendanceAlerts } from "@/hooks/useAttendanceAlerts";
import { InterventionStatusBadge } from "@/app/(home)/dashboard/_components/intervention-status-badge";
import { useEffect, useState } from "react";

type GroupedEnrollment = {
  byDept: Map<
    string,
    Map<string, Map<string, EnrollmentRecord[]>>
  >;
};

function groupEnrollmentByDeptProgramCourse(
  records: EnrollmentRecord[]
): GroupedEnrollment {
  const byDept = new Map<
    string,
    Map<string, Map<string, EnrollmentRecord[]>>
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
};

export function NestedEnrollmentTableClient({
  className,
  returnToUrl = "/",
  enrollmentData,
}: Props) {
  const { expandedIds } = useDashboardUiState();
  const list = enrollmentData ?? [];
  const { byDept } = groupEnrollmentByDeptProgramCourse(list);

  const {
    attendanceSummaries,
    classAverageByCourseSection,
    monitoredByCourseSection,
    isAttendanceLoading,
  } = useAttendanceAlerts(list);

  const [interventionStatuses, setInterventionStatuses] = useState<
    Map<string, string | null>
  >(new Map());

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/interventions/status`, {
      signal: controller.signal,
    })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Failed to load intervention statuses")),
      )
      .then((data: Record<string, string | null>) => {
        const map = new Map<string, string | null>();
        for (const [id, status] of Object.entries(data)) {
          map.set(id, status ?? null);
        }
        setInterventionStatuses(map);
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setInterventionStatuses(new Map());
      });

    return () => {
      controller.abort();
    };
  }, []);

  const sortedDepts = Array.from(byDept.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  const getAttendanceAlertCount = (rows: EnrollmentRecord[]): number => {
    if (!rows.length || !attendanceSummaries) return 0;
    let count = 0;
    for (const row of rows) {
      const monitorKey = `${normalizeCourseCode(
        typeof row.CrCode === "string" ? row.CrCode : String(row.CrCode ?? ""),
      )}__${row.Section ?? ""}`;
      const attendanceKey = getEnrollmentAttendanceKey(row);
      const summary = attendanceSummaries.get(attendanceKey);
      const classAvg = classAverageByCourseSection.get(monitorKey ?? "") ?? null;
      const level =
        summary && classAvg != null
          ? getAttendanceAlertLevel(summary.percentage, classAvg)
          : null;
      if (level === "critical" || level === "warning") {
        count += 1;
      }
    }
    return count;
  };

  if (list.length === 0) {
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
          const deptAttendanceAlerts = getAttendanceAlertCount(deptRows);

          return (
            <details
              key={deptName}
              data-section-id={deptSectionId}
              open={deptIsOpen}
              className="rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-dark dark:text-white">
                    Department:{" "}
                    <span className="font-bold text-primary">{deptName}</span>
                  </span>
                  <span className="text-xs text-dark-6 dark:text-dark-5">
                    Attendance alerts:{" "}
                    <span className="font-semibold text-red">
                      {deptAttendanceAlerts}
                    </span>
                  </span>
                </div>
                <span
                  className={cn(
                    "ml-auto text-xs text-dark-6 transition-transform dark:text-dark-5",
                    deptIsOpen && "rotate-180",
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
                      getAttendanceAlertCount(programRows);

                    return (
                      <details
                        key={programName}
                        data-section-id={progSectionId}
                        open={progIsOpen}
                        className="rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-dark dark:text-white">
                              Program:{" "}
                              <span className="font-bold text-primary">
                                {programName}
                              </span>
                            </span>
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              Attendance alerts:{" "}
                              <span className="font-semibold text-red">
                                {programAttendanceAlerts}
                              </span>
                            </span>
                          </div>
                          <span
                            className={cn(
                              "ml-auto text-xs text-dark-6 transition-transform dark:text-dark-5",
                              progIsOpen && "rotate-180",
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
                                getAttendanceAlertCount(rows);

                              return (
                                <details
                                  key={courseKey}
                                  data-section-id={courseSectionId}
                                  open={courseIsOpen}
                                  className="rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                                >
                                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm font-semibold text-dark dark:text-white">
                                        Course:{" "}
                                        <span className="font-bold text-primary">
                                          {courseKey}
                                        </span>
                                        {courseTitle && courseTitle !== courseKey && (
                                          <span className="ml-2 text-xs text-dark-6 dark:text-dark-5">
                                            ({courseTitle})
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-xs text-dark-6 dark:text-dark-5">
                                        Instructor(s):{" "}
                                        <span className="font-semibold text-dark dark:text-white">
                                          {rows[0]?.Teacher ?? "—"}
                                        </span>
                                        {" · "}
                                        {rows.length} student
                                        {rows.length !== 1 ? "s" : ""}
                                      </span>
                                      <span className="text-xs text-dark-6 dark:text-dark-5">
                                        Attendance alerts:{" "}
                                        <span className="font-semibold text-red">
                                          {courseAttendanceAlerts}
                                        </span>
                                      </span>
                                    </div>
                                    <span
                                      className={cn(
                                        "ml-auto text-xs text-dark-6 transition-transform dark:text-dark-5",
                                        courseIsOpen && "rotate-180",
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
                                          const latestStatus =
                                            interventionStatuses.get(row.SapNo) ??
                                            null;

                                          const classesHeld = summary?.totalHeld ?? 0;
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
                                                    <span className="text-base font-medium text-green-500">
                                                      {row.Name ?? "—"}
                                                    </span>
                                                    <span className="text-sm text-[#1f4a3d]">
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
                                                        %
                                                      </span>
                                                      {hasClassLoadSpike && (
                                                        <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                          (C)
                                                        </span>
                                                      )}
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
                                                <span>-</span>
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                <InterventionStatusBadge
                                                  status={latestStatus}
                                                  goodStanding={!hasAttendanceAlert}
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
