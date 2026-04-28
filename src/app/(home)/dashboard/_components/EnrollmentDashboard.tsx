"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  type EnrollmentRecord,
} from "@/lib/enrollment";
import type {
  MasterFilterOptions,
  MasterFilterParams,
  DashboardUser,
  DepartmentStats,
  ProgramStats,
  InstructorStats,
} from "@/lib/enrollment";
import type { CourseStats } from "../fetch";
import type { AlertDimensionFilter } from "../fetch";
import { MasterFilter, type FilterApiRoleScope } from "./master-filter";
import { DeanStatsCollapsible } from "./dean-stats-collapsible";
import { DeanDepartmentStats } from "./dean-department-stats";
import { DeanProgramStats } from "./dean-program-stats";
import { DeanInstructorStats } from "./dean-instructor-stats";
import { DeanCourseStats } from "./dean-course-stats";
import { HodStatsCollapsible } from "./hod-stats-collapsible";
import { HodProgramStats } from "./hod-program-stats";
import { HodCourseStats } from "./hod-course-stats";
import { HodInstructorStats } from "./hod-instructor-stats";
import { InstructorStatsCollapsible } from "./instructor-stats-collapsible";
import { InstructorCourseStats } from "./instructor-course-stats";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { NestedEnrollmentTableClient } from "@/components/Tables/nested-students-table/NestedEnrollmentTableClient";
import { AttendanceMissingTableClient } from "@/components/Tables/nested-students-table/AttendanceMissingTableClient";
import { InterventionStudentSearchTab } from "./InterventionStudentSearchTab";
import { InterventionTeacherSearchTab } from "./InterventionTeacherSearchTab";
import { ExpandableListUrlSync } from "./ExpandableListUrlSync";
import { StudentsViewTabs } from "./StudentsViewTabs";
import { DashboardUiStateProvider, useDashboardUiState } from "./DashboardUiStateContext";
import { useDashboardFilter } from "./DashboardFilterContext";
import { useMergeDashboardHref } from "./useDashboardHref";
import { saveScrollBeforeFilterNav } from "./FilterScrollPreserve";

type Props = {
  user: DashboardUser;
  masterFilter: MasterFilterParams;
  filterOptionsFromServer: MasterFilterOptions;
  deanDepartmentStats?: DepartmentStats[];
  deanProgramStats?: ProgramStats[];
  deanInstructorStats?: InstructorStats[];
  deanCourseStats?: CourseStats[];
  hodProgramStats?: ProgramStats[];
  hodCourseStats?: CourseStats[];
  hodInstructorStats?: InstructorStats[];
  instructorCourseStats?: CourseStats[];
  hodProgramCount?: number;
  hodCourseCount?: number;
  hodInstructorCount?: number;
  instructorCourseCount?: number;
  selectedAlert: string;
  gpaFilters: AlertDimensionFilter[];
  attendanceFilters: AlertDimensionFilter[];
  classStatusFilters: string[];
  interventionFilters: string[];
  returnToUrl: string;
  departmentIds: string[];
  programIds: string[];
  instructorIds: string[];
  viewMode:
    | "table"
    | "nested"
    | "attendance-missing"
    | "intervention-search"
    | "intervention-teacher-search";
  /** Section IDs to expand in nested view (e.g. from URL ?expanded=). */
  expandedIds?: string[];
  /** Superadmin preview: scope filter-counts APIs to emulated role/faculty. */
  filterApiRoleScope?: FilterApiRoleScope | null;
};

