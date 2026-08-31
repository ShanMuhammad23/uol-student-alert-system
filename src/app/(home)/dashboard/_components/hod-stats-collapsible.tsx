"use client";

import type { ReactNode } from "react";
import { StatsCollapsibleSection } from "./stats-collapsible-section";

type HodStatsCollapsibleProps = {
  programContent: ReactNode;
  courseContent: ReactNode;
  instructorContent: ReactNode;
  /** When set, Instructors section is open by default. */
  selectedProgramId?: string;
  selectedCourseId?: string;
  programCount?: number;
  courseCount?: number;
  instructorCount?: number;
  instructorTrainedCount?: number;
  instructorNeedTrainingCount?: number;
};

export function HodStatsCollapsible({
  programContent,
  courseContent,
  instructorContent,
  selectedProgramId,
  selectedCourseId,
  programCount,
  courseCount,
  instructorCount,
  instructorTrainedCount,
  instructorNeedTrainingCount,
}: HodStatsCollapsibleProps) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
      <StatsCollapsibleSection
        title="Program"
        count={programCount}
        defaultOpen={true}
      >
        {programContent}
      </StatsCollapsibleSection>
      <StatsCollapsibleSection
        title="Course"
        count={courseCount}
        defaultOpen={!!selectedProgramId}
      >
        {courseContent}
      </StatsCollapsibleSection>
      <StatsCollapsibleSection
        title="Instructors"
        count={instructorCount}
        trainedCount={instructorTrainedCount}
        needTrainingCount={instructorNeedTrainingCount}
        defaultOpen={!!selectedProgramId || !!selectedCourseId}
      >
        {instructorContent}
      </StatsCollapsibleSection>
    </div>
  );
}
