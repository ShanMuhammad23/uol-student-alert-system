import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OverviewCardsGroup } from "./_components/overview-cards";
import { OverviewCardsSkeleton } from "./_components/overview-cards/skeleton";
import {
  getCurrentUser,
  getMasterFilterOptions,
  getOverviewData,
  getHodProgramStats,
  getHodCourseStats,
  getHodInstructorStats,
  getInstructorCourseStats,
} from "./fetch";
import type { MasterFilterParams, AlertDimensionFilter } from "./fetch";
import { HodStatsCollapsible } from "./_components/hod-stats-collapsible";
import { HodProgramStats } from "./_components/hod-program-stats";
import { HodInstructorStats } from "./_components/hod-instructor-stats";
import { HodCourseStats } from "./_components/hod-course-stats";
import { InstructorStatsCollapsible } from "./_components/instructor-stats-collapsible";
import { InstructorCourseStats } from "./_components/instructor-course-stats";
import { InterventionStatusChartClient } from "./_components/InterventionStatusChartClient";
import { WellbeingChartClient } from "./_components/WellbeingChartClient";
import { FilterScrollPreserve } from "./_components/FilterScrollPreserve";
import { EnrollmentDashboard } from "./_components/EnrollmentDashboard";
import { DashboardFiltersStateProvider } from "./_components/DashboardFiltersStateProvider";
import { InterventionSliceProvider } from "./_components/InterventionSliceContext";

function parseMultiParam(
  value: string | string[] | undefined
): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((s) => s.split(",").map((x) => x.trim()).filter(Boolean));
}

