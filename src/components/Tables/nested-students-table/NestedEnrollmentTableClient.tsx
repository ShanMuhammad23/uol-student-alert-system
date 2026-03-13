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

  const sortedDepts = Array.from(byDept.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

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

          return (
            <details
              key={deptName}
              data-section-id={deptSectionId}
              open={expandedIds.includes(deptSectionId)}
              className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <span className="text-base font-semibold text-dark dark:text-white">
                  Department:{" "}
                  <span className="font-bold text-primary">{deptName}</span>
                </span>
                <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
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

                    return (
                      <details
                        key={programName}
                        data-section-id={progSectionId}
                        open={expandedIds.includes(progSectionId)}
                        className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                          <span className="text-sm font-semibold text-dark dark:text-white">
                            Program:{" "}
                            <span className="font-bold text-primary">
                              {programName}
                            </span>
                          </span>
                          <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
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

                              return (
                                <details
                                  key={courseKey}
                                  data-section-id={courseSectionId}
                                  open={expandedIds.includes(courseSectionId)}
                                  className="group rounded-md border border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2"
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
                                    </div>
                                    <span className="ml-auto text-xs text-dark-6 transition-transform group-open:rotate-180 dark:text-dark-5">
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
                                            Department
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Program
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Course
                                          </TableHead>
                                          <TableHead className="!text-left">
                                            Instructor
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {rows.map((row, idx) => {
                                          const rowKey =
                                            row.Id ??
                                            `${row.SapNo}-${courseKey}-${idx}`;
                                          return (
                                            <TableRow
                                              key={rowKey}
                                              className="text-dark dark:text-white"
                                            >
                                              <TableCell className="!text-left font-medium">
                                                {returnToUrl ? (
                                                  <StudentProfileLink
                                                    sapId={row.SapNo}
                                                    returnToUrl={returnToUrl}
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
                                              <TableCell className="!text-left text-dark-6">
                                                {row.DeptName ?? "—"}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {row.DegreeTitle ?? row.DegreeCode ?? "—"}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {row.CrTitle ?? row.CrCode ?? "—"}
                                              </TableCell>
                                              <TableCell className="!text-left">
                                                {row.Teacher ?? "—"}
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
