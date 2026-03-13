"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEnrollmentData } from "@/hooks/useEnrollmentData";
import {
  getDepartmentStats,
  getProgramStats,
  getInstructorStats,
  getMasterFilterOptions,
  filterEnrollmentByMasterFilter,
} from "@/lib/enrollment";
import type {
  MasterFilterOptions,
  MasterFilterParams,
  DashboardUser,
} from "@/lib/enrollment";
import type { AlertDimensionFilter } from "../fetch";
import { MasterFilter } from "./master-filter";
import { DeanStatsCollapsible } from "./dean-stats-collapsible";
import { DeanDepartmentStats } from "./dean-department-stats";
import { DeanProgramStats } from "./dean-program-stats";
import { DeanInstructorStats } from "./dean-instructor-stats";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { NestedEnrollmentTableClient } from "@/components/Tables/nested-students-table/NestedEnrollmentTableClient";
import { ExpandableListUrlSync } from "./ExpandableListUrlSync";
import { StudentsViewTabs } from "./StudentsViewTabs";
import { DashboardUiStateProvider, useDashboardUiState } from "./DashboardUiStateContext";

type Props = {
  user: DashboardUser;
  masterFilter: MasterFilterParams;
  filterOptionsFromServer: MasterFilterOptions;
  selectedAlert: string;
  gpaFilters: AlertDimensionFilter[];
  attendanceFilters: AlertDimensionFilter[];
  interventionFilters: string[];
  returnToUrl: string;
  departmentIds: string[];
  programIds: string[];
  instructorIds: string[];
  viewMode: "table" | "nested";
  /** Section IDs to expand in nested view (e.g. from URL ?expanded=). */
  expandedIds?: string[];
};

