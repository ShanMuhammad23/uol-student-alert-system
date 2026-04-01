"use client";

import type { DeanStatsUser } from "@/lib/enrollment";
import type { CourseStats } from "../fetch";
import { cn } from "@/lib/utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedCourseId?: string;
  masterFilterCourseIds?: string[];
  stats?: CourseStats[] | null;
  onSelectCourseId?: (courseId: string) => void;
};

export function DeanCourseStats({
  user,
  selectedCourseId,
  masterFilterCourseIds,
  stats = null,
  onSelectCourseId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;
  const list = stats ?? [];
  if (!list.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((c) => {
        const key = c.courseId;
        const isSelected = masterFilterCourseIds?.length
          ? masterFilterCourseIds.includes(key)
          : selectedCourseId === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectCourseId?.(key)}
            className={cn(
              "inline-flex bg-white flex-col rounded-lg border px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
              "min-w-[160px]",
              isSelected
                ? "border-2 border-primary dark:border-primary"
                : "border-stroke",
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {c.courseName}{" "}
              <span className="text-body-base dark:text-dark-5">
                ({c.total})
              </span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
              Att:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  c.yellowAttendance > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.yellowAttendance}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  c.redAttendance > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.redAttendance}
              </span>
              {" · "}
              GPA:{" "}
              <span
                className={cn(
                  "text-amber-500 dark:text-amber-500 font-bold",
                  c.yellowGpa > 0
                    ? "text-amber-500 dark:text-amber-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.yellowGpa}
              </span>
              {" | "}
              <span
                className={cn(
                  "text-red-500 font-bold",
                  c.redGpa > 0
                    ? "text-red-500"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {c.redGpa}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

