import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OverviewCardsGroup } from "./_components/overview-cards";
import { OverviewCardsSkeleton } from "./_components/overview-cards/skeleton";
import {
  getCurrentUser,
  getMasterFilterOptions,
  getOverviewData,
  getAlertSnapshotTrend,
  getDeanDepartmentStats,
  getDeanProgramStats,
  getDeanInstructorStats,
  getDeanCourseStats,
  getHodProgramStats,
  getHodCourseStats,
  getHodInstructorStats,
  getInstructorCourseStats,
} from "./fetch";
import type { MasterFilterParams, AlertDimensionFilter } from "./fetch";
import { InterventionStatusChartClient } from "./_components/InterventionStatusChartClient";
import { WellbeingChartClient } from "./_components/WellbeingChartClient";
import { AlertSnapshotsCollapsible } from "./_components/AlertSnapshotsCollapsible";
import { FilterScrollPreserve } from "./_components/FilterScrollPreserve";
import { EnrollmentDashboard } from "./_components/EnrollmentDashboard";
import { DashboardFiltersStateProvider } from "./_components/DashboardFiltersStateProvider";
import { InterventionSliceProvider } from "./_components/InterventionSliceContext";
import { InterventionCohortStatsProvider } from "./_components/InterventionCohortStatsContext";
import { ScrollToTopButton } from "./_components/ScrollToTopButton";
function parseMultiParam(
  value: string | string[] | undefined
): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((s) => s.split(",").map((x) => x.trim()).filter(Boolean));
}

type PropsType = {
  searchParams: Promise<{
    as?: string | string[];
    faculty?: string | string[];
    selected_alert?: string;
    department?: string | string[];
    program?: string | string[];
    instructor?: string | string[];
    course?: string | string[];
    batch?: string | string[];
    gpa_filter?: string;
    attendance_filter?: string;
    class_status_filter?: string | string[];
    intervention_filter?: string | string[];
    expanded?: string;
    view?: string;
    sort?: string;
    order?: string;
  }>;
};

