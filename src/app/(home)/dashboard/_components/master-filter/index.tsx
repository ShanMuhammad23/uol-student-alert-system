"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";
import type { FilterDropdownCounts } from "@/lib/db/student-listing";
import { WELLBEING_RESOLUTION_OPTIONS } from "@/lib/wellbeing-resolution-options";
import { saveScrollBeforeFilterNav } from "@/app/(home)/dashboard/_components/FilterScrollPreserve";
import { useMergeDashboardHref } from "../useDashboardHref";
import type {
  MasterFilterParams,
  MasterFilterOptions,
  AlertDimensionFilter,
} from "../../fetch";

const GPA_ATTENDANCE_OPTIONS: { value: AlertDimensionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "red", label: "Red alert" },
  { value: "yellow", label: "Yellow alert" },
  { value: "good", label: "Good standing" },
];

const INTERVENTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not Started" },
  { value: "initiated", label: "Initiated" },
  { value: "in_progress", label: "In-Progress" },
  { value: "referred", label: "Referred" },
  { value: "resolved", label: "Resolved" },
  { value: "no_action_required", label: "No Action Required" },
];

const WELLBEING_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...WELLBEING_RESOLUTION_OPTIONS.map(({ value, label }) => ({ value, label })),
];

function normalizeDimFiltersForApi(
  filters: AlertDimensionFilter[] | undefined
): AlertDimensionFilter[] | undefined {
  if (!filters?.length) return undefined;
  if (filters.includes("all")) return undefined;
  return filters;
}

function labelWithOptionalCount(label: string, count: number | undefined) {
  if (count === undefined) return label;
  return `${label} (${count.toLocaleString()})`;
}
type PropsType = {
  options: MasterFilterOptions;
  current: MasterFilterParams;
  role: "dean" | "hod" | "teacher" | undefined;
  selectedAlert: string;
  gpaFilters: AlertDimensionFilter[];
  attendanceFilters: AlertDimensionFilter[];
  interventionFilters: string[];
  resolutionFilters: string[];
  interventionStatusFilters: string[];
  className?: string;
  onChangeMasterFilter?: (updates: Partial<MasterFilterParams>) => void;
  onChangeGpaFilters?: (values: AlertDimensionFilter[]) => void;
  onChangeAttendanceFilters?: (values: AlertDimensionFilter[]) => void;
  onChangeInterventionFilters?: (values: string[]) => void;
  onChangeResolutionFilters?: (values: string[]) => void;
};

type FilterKey =
  | "department"
  | "program"
  | "course"
  | "instructor"
  | "attendance"
  | "gpa"
  | "intervention"
  | "wellbeing";