export function EnrollmentDashboard({
  user,
  masterFilter,
  filterOptionsFromServer,
  deanDepartmentStats,
  deanProgramStats,
  deanInstructorStats,
  deanCourseStats,
  hodProgramStats,
  hodCourseStats,
  hodInstructorStats,
  instructorCourseStats,
  hodProgramCount,
  hodCourseCount,
  hodInstructorCount,
  instructorCourseCount,
  selectedAlert,
  gpaFilters,
  attendanceFilters,
  classStatusFilters,
  interventionFilters,
  returnToUrl,
  departmentIds,
  programIds,
  instructorIds,
  viewMode,
  expandedIds = [],
  filterApiRoleScope,
}: Props) {
  // Shared filter state (owned by DashboardFiltersStateProvider from Chunk 1).
  const dashboardFilter = useDashboardFilter();

  const localMasterFilter: MasterFilterParams =
    dashboardFilter?.masterFilter ?? masterFilter;
  const localGpaFilters: AlertDimensionFilter[] =
    dashboardFilter?.gpaFilters ?? gpaFilters;
  const localAttendanceFilters: AlertDimensionFilter[] =
    dashboardFilter?.attendanceFilters ?? attendanceFilters;
  const localInterventionFilters: string[] =
    dashboardFilter?.interventionFilters ?? interventionFilters;
  const localClassStatusFilters: string[] =
    dashboardFilter?.classStatusFilters ?? classStatusFilters;
  const localResolutionFilters: string[] =
    dashboardFilter?.resolutionFilters ?? [];

  // Intervention status filters are not yet wired; keep empty for now.
  const localInterventionStatusFilters: string[] = [];

  const setLocalMasterFilter: Dispatch<SetStateAction<MasterFilterParams>> =
    dashboardFilter?.setMasterFilter ??
    ((_: SetStateAction<MasterFilterParams>) => {});
  const setLocalGpaFilters: Dispatch<SetStateAction<AlertDimensionFilter[]>> =
    dashboardFilter?.setGpaFilters ??
    ((_: SetStateAction<AlertDimensionFilter[]>) => {});
  const setLocalAttendanceFilters: Dispatch<
    SetStateAction<AlertDimensionFilter[]>
  > =
    dashboardFilter?.setAttendanceFilters ??
    ((_: SetStateAction<AlertDimensionFilter[]>) => {});
  const setLocalInterventionFilters: Dispatch<SetStateAction<string[]>> =
    dashboardFilter?.setInterventionFilters ??
    ((_: SetStateAction<string[]>) => {});
  const setLocalClassStatusFilters: Dispatch<SetStateAction<string[]>> =
    dashboardFilter?.setClassStatusFilters ??
    ((_: SetStateAction<string[]>) => {});
  const setLocalResolutionFilters: Dispatch<SetStateAction<string[]>> =
    dashboardFilter?.setResolutionFilters ??
    ((_: SetStateAction<string[]>) => {});

  const filterOptions: MasterFilterOptions = filterOptionsFromServer;

  const departmentStats = useMemo(() => {
    if (user.role !== "dean") return undefined;
    const source = deanDepartmentStats ?? [];
    return source.length ? source : undefined;
  }, [user.role, deanDepartmentStats]);

  const programStats = useMemo(() => {
    if (user.role !== "dean") return undefined;
    const source = deanProgramStats ?? [];
    return source.length ? source : undefined;
  }, [user.role, deanProgramStats]);
  const filteredData: EnrollmentRecord[] | null = null;
  const instructorStats = useMemo(() => {
    if (user.role !== "dean") return undefined;
    const source = deanInstructorStats ?? [];
    return source.length ? source : undefined;
  }, [user.role, deanInstructorStats]);

  return (
    <DashboardUiStateProvider
      initialViewMode={viewMode}
      initialExpandedIds={expandedIds}
    >
      <EnrollmentDashboardInner
        user={user}
        departmentIds={departmentIds}
        programIds={programIds}
        instructorIds={instructorIds}
        selectedAlert={selectedAlert}
        filterOptions={filterOptions}
        filteredData={filteredData}
        returnToUrl={returnToUrl}
        localMasterFilter={localMasterFilter}
        localGpaFilters={localGpaFilters}
        localAttendanceFilters={localAttendanceFilters}
        localClassStatusFilters={localClassStatusFilters}
        localInterventionFilters={localInterventionFilters}
        localResolutionFilters={localResolutionFilters}
        localInterventionStatusFilters={localInterventionStatusFilters}
        setLocalMasterFilter={setLocalMasterFilter}
        setLocalGpaFilters={setLocalGpaFilters}
        setLocalAttendanceFilters={setLocalAttendanceFilters}
        setLocalClassStatusFilters={setLocalClassStatusFilters}
        setLocalInterventionFilters={setLocalInterventionFilters}
        setLocalResolutionFilters={setLocalResolutionFilters}
        departmentStats={departmentStats}
        programStats={programStats}
        instructorStats={instructorStats}
        deanCourseStats={deanCourseStats}
        hodProgramStats={hodProgramStats}
        hodCourseStats={hodCourseStats}
        hodInstructorStats={hodInstructorStats}
        instructorCourseStats={instructorCourseStats}
        hodProgramCount={hodProgramCount}
        hodCourseCount={hodCourseCount}
        hodInstructorCount={hodInstructorCount}
        instructorCourseCount={instructorCourseCount}
        filterApiRoleScope={filterApiRoleScope}
      />
    </DashboardUiStateProvider>
  );
}

