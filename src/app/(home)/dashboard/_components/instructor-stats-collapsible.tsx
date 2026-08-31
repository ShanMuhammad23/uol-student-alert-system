"use client";

import type { ReactNode } from "react";
import { StatsCollapsibleSection } from "./stats-collapsible-section";

type Props = {
  courseContent: ReactNode;
  courseCount?: number;
};

export function InstructorStatsCollapsible({ courseContent, courseCount }: Props) {
  return (
    <div className="mt-4 pt-4">
      <StatsCollapsibleSection
        title="Courses"
        count={courseCount}
        defaultOpen={true}
        showMaximize={false}
      >
        {courseContent}
      </StatsCollapsibleSection>
    </div>
  );
}