type PropsType = {
  searchParams: Promise<{
    selected_alert?: string;
    department?: string | string[];
    program?: string | string[];
    instructor?: string | string[];
    course?: string | string[];
    gpa_filter?: string;
    attendance_filter?: string;
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

  const departmentIds = parseMultiParam(params.department);
  const programs = parseMultiParam(params.program);
  let instructorIds = parseMultiParam(params.instructor);
  const courseIds = parseMultiParam(params.course);

  // Scope by session: Instructor sees only their courses (Pernr = sap_id); HoD sees only their departments
  if (user.role === "teacher" && !instructorIds.length && user.sap_id) {
    instructorIds = [user.sap_id];
  }
  const effectiveDeptIds =
    user.role === "hod" && user.department_ids?.length && !departmentIds.length
      ? user.department_ids
      : departmentIds;

  const masterFilter: MasterFilterParams = {
    department_ids: effectiveDeptIds.length ? effectiveDeptIds : undefined,
    programs: programs.length ? programs : undefined,
    instructor_ids: instructorIds.length ? instructorIds : undefined,
    course_ids: courseIds.length ? courseIds : undefined,
  };

  const validAlertDim = (s: string): s is AlertDimensionFilter =>
    s === "red" || s === "yellow" || s === "good";
  const gpaFiltersRaw = parseMultiParam(params.gpa_filter);
  const attendanceFiltersRaw = parseMultiParam(params.attendance_filter);
  const gpaFilters = gpaFiltersRaw.filter(validAlertDim) as AlertDimensionFilter[];
  const attendanceFilters = attendanceFiltersRaw.filter(validAlertDim) as AlertDimensionFilter[];
  const interventionFilters = parseMultiParam(params.intervention_filter);

  let hodProgramCount = 0;
  let hodCourseCount = 0;
  let hodInstructorCount = 0;
  let instructorCourseCount = 0;
  if (user.role === "hod" && user.department_ids?.length) {
    const [programStats, courseStats, instructorStats] = await Promise.all([
      getHodProgramStats(user.department_ids),
      getHodCourseStats(user.department_ids, {
        ...(programs[0] ? { programIds: [programs[0]] } : {}),
        ...(courseIds[0] ? { courseIds: [courseIds[0]] } : {}),
      }),
      getHodInstructorStats(user.department_ids, {
        ...(programs[0] ? { programIds: [programs[0]] } : {}),
        ...(courseIds[0] ? { courseIds: [courseIds[0]] } : {}),
        ...(instructorIds[0] ? { instructorIds: [instructorIds[0]] } : {}),
      }),
    ]);
    hodProgramCount = programStats.length;
    hodCourseCount = courseStats.length;
    hodInstructorCount = instructorStats.length;
  }
  if (user.role === "teacher") {
    const instructorCourses = await getInstructorCourseStats(user, {
      ...(courseIds[0] ? { courseIds: [courseIds[0]] } : {}),
    });
    instructorCourseCount = instructorCourses.length;
  }

  const filterOptions = await getMasterFilterOptions(user, masterFilter);

  const { totalStudents, yellowGpa, redGpa, yellowAttendance, redAttendance } = await getOverviewData(
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters
  );

  const viewMode = params.view === "nested" ? "nested" : "table";
  const expandedParam = params.expanded;
  const expandedIds = expandedParam ? expandedParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const sortBy = params.sort === "attendance" || params.sort === "gpa" ? params.sort : null;
  const sortOrder = params.order === "asc" || params.order === "desc" ? params.order : "asc";

  // Build URL to restore filters (and later expanded state) when returning from student profile
  const returnToParams = new URLSearchParams();
  if (selectedAlert && selectedAlert !== "all") returnToParams.set("selected_alert", selectedAlert);
  if (effectiveDeptIds.length) returnToParams.set("department", effectiveDeptIds.join(","));
  if (programs.length) returnToParams.set("program", programs.join(","));
  if (instructorIds.length) returnToParams.set("instructor", instructorIds.join(","));
  if (courseIds.length) returnToParams.set("course", courseIds.join(","));
  if (gpaFilters.length) returnToParams.set("gpa_filter", gpaFilters.join(","));
  if (attendanceFilters.length) returnToParams.set("attendance_filter", attendanceFilters.join(","));
  if (interventionFilters.length) returnToParams.set("intervention_filter", interventionFilters.join(","));
  if (expandedParam) returnToParams.set("expanded", expandedParam);
  if (viewMode === "nested") returnToParams.set("view", "nested");
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
          interventionFilters,
          resolutionFilters: [],
        }}
      >
        <InterventionSliceProvider>
        <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6">
          <div className="col-span-12 md:col-span-4 ">
            <Suspense fallback={<OverviewCardsSkeleton />}>
              <OverviewCardsGroup
                selectedAlert={selectedAlert}
                user={user}
                totalStudents={totalStudents}
                yellowGpa={yellowGpa.value}
                redGpa={redGpa.value}
                yellowAttendance={yellowAttendance.value}
                redAttendance={redAttendance.value}
              />
            </Suspense>
          </div>
          <div className=" col-span-12 md:col-span-4 bg-white rounded-lg shadow-1 pt-4">
            <InterventionStatusChartClient
              title="Outreach & Intervention"
              user={user}
              masterFilter={masterFilter}
              gpaFilters={gpaFilters}
              attendanceFilters={attendanceFilters}
              selectedAlert={selectedAlert}
              yellowGpa={yellowGpa.value}
              redGpa={redGpa.value}
              yellowAttendance={yellowAttendance.value}
              redAttendance={redAttendance.value}
            />
          </div>
          <div className="col-span-12 md:col-span-4 bg-white rounded-lg shadow-1 pt-4">
            <WellbeingChartClient title="Wellbeing Resolution" />
          </div>
        </div>
        </InterventionSliceProvider>

        <div className="mt-4 mb-4 grid grid-cols-12 gap-4">
          <div className="col-span-12">
            {user?.role === "hod" && (
              <HodStatsCollapsible
                programCount={hodProgramCount}
                courseCount={hodCourseCount}
                instructorCount={hodInstructorCount}
                selectedProgramId={programs[0]}
                selectedCourseId={courseIds[0]}
                programContent={
                  <HodProgramStats
                    user={user}
                    selectedProgramId={programs[0]}
                    masterFilterProgramIds={
                      programs.length ? programs : undefined
                    }
                  />
                }
                courseContent={
                  <HodCourseStats
                    user={user}
                    selectedProgramId={programs[0]}
                    selectedCourseId={courseIds[0]}
                  />
                }
                instructorContent={
                  <HodInstructorStats
                    user={user}
                    selectedProgramId={programs[0]}
                    selectedCourseId={courseIds[0]}
                    selectedInstructorId={instructorIds[0]}
                  />
                }
              />
            )}
            {user?.role === "teacher" && (
              <InstructorStatsCollapsible
                courseCount={instructorCourseCount}
                courseContent={
                  <InstructorCourseStats
                    user={user}
                    selectedCourseId={courseIds[0]}
                  />
                }
              />
            )}
          </div>
        </div>

        <EnrollmentDashboard
          user={user}
          masterFilter={masterFilter}
          filterOptionsFromServer={filterOptions}
          selectedAlert={selectedAlert}
          gpaFilters={gpaFilters}
          attendanceFilters={attendanceFilters}
          interventionFilters={interventionFilters}
          returnToUrl={returnToUrl}
          departmentIds={departmentIds}
          programIds={programs}
          instructorIds={instructorIds}
          viewMode={viewMode}
          expandedIds={expandedIds}
        />
      </DashboardFiltersStateProvider>
    </>
  );
}