type InnerProps = {
  user: DashboardUser;
  departmentIds: string[];
  programIds: string[];
  instructorIds: string[];
  selectedAlert: string;
  filterOptions: MasterFilterOptions;
  filteredData: EnrollmentRecord[] | null;
  returnToUrl: string;
  localMasterFilter: MasterFilterParams;
  localGpaFilters: AlertDimensionFilter[];
  localAttendanceFilters: AlertDimensionFilter[];
  localClassStatusFilters: string[];
  localInterventionFilters: string[];
  localResolutionFilters: string[];
  localInterventionStatusFilters: string[];
  setLocalMasterFilter: Dispatch<SetStateAction<MasterFilterParams>>;
  setLocalGpaFilters: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setLocalAttendanceFilters: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setLocalClassStatusFilters: Dispatch<SetStateAction<string[]>>;
  setLocalInterventionFilters: Dispatch<SetStateAction<string[]>>;
  setLocalResolutionFilters: Dispatch<SetStateAction<string[]>>;
  departmentStats: DepartmentStats[] | undefined;
  programStats: ProgramStats[] | undefined;
  instructorStats: InstructorStats[] | undefined;
  deanCourseStats: CourseStats[] | undefined;
  hodProgramStats?: ProgramStats[];
  hodCourseStats?: CourseStats[];
  hodInstructorStats?: InstructorStats[];
  instructorCourseStats?: CourseStats[];
  hodProgramCount?: number;
  hodCourseCount?: number;
  hodInstructorCount?: number;
  instructorCourseCount?: number;
  filterApiRoleScope?: FilterApiRoleScope | null;
};