export function EnrollmentDashboard({
  user,
  masterFilter,
  filterOptionsFromServer,
  selectedAlert,
  gpaFilters,
  attendanceFilters,
  interventionFilters,
  returnToUrl,
  departmentIds,
  programIds,
  instructorIds,
  viewMode,
  expandedIds = [],
}: Props) {
  const { data: enrollmentData } = useEnrollmentData();

  // Local, client-side filter state to avoid full route transitions on every change.
  const [localMasterFilter, setLocalMasterFilter] =
    useState<MasterFilterParams>(masterFilter);
  const [localGpaFilters, setLocalGpaFilters] =
    useState<AlertDimensionFilter[]>(gpaFilters);
  const [localAttendanceFilters, setLocalAttendanceFilters] =
    useState<AlertDimensionFilter[]>(attendanceFilters);
  const [localInterventionFilters, setLocalInterventionFilters] = useState<
    string[]
  >(interventionFilters);
  const [localResolutionFilters, setLocalResolutionFilters] = useState<string[]>([]);
  const [localInterventionStatusFilters] = useState<string[]>([]);

  // Scope enrollment data by role: dean → faculty, HoD → departments, teacher → own Pernr.
  const scopedEnrollmentData = useMemo(() => {
    if (!enrollmentData?.length || !user.role) return enrollmentData ?? [];
    let list = enrollmentData;
    const anyUser = user as any;

    if (user.role === "dean" && user.faculty_id) {
      list = list.filter((r) => r.FacId === user.faculty_id);
    } else if (user.role === "hod" && Array.isArray(anyUser.department_ids) && anyUser.department_ids.length) {
      const deptSet = new Set<string>(anyUser.department_ids);
      list = list.filter((r) => deptSet.has(r.DeptCode) || deptSet.has(r.DeptId));
    } else if (user.role === "teacher" && anyUser.sap_id) {
      const pernr = String(anyUser.sap_id).trim();
      list = list.filter((r) => (r.Pernr ?? "").trim() === pernr);
    }

    return list;
  }, [enrollmentData, user, user.role, user.faculty_id]);

  const filterOptions: MasterFilterOptions = useMemo(() => {
    if (scopedEnrollmentData?.length && user.role) {
      const facultyIdForDean = user.role === "dean" ? user.faculty_id ?? undefined : undefined;
      return getMasterFilterOptions(
        scopedEnrollmentData,
        facultyIdForDean,
        localMasterFilter,
      );
    }
    return filterOptionsFromServer;
  }, [scopedEnrollmentData, user.role, user.faculty_id, localMasterFilter, filterOptionsFromServer]);

  const departmentStats =
    scopedEnrollmentData?.length && user.role === "dean"
      ? getDepartmentStats(scopedEnrollmentData, user.faculty_id)
      : undefined;
  const programStats =
    scopedEnrollmentData?.length && user.role === "dean"
      ? getProgramStats(scopedEnrollmentData, user.faculty_id, {
          departmentIds: departmentIds.length ? departmentIds : undefined,
        })
      : undefined;
  const instructorStats =
    scopedEnrollmentData?.length && user.role === "dean"
      ? getInstructorStats(scopedEnrollmentData, user.faculty_id, {
          departmentIds:
            localMasterFilter.department_ids?.length
              ? localMasterFilter.department_ids
              : departmentIds.length
                ? departmentIds
                : undefined,
          instructorIds:
            localMasterFilter.instructor_ids?.length
              ? localMasterFilter.instructor_ids
              : instructorIds.length
                ? instructorIds
                : undefined,
        })
      : undefined;
  const filteredData =
    scopedEnrollmentData?.length && user.role
      ? filterEnrollmentByMasterFilter(
          scopedEnrollmentData,
          localMasterFilter,
          user.role === "dean" ? user.faculty_id ?? undefined : undefined,
        )
      : undefined;

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
        filteredData={filteredData ?? null}
        returnToUrl={returnToUrl}
        localMasterFilter={localMasterFilter}
        localGpaFilters={localGpaFilters}
        localAttendanceFilters={localAttendanceFilters}
        localInterventionFilters={localInterventionFilters}
        localResolutionFilters={localResolutionFilters}
        localInterventionStatusFilters={localInterventionStatusFilters}
        setLocalMasterFilter={setLocalMasterFilter}
        setLocalGpaFilters={setLocalGpaFilters}
        setLocalAttendanceFilters={setLocalAttendanceFilters}
        setLocalInterventionFilters={setLocalInterventionFilters}
        setLocalResolutionFilters={setLocalResolutionFilters}
        departmentStats={departmentStats}
        programStats={programStats}
        instructorStats={instructorStats}
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
  filteredData: ReturnType<typeof filterEnrollmentByMasterFilter> | null;
  returnToUrl: string;
  localMasterFilter: MasterFilterParams;
  localGpaFilters: AlertDimensionFilter[];
  localAttendanceFilters: AlertDimensionFilter[];
  localInterventionFilters: string[];
  localResolutionFilters: string[];
  localInterventionStatusFilters: string[];
  setLocalMasterFilter: Dispatch<SetStateAction<MasterFilterParams>>;
  setLocalGpaFilters: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setLocalAttendanceFilters: Dispatch<SetStateAction<AlertDimensionFilter[]>>;
  setLocalInterventionFilters: Dispatch<SetStateAction<string[]>>;
  setLocalResolutionFilters: Dispatch<SetStateAction<string[]>>;
  departmentStats: ReturnType<typeof getDepartmentStats> | undefined;
  programStats: ReturnType<typeof getProgramStats> | undefined;
  instructorStats: ReturnType<typeof getInstructorStats> | undefined;
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
  localInterventionFilters,
  localResolutionFilters,
  localInterventionStatusFilters,
  setLocalMasterFilter,
  setLocalGpaFilters,
  setLocalAttendanceFilters,
  setLocalInterventionFilters,
  setLocalResolutionFilters,
  departmentStats,
  programStats,
  instructorStats,
}: InnerProps) {
  const { viewMode } = useDashboardUiState();

  return (
    <>
      <div className="mt-4 mb-4 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          {user.role === "dean" && (
            <DeanStatsCollapsible
              selectedDepartmentId={departmentIds[0]}
              selectedProgramId={programIds[0]}
              departmentContent={
                <DeanDepartmentStats
                  user={user}
                  selectedDepartmentId={
                    localMasterFilter.department_ids?.[0] ?? departmentIds[0]
                  }
                  masterFilterDepartmentIds={
                    localMasterFilter.department_ids?.length
                      ? localMasterFilter.department_ids
                      : departmentIds.length
                        ? departmentIds
                        : undefined
                  }
                  stats={departmentStats}
                  onSelectDepartmentId={(id) =>
                    setLocalMasterFilter({
                      department_ids: [id],
                      programs: undefined,
                      course_ids: undefined,
                      instructor_ids: undefined,
                    })
                  }
                />
              }
              programContent={
                <DeanProgramStats
                  user={user}
                  selectedProgramId={
                    localMasterFilter.programs?.[0] ?? programIds[0]
                  }
                  masterFilterProgramIds={
                    localMasterFilter.programs?.length
                      ? localMasterFilter.programs
                      : programIds.length
                        ? programIds
                        : undefined
                  }
                  masterFilterDepartmentIds={
                    localMasterFilter.department_ids?.length
                      ? localMasterFilter.department_ids
                      : departmentIds.length
                        ? departmentIds
                        : undefined
                  }
                  stats={programStats}
                  onSelectProgramId={(id) =>
                    setLocalMasterFilter((prev) => ({
                      ...prev,
                      programs: [id],
                      course_ids: undefined,
                      instructor_ids: undefined,
                    }))
                  }
                />
              }
              instructorContent={
                <DeanInstructorStats
                  user={user}
                  selectedDepartmentId={
                    localMasterFilter.department_ids?.[0] ?? departmentIds[0]
                  }
                  selectedInstructorId={
                    localMasterFilter.instructor_ids?.[0] ?? instructorIds[0]
                  }
                  stats={instructorStats}
                  onSelectInstructorId={(id) =>
                    setLocalMasterFilter((prev) => ({
                      ...prev,
                      instructor_ids: [id],
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
          role={user.role}
          selectedAlert={selectedAlert}
          gpaFilters={localGpaFilters}
          attendanceFilters={localAttendanceFilters}
          interventionFilters={localInterventionFilters}
          resolutionFilters={localResolutionFilters}
          interventionStatusFilters={localInterventionStatusFilters}
          onChangeMasterFilter={(updates) =>
            setLocalMasterFilter((prev) => ({
              ...prev,
              ...updates,
            }))
          }
          onChangeGpaFilters={(values) => setLocalGpaFilters(values)}
          onChangeAttendanceFilters={(values) =>
            setLocalAttendanceFilters(values)
          }
          onChangeInterventionFilters={(values) =>
            setLocalInterventionFilters(values)
          }
          onChangeResolutionFilters={(values) =>
            setLocalResolutionFilters(values)
          }
        />
      </div>

      <div className="col-span-12 mb-12">
        <div className="mb-4">
          <StudentsViewTabs />
        </div>
        {viewMode === "table" ? (
          <TopChannelsTableClient
            returnToUrl={returnToUrl}
            enrollmentData={filteredData ?? null}
            attendanceFilters={localAttendanceFilters}
          />
        ) : (
          <ExpandableListUrlSync>
            <NestedEnrollmentTableClient
              returnToUrl={returnToUrl}
              enrollmentData={filteredData ?? null}
            />
          </ExpandableListUrlSync>
        )}
      </div>
    </>
  );
}
