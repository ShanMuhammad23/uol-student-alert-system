import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OverviewCardsGroup } from "./_components/overview-cards";
import { OverviewCardsSkeleton } from "./_components/overview-cards/skeleton";
import { getCurrentUser, getMasterFilterOptions } from "./fetch";
import type { MasterFilterParams, AlertDimensionFilter } from "./fetch";
import { HodStatsCollapsible } from "./_components/hod-stats-collapsible";
import { HodProgramStats } from "./_components/hod-program-stats";
import { HodInstructorStats } from "./_components/hod-instructor-stats";
import { InterventionStatusChart } from "@/components/Charts/intervention-status-chart/chart";
import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import { getInterventionChartData, getWellbeingChartData } from "./fetch";
import { FilterScrollPreserve } from "./_components/FilterScrollPreserve";
import { EnrollmentDashboard } from "./_components/EnrollmentDashboard";
import { getHodProgramStats, getHodInstructorStats } from "./fetch";

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
  let hodInstructorCount = 0;
  if (user.role === "hod" && user.department_ids?.length) {
    const hodProgramStats = await getHodProgramStats(user.department_ids);
    hodProgramCount = hodProgramStats.length;
    const hodInstructorStats = await getHodInstructorStats(user.department_ids, {});
    hodInstructorCount = hodInstructorStats.length;
  }

  const filterOptions = await getMasterFilterOptions(user, masterFilter);
  const interventionChart = await getInterventionChartData(
    user,
    masterFilter,
    gpaFilters,
    attendanceFilters,
    interventionFilters,
  );
  const wellbeingChart = await getWellbeingChartData(
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
      {/* Row 1: Overview cards + Charts in one row */}
      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-1">
        <div className="col-span-12 md:col-span-4">
          <Suspense fallback={<OverviewCardsSkeleton />}>
            <OverviewCardsGroup
              selectedAlert={selectedAlert}
              user={user}
              masterFilter={masterFilter}
              gpaFilters={gpaFilters}
              attendanceFilters={attendanceFilters}
            />
          </Suspense>
        </div>
        <div className=" col-span-12 md:col-span-4">
      <InterventionStatusChart
            data={interventionChart.data}
            statusColors={interventionChart.statusColors}
            title="Outreach & Intervention"
          />
      </div>
        <div className="col-span-12 md:col-span-4 ">
          <StatusStackedChart
            title="Wellbeing Resolution"
            data={wellbeingChart}
          />
        </div>
      </div>
    
            <div className="mt-4 mb-4 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          {user?.role === "hod" && (
            <HodStatsCollapsible
              programCount={hodProgramCount}
              instructorCount={hodInstructorCount}
              selectedProgramId={programs[0]}
              programContent={
                <HodProgramStats
                  user={user}
                  selectedProgramId={programs[0]}
                  masterFilterProgramIds={programs.length ? programs : undefined}
                />
              }
              instructorContent={
                <HodInstructorStats
                  user={user}
                  selectedProgramId={programs[0]}
                  selectedInstructorId={instructorIds[0]}
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
    </>
  );
}