function EnrollmentDashboardInner({
  user,
  departmentIds,
  programIds,
  instructorIds,
  selectedAlert,
  filterOptions,
  filteredData,
  returnToUrl,
  localMasterFilter,
  localGpaFilters,
  localAttendanceFilters,
  localClassStatusFilters,
  localInterventionFilters,
  localResolutionFilters,
  localInterventionStatusFilters,
  setLocalMasterFilter,
  setLocalGpaFilters,
  setLocalAttendanceFilters,
  setLocalClassStatusFilters,
  setLocalInterventionFilters,
  setLocalResolutionFilters,
  departmentStats,
  programStats,
  instructorStats,
  deanCourseStats,
  hodProgramStats,
  hodCourseStats,
  hodInstructorStats,
  instructorCourseStats,
  hodProgramCount,
  hodCourseCount,
  hodInstructorCount,
  instructorCourseCount,
  filterApiRoleScope,
}: InnerProps) {
  const { viewMode, expandedIds } = useDashboardUiState();
  const router = useRouter();
  const mergeHref = useMergeDashboardHref();

  const applyMasterFilterUpdate = useCallback(
    (updater: SetStateAction<MasterFilterParams>) => {
      setLocalMasterFilter((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: MasterFilterParams) => MasterFilterParams)(prev)
            : updater;

        saveScrollBeforeFilterNav();
        const href = mergeHref({
          department: next.department_ids?.length
            ? next.department_ids.join(",")
            : null,
          program: next.programs?.length ? next.programs.join(",") : null,
          instructor: next.instructor_ids?.length
            ? next.instructor_ids.join(",")
            : null,
          course: next.course_ids?.length ? next.course_ids.join(",") : null,
        });
        router.replace(href, { scroll: false });
        return next;
      });
    },
    [mergeHref, router, setLocalMasterFilter]
  );

  const departmentCount = departmentStats?.length ?? 0;
  const programCount = programStats?.length ?? 0;
  const instructorCount = instructorStats?.length ?? 0;
  const courseCount = user.role === "dean" ? (deanCourseStats?.length ?? 0) : 0;

  const liveReturnToUrl = useMemo(() => {
    const base = new URL(returnToUrl, "http://localhost");
    const params = base.searchParams;

    const setMulti = (key: string, values: string[] | undefined) => {
      if (values?.length) params.set(key, values.join(","));
      else params.delete(key);
    };

    setMulti("department", localMasterFilter.department_ids);
    setMulti("program", localMasterFilter.programs);
    setMulti("instructor", localMasterFilter.instructor_ids);
    setMulti("course", localMasterFilter.course_ids);
    setMulti("gpa_filter", localGpaFilters);
    setMulti("attendance_filter", localAttendanceFilters);
    setMulti("class_status_filter", localClassStatusFilters);
    setMulti("intervention_filter", localInterventionFilters);
    setMulti("resolution_filter", localResolutionFilters);

    if (selectedAlert && selectedAlert !== "all") {
      params.set("selected_alert", selectedAlert);
    } else {
      params.delete("selected_alert");
    }

    if (viewMode === "nested") params.set("view", "nested");
    else if (viewMode === "attendance-missing")
      params.set("view", "attendance-missing");
    else if (viewMode === "intervention-search")
      params.set("view", "intervention-search");
    else if (viewMode === "intervention-teacher-search")
      params.set("view", "intervention-teacher-search");
    else params.delete("view");

    if (expandedIds.length) params.set("expanded", expandedIds.join(","));
    else params.delete("expanded");

    const query = params.toString();
    return query ? `/dashboard/?${query}` : "/dashboard/";
  }, [
    returnToUrl,
    localMasterFilter.department_ids,
    localMasterFilter.programs,
    localMasterFilter.instructor_ids,
    localMasterFilter.course_ids,
    localGpaFilters,
    localAttendanceFilters,
    localClassStatusFilters,
    localInterventionFilters,
    localResolutionFilters,
    selectedAlert,
    viewMode,
    expandedIds,
  ]);

  return (
    <>
      <div className="mt-4 mb-4 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          {user.role === "hod" && (
            <HodStatsCollapsible
              programCount={hodProgramCount}
              courseCount={hodCourseCount}
              instructorCount={hodInstructorCount}
              selectedProgramId={localMasterFilter.programs?.[0]}
              selectedCourseId={localMasterFilter.course_ids?.[0]}
              programContent={
                <HodProgramStats
                  user={user as any}
                  selectedProgramId={localMasterFilter.programs?.[0]}
                  masterFilterProgramIds={localMasterFilter.programs}
                  stats={hodProgramStats}
                  onSelectProgramId={(id) =>
                    applyMasterFilterUpdate((prev) => {
                      const isSame = prev.programs?.[0] === id;
                      return {
                        ...prev,
                        programs: isSame ? undefined : [id],
                        course_ids: undefined,
                        instructor_ids: undefined,
                      };
                    })
                  }
                />
              }
              courseContent={
                <HodCourseStats
                  user={user as any}
                  selectedProgramId={localMasterFilter.programs?.[0]}
                  selectedCourseId={localMasterFilter.course_ids?.[0]}
                  stats={hodCourseStats}
                  onSelectCourseId={(id) =>
                    applyMasterFilterUpdate((prev) => {
                      const isSame = prev.course_ids?.[0] === id;
                      return {
                        ...prev,
                        course_ids: isSame ? undefined : [id],
                        instructor_ids: undefined,
                      };
                    })
                  }
                />
              }
              instructorContent={
                <HodInstructorStats
                  user={user as any}
                  selectedProgramId={localMasterFilter.programs?.[0]}
                  selectedCourseId={localMasterFilter.course_ids?.[0]}
                  selectedInstructorId={localMasterFilter.instructor_ids?.[0]}
                  stats={hodInstructorStats}
                  onSelectInstructorId={(id) =>
                    applyMasterFilterUpdate((prev) => ({
                      ...prev,
                      instructor_ids:
                        prev.instructor_ids?.[0] === id ? undefined : [id],
                    }))
                  }
                />
              }
            />
          )}
          {(user.role === "teacher" || user.role === "instructor") && (
            <InstructorStatsCollapsible
              courseCount={instructorCourseCount}
              courseContent={
                <InstructorCourseStats
                  user={user as any}
                  selectedCourseId={localMasterFilter.course_ids?.[0]}
                  stats={instructorCourseStats}
                  onSelectCourseId={(id) =>
                    applyMasterFilterUpdate((prev) => ({
                      ...prev,
                      course_ids: prev.course_ids?.[0] === id ? undefined : [id],
                    }))
                  }
                />
              }
            />
          )}
          {user.role === "dean" && (
            <DeanStatsCollapsible
              selectedDepartmentId={departmentIds[0]}
              selectedProgramId={programIds[0]}
              departmentCount={departmentCount}
              programCount={programCount}
              instructorCount={instructorCount}
              courseCount={courseCount}
              onClearDepartmentFilters={() =>
                applyMasterFilterUpdate((prev) => ({
                  ...prev,
                  department_ids: undefined,
                  programs: undefined,
                  course_ids: undefined,
                  instructor_ids: undefined,
                }))
              }
              onClearProgramFilters={() =>
                applyMasterFilterUpdate((prev) => ({
                  ...prev,
                  programs: undefined,
                  course_ids: undefined,
                  instructor_ids: undefined,
                }))
              }
              onClearInstructorFilters={() =>
                applyMasterFilterUpdate((prev) => ({
                  ...prev,
                  instructor_ids: undefined,
                }))
              }
              onClearCourseFilters={() =>
                applyMasterFilterUpdate((prev) => ({
                  ...prev,
                  course_ids: undefined,
                }))
              }
              hasDepartmentFilters={
                (localMasterFilter.department_ids?.length ?? 0) > 0
              }
              hasProgramFilters={(localMasterFilter.programs?.length ?? 0) > 0}
              hasInstructorFilters={
                (localMasterFilter.instructor_ids?.length ?? 0) > 0
              }
              hasCourseFilters={
                (localMasterFilter.course_ids?.length ?? 0) > 0
              }
              departmentContent={
                <DeanDepartmentStats
                  user={user}
                  selectedDepartmentId={
                    localMasterFilter.department_ids?.[0]
                  }
                  masterFilterDepartmentIds={
                    localMasterFilter.department_ids?.length
                      ? localMasterFilter.department_ids
                      : undefined
                  }
                  stats={departmentStats}
                  onSelectDepartmentId={(id) =>
                    applyMasterFilterUpdate((prev) => {
                      const isSame = prev.department_ids?.[0] === id;
                      if (isSame) {
                        return {
                          ...prev,
                          department_ids: undefined,
                          programs: undefined,
                          course_ids: undefined,
                          instructor_ids: undefined,
                        };
                      }
                      return {
                        ...prev,
                        department_ids: [id],
                        programs: undefined,
                        course_ids: undefined,
                        instructor_ids: undefined,
                      };
                    })
                  }
                />
              }
              programContent={
                <DeanProgramStats
                  user={user}
                  selectedProgramId={
                    localMasterFilter.programs?.[0]
                  }
                  masterFilterProgramIds={
                    localMasterFilter.programs?.length
                      ? localMasterFilter.programs
                      : undefined
                  }
                  masterFilterDepartmentIds={
                    localMasterFilter.department_ids?.length
                      ? localMasterFilter.department_ids
                      : undefined
                  }
                  stats={programStats}
                  onSelectProgramId={(id) =>
                    applyMasterFilterUpdate((prev) => {
                      const isSame = prev.programs?.[0] === id;
                      return {
                        ...prev,
                        programs: isSame ? undefined : [id],
                        course_ids: undefined,
                        instructor_ids: undefined,
                      };
                    })
                  }
                />
              }
         
              courseContent={
                <DeanCourseStats
                  user={user}
                  selectedCourseId={localMasterFilter.course_ids?.[0] ?? undefined}
                  masterFilterCourseIds={
                    localMasterFilter.course_ids?.length
                      ? localMasterFilter.course_ids
                      : undefined
                  }
                  stats={deanCourseStats}
                  onSelectCourseId={(id) =>
                    applyMasterFilterUpdate((prev) => ({
                      ...prev,
                      course_ids: prev.course_ids?.[0] === id ? undefined : [id],
                    }))
                  }
                />
              }
              instructorContent={
                <DeanInstructorStats
                  user={user}
                  selectedDepartmentId={
                    localMasterFilter.department_ids?.[0]
                  }
                  selectedInstructorId={
                    localMasterFilter.instructor_ids?.[0]
                  }
                  stats={instructorStats}
                  onSelectInstructorId={(id) =>
                    applyMasterFilterUpdate((prev) => ({
                      ...prev,
                      instructor_ids:
                        prev.instructor_ids?.[0] === id ? undefined : [id],
                    }))
                  }
                />
              }
            />
          )}
        </div>
      </div>

      <div className="mb-4">
        <MasterFilter
          options={filterOptions}
          current={localMasterFilter}
          role={
            user.role === "superadmin"
              ? "dean"
              : user.role === "instructor"
                ? "teacher"
                : user.role === "wellbeing" ||
                    user.role === "wellbeing-head" ||
                    user.role === "wellbeing-counseller"
                  ? "dean"
                : user.role
          }
          filterApiRoleScope={filterApiRoleScope}
          selectedAlert={selectedAlert}
          gpaFilters={localGpaFilters}
          attendanceFilters={localAttendanceFilters}
          classStatusFilters={localClassStatusFilters}
          interventionFilters={localInterventionFilters}
          resolutionFilters={localResolutionFilters}
          interventionStatusFilters={localInterventionStatusFilters}
          onChangeMasterFilter={(updates) =>
            applyMasterFilterUpdate((prev) => ({
              ...prev,
              ...updates,
            }))
          }
          onChangeGpaFilters={(values) => setLocalGpaFilters(values)}
          onChangeAttendanceFilters={(values) =>
            setLocalAttendanceFilters(values)
          }
          onChangeClassStatusFilters={(values) =>
            setLocalClassStatusFilters(values)
          }
          onChangeInterventionFilters={(values) =>
            setLocalInterventionFilters(values)
          }
          onChangeResolutionFilters={(values) =>
            setLocalResolutionFilters(values)
          }
        />
      </div>

      <div className="col-span-12 mb-12 min-h-[520px]">
        <div className="mb-4">
          <StudentsViewTabs />
        </div>
        {viewMode === "table" ? (
          <TopChannelsTableClient
            returnToUrl={liveReturnToUrl}
            masterFilter={localMasterFilter}
            attendanceFilters={localAttendanceFilters}
            classStatusFilters={localClassStatusFilters}
            gpaFilters={localGpaFilters}
            interventionFilters={localInterventionFilters}
            resolutionFilters={localResolutionFilters}
          />
        ) : viewMode === "nested" ? (
          <ExpandableListUrlSync>
            <NestedEnrollmentTableClient
              returnToUrl={liveReturnToUrl}
              enrollmentData={filteredData ?? null}
              departmentStats={departmentStats}
              programStats={programStats}
              courseStats={deanCourseStats}
              instructorStats={instructorStats}
              masterFilter={localMasterFilter}
              attendanceFilters={localAttendanceFilters}
              classStatusFilters={localClassStatusFilters}
              gpaFilters={localGpaFilters}
              interventionFilters={localInterventionFilters}
              resolutionFilters={localResolutionFilters}
            />
          </ExpandableListUrlSync>
        ) : viewMode === "attendance-missing" ? (
          <ExpandableListUrlSync>
            <AttendanceMissingTableClient
              returnToUrl={liveReturnToUrl}
              masterFilter={localMasterFilter}
              attendanceFilters={localAttendanceFilters}
              classStatusFilters={localClassStatusFilters}
              gpaFilters={localGpaFilters}
              interventionFilters={localInterventionFilters}
              resolutionFilters={localResolutionFilters}
            />
          </ExpandableListUrlSync>
        ) : viewMode === "intervention-search" ? (
          <InterventionStudentSearchTab />
        ) : (
          <InterventionTeacherSearchTab />
        )}
      </div>
    </>
  );
}