function FilterMultiSelect({
  label,
  selected,
  items,
  onChange,
  isOpen,
  onOpenChange,
  "data-testid": testId,
}: {
  label: string;
  selected: string[];
  items: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  isOpen: boolean;
  onOpenChange: () => void;
  "data-testid"?: string;
}) {
  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const handleSelectAll = () => {
    const allValues = items.map((i) => i.value);
    onChange(allValues);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayLabel =
    selected.length === 0
      ? "All"
      : selected.length <= 2
        ? selected.map((v) => items.find((i) => i.value === v)?.label ?? v).join(", ")
        : `${selected.length} selected`;

  const totalOptions = items.length;
  const selectedCount = selected.length;
  const labelWithCount = `${label} (${selectedCount}/${totalOptions})`;

  return (
    <div className="flex flex-col gap-1.5 relative mb-8" data-testid={testId}>
      <label className="text-body-sm font-medium text-dark dark:text-white">
        {labelWithCount}
      </label>
      <button
        type="button"
        onClick={onOpenChange}
        className={cn(
          "rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-left outline-none transition flex items-center justify-between gap-2",
          "focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:focus:border-primary dark:text-white",
          "min-w-[140px] max-w-[200px]"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={cn("w-4 h-4 shrink-0 transition", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-full min-w-[200px] overflow-y-auto rounded-lg border border-stroke bg-white py-1 shadow-lg dark:border-stroke-dark dark:bg-gray-dark"
        >
          <div className="flex items-center justify-end px-3 pb-1 text-[11px] text-dark-6 dark:text-dark-5">
            
            <button
              type="button"
              className="underline hover:text-primary"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          </div>
          {items.map((item, itemIdx) => (
            <label
              key={`${item.value}-${itemIdx}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-gray-2 dark:hover:bg-dark-3",
                selected.includes(item.value) && "bg-primary/10 dark:bg-primary/20"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.value)}
                onChange={() => toggle(item.value)}
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

export function MasterFilter({
  options,
  current,
  role,
  selectedAlert,
  gpaFilters,
  attendanceFilters,
  interventionFilters,
  resolutionFilters,
  className,
  onChangeMasterFilter,
  onChangeGpaFilters,
  onChangeAttendanceFilters,
  onChangeInterventionFilters,
  onChangeResolutionFilters,
}: PropsType) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [dropdownCounts, setDropdownCounts] = useState<FilterDropdownCounts | null>(null);
  const router = useRouter();
  const mergeHref = useMergeDashboardHref();
  const filterPanelRef = useClickOutside<HTMLDivElement>(() => setOpenFilter(null));

  useEffect(() => {
    const controller = new AbortController();
    const filters = {
      department_ids: current.department_ids,
      programs: current.programs,
      instructor_ids: current.instructor_ids,
      course_ids: current.course_ids,
      attendanceFilters: normalizeDimFiltersForApi(attendanceFilters),
      gpaFilters: normalizeDimFiltersForApi(gpaFilters),
      interventionFilters:
        interventionFilters?.length && !interventionFilters.includes("all")
          ? interventionFilters.filter((v) => v !== "all")
          : undefined,
      resolutionFilters:
        resolutionFilters?.length && !resolutionFilters.includes("all")
          ? resolutionFilters.filter((v) => v !== "all")
          : undefined,
    };
    fetch("/api/dashboard/filter-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ filters }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("counts"))))
      .then((body: FilterDropdownCounts) => {
        if (!controller.signal.aborted) setDropdownCounts(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDropdownCounts(null);
      });
    return () => controller.abort();
  }, [
    current.department_ids?.join(","),
    current.programs?.join(","),
    current.instructor_ids?.join(","),
    current.course_ids?.join(","),
    attendanceFilters?.join(","),
    gpaFilters?.join(","),
    interventionFilters?.join(","),
    resolutionFilters?.join(","),
  ]);

  const gpaItemsWithCounts = useMemo(() => {
    if (!dropdownCounts) return GPA_ATTENDANCE_OPTIONS;
    const c = dropdownCounts.gpa;
    return GPA_ATTENDANCE_OPTIONS.map((o) => ({
      value: o.value,
      label: labelWithOptionalCount(
        o.label,
        o.value === "all"
          ? c.all
          : o.value === "red"
            ? c.red
            : o.value === "yellow"
              ? c.yellow
              : o.value === "good"
                ? c.good
                : undefined
      ),
    }));
  }, [dropdownCounts]);

  const attendanceItemsWithCounts = useMemo(() => {
    if (!dropdownCounts) return GPA_ATTENDANCE_OPTIONS;
    const c = dropdownCounts.attendance;
    return GPA_ATTENDANCE_OPTIONS.map((o) => ({
      value: o.value,
      label: labelWithOptionalCount(
        o.label,
        o.value === "all"
          ? c.all
          : o.value === "red"
            ? c.red
            : o.value === "yellow"
              ? c.yellow
              : o.value === "good"
                ? c.good
                : undefined
      ),
    }));
  }, [dropdownCounts]);

  const interventionItemsWithCounts = useMemo(() => {
    if (!dropdownCounts) return INTERVENTION_STATUS_OPTIONS;
    const c = dropdownCounts.intervention;
    return INTERVENTION_STATUS_OPTIONS.map((o) => {
      const n =
        o.value === "all"
          ? c.all
          : o.value === "not_started"
            ? c.not_started
            : o.value === "initiated"
              ? c.initiated
              : o.value === "in_progress"
                ? c.in_progress
                : o.value === "referred"
                  ? c.referred
                  : o.value === "resolved"
                    ? c.resolved
                    : o.value === "no_action_required"
                      ? c.no_action_required
                      : undefined;
      return { value: o.value, label: labelWithOptionalCount(o.label, n) };
    });
  }, [dropdownCounts]);

  const wellbeingItemsWithCounts = useMemo(() => {
    if (!dropdownCounts) return WELLBEING_FILTER_OPTIONS;
    return WELLBEING_FILTER_OPTIONS.map((o) => {
      if (o.value === "all") {
        return {
          value: o.value,
          label: labelWithOptionalCount(o.label, dropdownCounts.wellbeingAll),
        };
      }
      const idx = WELLBEING_RESOLUTION_OPTIONS.findIndex((x) => x.value === o.value);
      const n = idx >= 0 ? dropdownCounts.wellbeing[idx] : undefined;
      return { value: o.value, label: labelWithOptionalCount(o.label, n) };
    });
  }, [dropdownCounts]);
  const handleDepartment = (values: string[]) => {
    onChangeMasterFilter?.({
      department_ids: values.length ? values : undefined,
      programs: undefined,
      course_ids: undefined,
      instructor_ids: undefined,
    });
  };

  const handleProgram = (values: string[]) => {
    onChangeMasterFilter?.({
      programs: values.length ? values : undefined,
      course_ids: undefined,
      instructor_ids: undefined,
    });
  };

  const handleCourse = (values: string[]) => {
    onChangeMasterFilter?.({
      course_ids: values.length ? values : undefined,
      instructor_ids: undefined,
    });
  };

  const handleInstructor = (values: string[]) => {
    onChangeMasterFilter?.({
      instructor_ids: values.length ? values : undefined,
    });
  };

  const handleGpaFilters = (values: string[]) => {
    onChangeGpaFilters?.(values as AlertDimensionFilter[]);
  };

  const handleAttendanceFilters = (values: string[]) => {
    onChangeAttendanceFilters?.(values as AlertDimensionFilter[]);
  };

  const handleInterventionFilters = (values: string[]) => {
    onChangeInterventionFilters?.(values);
  };

  const handleResolutionFilters = (values: string[]) => {
    onChangeResolutionFilters?.(values);
  };

  if (!role) return null;

  const showDepartment = role === "dean" || role === "hod";
  const showProgram = role === "dean" || role === "hod";
  const showInstructor = role === "dean" || role === "hod";
  const showCourse = true;

  const hasActiveFilter =
    (current.department_ids?.length ?? 0) > 0 ||
    (current.programs?.length ?? 0) > 0 ||
    (current.instructor_ids?.length ?? 0) > 0 ||
    (current.course_ids?.length ?? 0) > 0 ||
    (gpaFilters?.length ?? 0) > 0 ||
    (attendanceFilters?.length ?? 0) > 0 ||
    (interventionFilters?.length ?? 0) > 0 ||
    (resolutionFilters?.length ?? 0) > 0;

  const handleClearAll = () => {
    onChangeMasterFilter?.({
      department_ids: undefined,
      programs: undefined,
      instructor_ids: undefined,
      course_ids: undefined,
    });
    onChangeGpaFilters?.([]);
    onChangeAttendanceFilters?.([]);
    onChangeInterventionFilters?.([]);
    onChangeResolutionFilters?.([]);

    // Also clear URL params so server-rendered counts/charts update.
    // Keep unrelated params (like `selected_alert`, `view`, `expanded`) intact.
    saveScrollBeforeFilterNav();
    const href = mergeHref({
      department: null,
      program: null,
      instructor: null,
      course: null,
      gpa_filter: null,
      attendance_filter: null,
      intervention_filter: null,
      resolution_filter: null,
    });
    router.replace(href, { scroll: false });
  };

  const toggleFilter = (key: FilterKey) => () =>
    setOpenFilter((prev) => (prev === key ? null : key));

  return (
    <div
      ref={filterPanelRef}
      className={cn(
        "relative flex flex-wrap items-end gap-4 rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      

      {showDepartment && options.departments.length > 0 && (
        <FilterMultiSelect
          label="Department"
          selected={current.department_ids ?? []}
          items={options.departments}
          onChange={handleDepartment}
          isOpen={openFilter === "department"}
          onOpenChange={toggleFilter("department")}
          data-testid="filter-department"
        />
      )}
      {showProgram && options.programs.length > 0 && (
        <FilterMultiSelect
          label="Program"
          selected={current.programs ?? []}
          items={options.programs}
          onChange={handleProgram}
          isOpen={openFilter === "program"}
          onOpenChange={toggleFilter("program")}
          data-testid="filter-program"
        />
      )}
      {showCourse && options.courses.length > 0 && (
        <FilterMultiSelect
          label="Course"
          selected={current.course_ids ?? []}
          items={options.courses}
          onChange={handleCourse}
          isOpen={openFilter === "course"}
          onOpenChange={toggleFilter("course")}
          data-testid="filter-course"
        />
      )}
      {showInstructor && options.instructors.length > 0 && (
        <FilterMultiSelect
          label="Instructor"
          selected={current.instructor_ids ?? []}
          items={options.instructors}
          onChange={handleInstructor}
          isOpen={openFilter === "instructor"}
          onOpenChange={toggleFilter("instructor")}
          data-testid="filter-instructor"
        />
      )}

      <FilterMultiSelect
        label="Attendance"
        selected={attendanceFilters ?? []}
        items={attendanceItemsWithCounts}
        onChange={handleAttendanceFilters}
        isOpen={openFilter === "attendance"}
        onOpenChange={toggleFilter("attendance")}
        data-testid="filter-attendance"
      />
      <FilterMultiSelect
        label="GPA"
        selected={gpaFilters ?? []}
        items={gpaItemsWithCounts}
        onChange={handleGpaFilters}
        isOpen={openFilter === "gpa"}
        onOpenChange={toggleFilter("gpa")}
        data-testid="filter-gpa"
      />
      <FilterMultiSelect
        label="Intervention"
        selected={interventionFilters ?? []}
        items={interventionItemsWithCounts}
        onChange={handleInterventionFilters}
        isOpen={openFilter === "intervention"}
        onOpenChange={toggleFilter("intervention")}
        data-testid="filter-intervention"
      />
      <FilterMultiSelect
        label="Wellbeing"
        selected={resolutionFilters ?? []}
        items={wellbeingItemsWithCounts}
        onChange={handleResolutionFilters}
        isOpen={openFilter === "wellbeing"}
        onOpenChange={toggleFilter("wellbeing")}
        data-testid="filter-wellbeing"
      />

      <button
        type="button"
        onClick={handleClearAll}
        disabled={!hasActiveFilter}
        className={cn(
          "fixed right-4 top-1/2 z-50 -translate-y-1/2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-lg outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-primary",
          hasActiveFilter
            ? "border-stroke bg-red-600 text-white hover:bg-red-700 dark:border-dark-3 dark:bg-red-600 dark:hover:bg-red-700"
            : "cursor-not-allowed border-stroke/50 bg-red-600/60 text-white/80 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-5"
        )}
      >
        Clear All
      </button>
    </div>
  );
}
