"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterDropdownCounts } from "@/lib/db/student-listing";
import type { MasterFilterOptions, MasterFilterParams } from "@/app/(home)/dashboard/fetch";
import { WELLBEING_RESOLUTION_OPTIONS } from "@/lib/wellbeing-resolution-options";

type Props = {
  options: MasterFilterOptions;
  current: MasterFilterParams;
  resolutionFilters: string[];
  asWellbeingScope?: boolean;
  onChangeMasterFilter: (updates: Partial<MasterFilterParams>) => void;
  onChangeResolutionFilters: (values: string[]) => void;
};

type FilterKey = "department" | "program" | "course" | "instructor" | "wellbeing";

function labelWithOptionalCount(label: string, count: number | undefined) {
  if (count == null) return label;
  return `${label} (${count.toLocaleString()})`;
}

function stripTrailingCount(label: string): string {
  // Remove trailing count suffixes like "(12)", "(12 students)", "(1,245 std)".
  return String(label).replace(/\s*\([^)]*\d[^)]*\)\s*$/, "").trim();
}

function FilterMultiSelect({
  label,
  selected,
  items,
  isOpen,
  onOpenChange,
  onChange,
}: {
  label: string;
  selected: string[];
  items: { value: string; label: string }[];
  isOpen: boolean;
  onOpenChange: () => void;
  onChange: (values: string[]) => void;
}) {
  const displayLabel =
    selected.length === 0
      ? "Any"
      : selected.length <= 2
        ? selected.map((v) => items.find((i) => i.value === v)?.label ?? v).join(", ")
        : `${selected.length} selected`;

  return (
    <div className="relative mb-6 flex flex-col gap-1.5">
      <label className="text-body-sm font-medium text-dark dark:text-white">
        {label}
      </label>
      <button
        type="button"
        onClick={onOpenChange}
        className="min-w-[150px] rounded-lg border border-stroke bg-white px-3 py-2.5 text-left text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      >
        <span className="truncate">{displayLabel}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] min-w-[220px] overflow-y-auto rounded-lg border border-stroke bg-white py-1 shadow-lg dark:border-stroke-dark dark:bg-gray-dark">
          <div className="flex justify-end px-3 pb-1 text-[11px] text-dark-6 dark:text-dark-5">
            <button type="button" className="underline hover:text-primary" onClick={() => onChange([])}>
              Clear all
            </button>
          </div>
          {items.map((item, idx) => (
            <label
              key={`${item.value}-${idx}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-2 dark:hover:bg-dark-3",
                selected.includes(item.value) && "bg-primary/10 dark:bg-primary/20"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.value)}
                onChange={() =>
                  onChange(
                    selected.includes(item.value)
                      ? selected.filter((v) => v !== item.value)
                      : [...selected, item.value]
                  )
                }
                className="rounded border-stroke text-primary focus:ring-primary dark:border-dark-3 dark:bg-gray-dark"
              />
              <span className="text-dark dark:text-white">{item.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function WellbeingMasterFilter({
  options,
  current,
  resolutionFilters,
  asWellbeingScope = false,
  onChangeMasterFilter,
  onChangeResolutionFilters,
}: Props) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [counts, setCounts] = useState<FilterDropdownCounts | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/filter-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        filters: {
          department_ids: current.department_ids,
          programs: current.programs,
          instructor_ids: current.instructor_ids,
          course_ids: current.course_ids,
          resolutionFilters: resolutionFilters.length ? resolutionFilters : undefined,
        },
        ...(asWellbeingScope ? { roleScope: { role: "wellbeing" as const } } : {}),
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("counts"))))
      .then((body: FilterDropdownCounts) => {
        if (!controller.signal.aborted) setCounts(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCounts(null);
      });
    return () => controller.abort();
  }, [
    current.department_ids?.join(","),
    current.programs?.join(","),
    current.instructor_ids?.join(","),
    current.course_ids?.join(","),
    resolutionFilters.join(","),
  ]);

  const wellbeingItems = useMemo(() => {
    return WELLBEING_RESOLUTION_OPTIONS.map((o, idx) => ({
      value: o.value,
      label: labelWithOptionalCount(o.label, counts?.wellbeing[idx]),
    }));
  }, [counts]);

  const departmentItems = useMemo(
    () =>
      options.departments.map((o) => ({
        value: o.value,
        label: stripTrailingCount(o.label),
      })),
    [options.departments]
  );
  const programItems = useMemo(
    () =>
      options.programs.map((o) => ({
        value: o.value,
        label: stripTrailingCount(o.label),
      })),
    [options.programs]
  );
  const courseItems = useMemo(
    () =>
      options.courses.map((o) => ({
        value: o.value,
        label: stripTrailingCount(o.label),
      })),
    [options.courses]
  );
  const instructorItems = useMemo(
    () =>
      options.instructors.map((o) => ({
        value: o.value,
        label: stripTrailingCount(o.label),
      })),
    [options.instructors]
  );

  const clearAll = () => {
    onChangeMasterFilter({
      department_ids: undefined,
      programs: undefined,
      course_ids: undefined,
      instructor_ids: undefined,
    });
    onChangeResolutionFilters([]);
  };

  return (
    <div className="relative flex flex-wrap items-end gap-4 rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card">
      {options.departments.length > 0 && (
        <FilterMultiSelect
          label="Department"
          selected={current.department_ids ?? []}
          items={departmentItems}
          isOpen={openFilter === "department"}
          onOpenChange={() => setOpenFilter(openFilter === "department" ? null : "department")}
          onChange={(values) =>
            onChangeMasterFilter({
              department_ids: values.length ? values : undefined,
              programs: undefined,
              course_ids: undefined,
              instructor_ids: undefined,
            })
          }
        />
      )}
      {options.programs.length > 0 && (
        <FilterMultiSelect
          label="Program"
          selected={current.programs ?? []}
          items={programItems}
          isOpen={openFilter === "program"}
          onOpenChange={() => setOpenFilter(openFilter === "program" ? null : "program")}
          onChange={(values) =>
            onChangeMasterFilter({
              programs: values.length ? values : undefined,
              course_ids: undefined,
              instructor_ids: undefined,
            })
          }
        />
      )}
      {options.courses.length > 0 && (
        <FilterMultiSelect
          label="Course"
          selected={current.course_ids ?? []}
          items={courseItems}
          isOpen={openFilter === "course"}
          onOpenChange={() => setOpenFilter(openFilter === "course" ? null : "course")}
          onChange={(values) =>
            onChangeMasterFilter({
              course_ids: values.length ? values : undefined,
              instructor_ids: undefined,
            })
          }
        />
      )}
      {options.instructors.length > 0 && (
        <FilterMultiSelect
          label="Instructor"
          selected={current.instructor_ids ?? []}
          items={instructorItems}
          isOpen={openFilter === "instructor"}
          onOpenChange={() => setOpenFilter(openFilter === "instructor" ? null : "instructor")}
          onChange={(values) =>
            onChangeMasterFilter({
              instructor_ids: values.length ? values : undefined,
            })
          }
        />
      )}
      <FilterMultiSelect
        label="Wellbeing"
        selected={resolutionFilters}
        items={wellbeingItems}
        isOpen={openFilter === "wellbeing"}
        onOpenChange={() => setOpenFilter(openFilter === "wellbeing" ? null : "wellbeing")}
        onChange={onChangeResolutionFilters}
      />
      <button
        type="button"
        onClick={clearAll}
        className="fixed right-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-stroke bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-red-700 dark:border-dark-3"
      >
        Clear All
      </button>
    </div>
  );
}
