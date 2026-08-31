"use client";

import type { ReactNode } from "react";
import { StatsCollapsibleSection } from "./stats-collapsible-section";

type DeanStatsCollapsibleProps = {
  departmentContent: ReactNode;
  programContent: ReactNode;
  instructorContent: ReactNode;
  courseContent: ReactNode;
  /** When set, Instructors section is open by default so instructors for the selected department auto-appear. */
  selectedDepartmentId?: string;
  /** When set, Instructors section is also opened when a program is selected. */
  selectedProgramId?: string;
  departmentCount?: number;
  programCount?: number;
  instructorCount?: number;
  instructorTrainedCount?: number;
  instructorNeedTrainingCount?: number;
  courseCount?: number;
  onClearDepartmentFilters?: () => void;
  onClearProgramFilters?: () => void;
  onClearInstructorFilters?: () => void;
  onClearCourseFilters?: () => void;
  hasDepartmentFilters?: boolean;
  hasProgramFilters?: boolean;
  hasInstructorFilters?: boolean;
  hasCourseFilters?: boolean;
};

export function DeanStatsCollapsible({
  departmentContent,
  programContent,
  instructorContent,
  courseContent,
  selectedDepartmentId,
  selectedProgramId,
  departmentCount,
  programCount,
  instructorCount,
  instructorTrainedCount,
  instructorNeedTrainingCount,
  courseCount,
  onClearDepartmentFilters,
  onClearProgramFilters,
  onClearInstructorFilters,
  onClearCourseFilters,
  hasDepartmentFilters,
  hasProgramFilters,
  hasInstructorFilters,
  hasCourseFilters,
}: DeanStatsCollapsibleProps) {
  return (
    <div className="overflow-hidden border border-stroke dark:border-stroke-dark">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <StatsCollapsibleSection
          title="Department"
          count={departmentCount}
          defaultOpen={true}
          onClear={onClearDepartmentFilters}
          hasActiveFilters={hasDepartmentFilters}
          contentClassName="px-1"
        >
          {departmentContent}
        </StatsCollapsibleSection>
        <StatsCollapsibleSection
          title="Program"
          count={programCount}
          defaultOpen={true}
          onClear={onClearProgramFilters}
          hasActiveFilters={hasProgramFilters}
          contentClassName="px-1"
        >
          {programContent}
        </StatsCollapsibleSection>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <StatsCollapsibleSection
          title="Course"
          count={courseCount}
          defaultOpen={false}
          onClear={onClearCourseFilters}
          hasActiveFilters={hasCourseFilters}
          contentClassName="px-1"
        >
          {courseContent}
        </StatsCollapsibleSection>
        <StatsCollapsibleSection
          title="Instructor"
          count={instructorCount}
          trainedCount={instructorTrainedCount}
          needTrainingCount={instructorNeedTrainingCount}
          defaultOpen={!!selectedDepartmentId || !!selectedProgramId}
          onClear={onClearInstructorFilters}
          hasActiveFilters={hasInstructorFilters}
          contentClassName="px-1"
        >
          {instructorContent}
        </StatsCollapsibleSection>
      </div>
    </div>
  );
}
