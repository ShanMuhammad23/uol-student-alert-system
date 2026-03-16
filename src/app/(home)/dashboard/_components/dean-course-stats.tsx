"use client";

import type { DeanStatsUser, EnrollmentRecord } from "@/lib/enrollment";
import { cn } from "@/lib/utils";

type PropsType = {
  user: DeanStatsUser | null;
  selectedCourseId?: string;
  /** When set, these courses are shown as selected (bordered) from MasterFilter. */
  masterFilterCourseIds?: string[];
  /** Filtered enrollment data used for grouping. */
  enrollmentData?: EnrollmentRecord[] | null;
  /** Optional callback to update filters client-side instead of navigating. */
  onSelectCourseId?: (courseId: string) => void;
};

export function DeanCourseStats({
  user,
  selectedCourseId,
  masterFilterCourseIds,
  enrollmentData = [],
  onSelectCourseId,
}: PropsType) {
  if (!user || user.role !== "dean") return null;

  const rows = enrollmentData ?? [];
  if (!rows.length) return null;

  const byCourse = new Map<
    string,
    { code: string; title: string; total: number }
  >();

  for (const r of rows) {
    const rawCode = (r.CrCode ?? "").toString().trim();
    const rawTitle = (r.CrTitle ?? "").toString().trim();
    const key = rawCode || rawTitle;
    if (!key) continue;
    if (!byCourse.has(key)) {
      byCourse.set(key, {
        code: rawCode || "—",
        title: rawTitle || rawCode || key,
        total: 0,
      });
    }
    const bucket = byCourse.get(key)!;
    bucket.total += 1;
  }

  const list = Array.from(byCourse.values()).sort((a, b) =>
    (a.code || a.title).localeCompare(b.code || b.title),
  );

  if (!list.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {list.map((c) => {
        const key = c.code || c.title;
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
              {c.code}{" "}
              <span className="text-body-base dark:text-dark-5">
                ({c.total})
              </span>
            </span>
            {c.title && c.title !== c.code && (
              <span className="text-body-xs text-dark-6 dark:text-dark-5">
                {c.title}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