export default async function Home({ searchParams }: PropsType) {
  const params = await searchParams;
  const selectedAlert = params.selected_alert || "all";
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }
  if (user.role === "wellbeing-head") {
    redirect("/dashboard/wellbeing/admin");
  }
  if (user.role === "wellbeing-counseller" || user.role === "wellbeing") {
    redirect("/dashboard/wellbeing/counseller");
  }

  const asParam = Array.isArray(params.as) ? params.as[0] : params.as;
  const facultyParam = Array.isArray(params.faculty)
    ? params.faculty[0]
    : params.faculty;

  // When superadmin navigates from the faculties tiles, emulate dean view.
  const effectiveUser =
    user.role === "superadmin" &&
    asParam === "dean" &&
    typeof facultyParam === "string" &&
    facultyParam.trim().length > 0
      ? { ...user, role: "dean" as const, faculty_id: facultyParam.trim() }
      : user;

  const departmentIds = parseMultiParam(params.department);
  const programs = parseMultiParam(params.program);
  let instructorIds = parseMultiParam(params.instructor);
  const courseIds = parseMultiParam(params.course);
  const batches = parseMultiParam(params.batch);

  // Scope by session: Instructor sees only their courses (Pernr = sap_id); HoD sees only their departments
  if (
    (effectiveUser.role === "teacher" || effectiveUser.role === "instructor") &&
    !instructorIds.length &&
    effectiveUser.sap_id
  ) {
    instructorIds = [effectiveUser.sap_id];
  }
  const effectiveDeptIds =
    effectiveUser.role === "hod" &&
    effectiveUser.department_ids?.length &&
    !departmentIds.length
      ? effectiveUser.department_ids
      : departmentIds;

  const masterFilter: MasterFilterParams = {
    department_ids: effectiveDeptIds.length ? effectiveDeptIds : undefined,
    programs: programs.length ? programs : undefined,
    instructor_ids: instructorIds.length ? instructorIds : undefined,
    course_ids: courseIds.length ? courseIds : undefined,
    batches: batches.length ? batches : undefined,
  };

  const validAlertDim = (s: string): s is AlertDimensionFilter =>
    s === "red" || s === "yellow" || s === "good";
  const gpaFiltersRaw = parseMultiParam(params.gpa_filter);
  const attendanceFiltersRaw = parseMultiParam(params.attendance_filter);
  const gpaFilters = gpaFiltersRaw.filter(validAlertDim) as AlertDimensionFilter[];
  const attendanceFilters = attendanceFiltersRaw.filter(validAlertDim) as AlertDimensionFilter[];
  const interventionFilters = parseMultiParam(params.intervention_filter);
  const classStatusFilters = parseMultiParam(params.class_status_filter);

  let hodProgramCount = 0;
  let hodCourseCount = 0;
  let hodInstructorCount = 0;
  let instructorCourseCount = 0;
  let hodProgramStatsData: Awaited<ReturnType<typeof getHodProgramStats>> | undefined = undefined;
  let hodCourseStatsData: Awaited<ReturnType<typeof getHodCourseStats>> | undefined = undefined;
  let hodInstructorStatsData: Awaited<ReturnType<typeof getHodInstructorStats>> | undefined = undefined;
  let instructorCourseStatsData: Awaited<ReturnType<typeof getInstructorCourseStats>> | undefined = undefined;
  let deanDepartmentStats: Awaited<ReturnType<typeof getDeanDepartmentStats>> | undefined = undefined;
  let deanProgramStats: Awaited<ReturnType<typeof getDeanProgramStats>> | undefined = undefined;
  let deanInstructorStats: Awaited<ReturnType<typeof getDeanInstructorStats>> | undefined = undefined;
  let deanCourseStats: Awaited<ReturnType<typeof getDeanCourseStats>> | undefined = undefined;
  if (effectiveUser.role === "dean") {
    const deanFacultyId = effectiveUser.faculty_id ?? null;
    [deanDepartmentStats, deanProgramStats, deanInstructorStats, deanCourseStats] = await Promise.all([
      // Keep department list fully visible; selection should only narrow children.
      getDeanDepartmentStats(deanFacultyId),
      getDeanProgramStats(deanFacultyId, {
        ...(effectiveDeptIds.length ? { departmentIds: effectiveDeptIds } : {}),
      }),
      getDeanInstructorStats(deanFacultyId, {
        ...(effectiveDeptIds.length ? { departmentIds: effectiveDeptIds } : {}),
        ...(programs.length ? { programIds: programs } : {}),
        ...(courseIds.length ? { courseIds } : {}),
        ...(instructorIds.length ? { instructorIds } : {}),
      }),
      getDeanCourseStats(deanFacultyId, {
        ...(effectiveDeptIds.length ? { departmentIds: effectiveDeptIds } : {}),
        ...(programs.length ? { programIds: programs } : {}),
        ...(courseIds.length ? { courseIds } : {}),
        ...(instructorIds.length ? { instructorIds } : {}),
      }),
    ]);
  }
  if (
    effectiveUser.role === "hod" &&
    effectiveUser.department_ids?.length
  ) {
    const [programStats, courseStats, instructorStats] = await Promise.all([
      getHodProgramStats(effectiveUser.department_ids),
      getHodCourseStats(effectiveUser.department_ids, {
        ...(programs[0] ? { programIds: [programs[0]] } : {}),
        ...(instructorIds[0] ? { instructorIds: [instructorIds[0]] } : {}),
      }),
      getHodInstructorStats(effectiveUser.department_ids, {
        ...(programs[0] ? { programIds: [programs[0]] } : {}),
        ...(courseIds[0] ? { courseIds: [courseIds[0]] } : {}),
      }),
    ]);
    hodProgramStatsData = programStats;
    hodCourseStatsData = courseStats;
    hodInstructorStatsData = instructorStats;
    hodProgramCount = programStats.length;
    hodCourseCount = courseStats.length;
    hodInstructorCount = instructorStats.length;
  }
  if (effectiveUser.role === "teacher" || effectiveUser.role === "instructor") {
    const instructorCourses = await getInstructorCourseStats(effectiveUser);
    instructorCourseStatsData = instructorCourses;
    instructorCourseCount = instructorCourses.length;
  }

  /** Superadmin ?as=dean&faculty=… — client APIs must scope like this, not as global superadmin. */
  const filterApiRoleScope =
    user.role === "superadmin" &&
    effectiveUser.role === "dean" &&
    effectiveUser.faculty_id
      ? { role: "dean" as const, facultyId: effectiveUser.faculty_id }
      : undefined;

  const filterOptions = await getMasterFilterOptions(
    effectiveUser,
    masterFilter
  );

  const [{ totalStudents, yellowGpa, redGpa, yellowAttendance, redAttendance }, snapshotTrend] =
    await Promise.all([
      getOverviewData(effectiveUser, masterFilter, gpaFilters, attendanceFilters),
      getAlertSnapshotTrend(effectiveUser, masterFilter, 365),
    ]);

  const viewMode =
    params.view === "nested"
      ? "nested"
      : params.view === "attendance-missing"
      ? "attendance-missing"
      : params.view === "intervention-search"
      ? "intervention-search"
      : params.view === "intervention-teacher-search"
      ? "intervention-teacher-search"
      : "table";
  const expandedParam = params.expanded;
  const expandedIds = expandedParam ? expandedParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const sortBy = params.sort === "attendance" || params.sort === "gpa" ? params.sort : null;
  const sortOrder = params.order === "asc" || params.order === "desc" ? params.order : "asc";
  const returnToParams = new URLSearchParams();
  if (selectedAlert && selectedAlert !== "all") returnToParams.set("selected_alert", selectedAlert);
  if (effectiveDeptIds.length) returnToParams.set("department", effectiveDeptIds.join(","));
  if (programs.length) returnToParams.set("program", programs.join(","));
  if (instructorIds.length) returnToParams.set("instructor", instructorIds.join(","));
  if (courseIds.length) returnToParams.set("course", courseIds.join(","));
  if (gpaFilters.length) returnToParams.set("gpa_filter", gpaFilters.join(","));
  if (attendanceFilters.length) returnToParams.set("attendance_filter", attendanceFilters.join(","));
  if (classStatusFilters.length)
    returnToParams.set("class_status_filter", classStatusFilters.join(","));
  if (interventionFilters.length) returnToParams.set("intervention_filter", interventionFilters.join(","));
  if (effectiveUser.role === "dean" && user.role === "superadmin") {
    returnToParams.set("as", "dean");
    if (effectiveUser.faculty_id) {
      returnToParams.set("faculty", effectiveUser.faculty_id);
    }
  }
  if (expandedParam) returnToParams.set("expanded", expandedParam);
  if (viewMode === "nested") returnToParams.set("view", "nested");
  if (viewMode === "attendance-missing")
    returnToParams.set("view", "attendance-missing");
  if (viewMode === "intervention-search")
    returnToParams.set("view", "intervention-search");
  if (viewMode === "intervention-teacher-search")
    returnToParams.set("view", "intervention-teacher-search");
  if (sortBy) returnToParams.set("sort", sortBy);
  if (sortOrder && sortBy) returnToParams.set("order", sortOrder);
  const returnToUrl = returnToParams.toString() ? `/dashboard/?${returnToParams.toString()}` : "/dashboard/";

  return (
    <>
      <Suspense fallback={null}>
        <FilterScrollPreserve />
      </Suspense>
      <DashboardFiltersStateProvider
        initial={{
          masterFilter,
          gpaFilters,
          attendanceFilters,
          classStatusFilters,
          interventionFilters,
          resolutionFilters: [],
        }}
      >
        <InterventionCohortStatsProvider user={effectiveUser}>
        <InterventionSliceProvider>
        <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6">
          <div className="col-span-12 md:col-span-4">
            <Suspense fallback={<OverviewCardsSkeleton />}>
              <OverviewCardsGroup
                selectedAlert={selectedAlert}
                user={effectiveUser}
                totalStudents={totalStudents}
                yellowGpa={yellowGpa.value}
                redGpa={redGpa.value}
                yellowAttendance={yellowAttendance.value}
                redAttendance={redAttendance.value}
              />
            </Suspense>
          </div>
          <div className="col-span-12 md:col-span-4 bg-white dark:bg-gray-dark rounded-lg shadow-1 pt-4">
            <InterventionStatusChartClient
              title="Outreach & Intervention"
              user={effectiveUser}
              gpaFilters={gpaFilters}
              attendanceFilters={attendanceFilters}
              selectedAlert={selectedAlert}
              yellowGpa={yellowGpa.value}
              redGpa={redGpa.value}
              yellowAttendance={yellowAttendance.value}
              redAttendance={redAttendance.value}
            />
          </div>
          <div className="col-span-12 md:col-span-4 bg-white dark:bg-gray-dark rounded-lg shadow-1 pt-4">
            <WellbeingChartClient
              title="Wellbeing Intervention & Resolution"
              filterApiRoleScope={filterApiRoleScope}
            />
          </div>
        </div>
        <div className="mt-4">
          <AlertSnapshotsCollapsible points={snapshotTrend} />
        </div>
        </InterventionSliceProvider>
        </InterventionCohortStatsProvider>
        <EnrollmentDashboard
          user={effectiveUser}
          filterApiRoleScope={filterApiRoleScope}
          masterFilter={masterFilter}
          filterOptionsFromServer={filterOptions}
          deanDepartmentStats={deanDepartmentStats}
          deanProgramStats={deanProgramStats}
          deanInstructorStats={deanInstructorStats}
          deanCourseStats={deanCourseStats}
          hodProgramStats={hodProgramStatsData}
          hodCourseStats={hodCourseStatsData}
          hodInstructorStats={hodInstructorStatsData}
          instructorCourseStats={instructorCourseStatsData}
          hodProgramCount={hodProgramCount}
          hodCourseCount={hodCourseCount}
          hodInstructorCount={hodInstructorCount}
          instructorCourseCount={instructorCourseCount}
          selectedAlert={selectedAlert}
          gpaFilters={gpaFilters}
          attendanceFilters={attendanceFilters}
          classStatusFilters={classStatusFilters}
          interventionFilters={interventionFilters}
          returnToUrl={returnToUrl}
          departmentIds={departmentIds}
          programIds={programs}
          instructorIds={instructorIds}
          viewMode={viewMode}
          expandedIds={expandedIds}
        />
      </DashboardFiltersStateProvider>
      <ScrollToTopButton />
    </>
  );
}
