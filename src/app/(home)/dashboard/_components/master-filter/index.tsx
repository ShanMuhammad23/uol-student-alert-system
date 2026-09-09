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
import { useSession } from "next-auth/react";
import { parseAcademicTermKey } from "@/lib/academic-term";

const GPA_ATTENDANCE_OPTIONS: { value: AlertDimensionFilter; label: string }[] = [
  { value: "red", label: "Red alert" },
  { value: "yellow", label: "Yellow alert" },
  { value: "good", label: "Good standing" },
];

const INTERVENTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "initiated", label: "Initiated" },
  { value: "in_progress", label: "In-Progress" },
  { value: "referred", label: "Referred" },
  { value: "resolved", label: "Resolved" },
  { value: "no_action_required", label: "No Action Required" },
];

const WELLBEING_FILTER_OPTIONS: { value: string; label: string }[] =
  WELLBEING_RESOLUTION_OPTIONS.map(({ value, label }) => ({ value, label }));

const CLASS_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attendance_missing", label: "Attendance Missing" },
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
/** Passed when session is superadmin but the dashboard emulates another role (e.g. ?as=dean&faculty=). */
export type FilterApiRoleScope = {
  role: "dean" | "hod" | "teacher";
  facultyId?: string | null;
  departmentIds?: string[] | null;
  pernr?: string | null;
};

type PropsType = {
  options: MasterFilterOptions;
  current: MasterFilterParams;
  role: "dean" | "hod" | "teacher" | undefined;
  selectedAlert: string;
  gpaFilters: AlertDimensionFilter[];
  attendanceFilters: AlertDimensionFilter[];
  interventionFilters: string[];
  classStatusFilters: string[];
  resolutionFilters: string[];
  interventionStatusFilters: string[];
  /** Scope dropdown counts to emulated dean/hod/instructor when superadmin previews a dashboard. */
  filterApiRoleScope?: FilterApiRoleScope | null;
  className?: string;
  onChangeMasterFilter?: (updates: Partial<MasterFilterParams>) => void;
  onChangeGpaFilters?: (values: AlertDimensionFilter[]) => void;
  onChangeAttendanceFilters?: (values: AlertDimensionFilter[]) => void;
  onChangeInterventionFilters?: (values: string[]) => void;
  onChangeClassStatusFilters?: (values: string[]) => void;
  onChangeResolutionFilters?: (values: string[]) => void;
};

type FilterKey =
  | "department"
  | "program"
  | "course"
  | "instructor"
  | "batch"
  | "semester"
  | "attendance"
  | "gpa"
  | "intervention"
  | "classStatus"
  | "wellbeing";

function FilterSingleSelect({
  label,
  selected,
  items,
  onChange,
  isOpen,
  onOpenChange,
  emptyLabel = "Current semester",
  loading = false,
  "data-testid": testId,
}: {
  label: string;
  selected: string | undefined;
  items: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  isOpen: boolean;
  onOpenChange: () => void;
  emptyLabel?: string;
  loading?: boolean;
  "data-testid"?: string;
}) {
  const displayLabel = selected
    ? items.find((i) => i.value === selected)?.label ?? selected
    : emptyLabel;

  return (
    <div className="relative mb-8 flex flex-col gap-1.5" data-testid={testId}>
      <label className="text-body-sm font-medium text-dark dark:text-white">
        {label}
      </label>
      <button
        type="button"
        onClick={onOpenChange}
        className={cn(
          "flex min-w-[140px] max-w-[220px] items-center justify-between gap-2 rounded-lg border border-stroke bg-white px-3 py-2.5 text-left text-sm outline-none transition",
          "focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{loading ? "Loading…" : displayLabel}</span>
        <svg
          className={cn("h-4 w-4 shrink-0 transition", isOpen && "rotate-180")}
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
          <button
            type="button"
            className={cn(
              "w-full px-3 py-2 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3",
              !selected && "bg-primary/10 dark:bg-primary/20"
            )}
            onClick={() => {
              onChange(undefined);
              onOpenChange();
            }}
          >
            <span className="text-dark dark:text-white">{emptyLabel}</span>
          </button>
          {items.map((item, itemIdx) => (
            <button
              key={`${item.value}-${itemIdx}`}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3",
                selected === item.value && "bg-primary/10 dark:bg-primary/20"
              )}
              onClick={() => {
                onChange(item.value);
                onOpenChange();
              }}
            >
              <span className="text-dark dark:text-white">{item.label}</span>
            </button>
          ))}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-dark-6 dark:text-white">
              No semesters found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterMultiSelect({
  label,
  selected,
  items,
  onChange,
  isOpen,
  onOpenChange,
  searchable = false,
  "data-testid": testId,
}: {
  label: string;
  selected: string[];
  items: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  isOpen: boolean;
  onOpenChange: () => void;
  searchable?: boolean;
  "data-testid"?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
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
      ? "Any"
      : selected.length <= 2
        ? selected.map((v) => items.find((i) => i.value === v)?.label ?? v).join(", ")
        : `${selected.length} selected`;

  const totalOptions = items.length;
  const selectedCount = selected.length;
  const labelWithCount = `${label} (${selectedCount}/${totalOptions})`;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!searchable || !normalizedSearch) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(normalizedSearch)
    );
  }, [items, normalizedSearch, searchable]);

  useEffect(() => {
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

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
          {searchable && (
            <div className="px-3 pb-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full rounded-md border border-stroke bg-white px-2.5 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
          )}
          <div className="flex items-center justify-end px-3 pb-1 text-[11px] text-dark-6 dark:text-white">
            
            <button
              type="button"
              className="underline hover:text-primary"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          </div>
          {filteredItems.map((item, itemIdx) => (
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
          {filteredItems.length === 0 && (
            <div className="px-3 py-2 text-xs text-dark-6 dark:text-white">
              No options found.
            </div>
          )}
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
  classStatusFilters,
  resolutionFilters,
  className,
  onChangeMasterFilter,
  onChangeGpaFilters,
  onChangeAttendanceFilters,
  onChangeInterventionFilters,
  onChangeClassStatusFilters,
  onChangeResolutionFilters,
  filterApiRoleScope,
}: PropsType) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [dropdownCounts, setDropdownCounts] = useState<FilterDropdownCounts | null>(null);
  const [semesterOptions, setSemesterOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [currentSemester, setCurrentSemester] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [semestersLoading, setSemestersLoading] = useState(false);
  const router = useRouter();
  const mergeHref = useMergeDashboardHref();
  const filterPanelRef = useClickOutside<HTMLDivElement>(() => setOpenFilter(null));
  const session = useSession();

  useEffect(() => {
    const controller = new AbortController();
    setSemestersLoading(true);
    const params = new URLSearchParams();
    if (filterApiRoleScope?.role) {
      params.set("role", filterApiRoleScope.role);
      if (filterApiRoleScope.facultyId) {
        params.set("facultyId", filterApiRoleScope.facultyId);
      }
      if (filterApiRoleScope.departmentIds?.length) {
        params.set("departmentIds", filterApiRoleScope.departmentIds.join(","));
      }
      if (filterApiRoleScope.pernr) {
        params.set("pernr", filterApiRoleScope.pernr);
      }
    }
    const qs = params.toString();
    fetch(`/api/dashboard/semesters${qs ? `?${qs}` : ""}`, {
      signal: controller.signal,
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("semesters"))
      )
      .then(
        (body: {
          semesters?: { value: string; label: string }[];
          current?: { value: string; label: string } | null;
        }) => {
          if (controller.signal.aborted) return;
          setSemesterOptions(Array.isArray(body.semesters) ? body.semesters : []);
          setCurrentSemester(
            body.current?.value && body.current?.label
              ? { value: body.current.value, label: body.current.label }
              : null
          );
        }
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setSemesterOptions([]);
          setCurrentSemester(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSemestersLoading(false);
      });
    return () => controller.abort();
  }, [
    filterApiRoleScope?.role,
    filterApiRoleScope?.facultyId,
    filterApiRoleScope?.departmentIds?.join(","),
    filterApiRoleScope?.pernr,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const filters = {
      department_ids: current.department_ids,
      programs: current.programs,
      instructor_ids: current.instructor_ids,
      course_ids: current.course_ids,
      batches: current.batches,
      semester: current.semester,
      selected_alert:
        selectedAlert && selectedAlert !== "all" ? selectedAlert : undefined,
      attendanceFilters: normalizeDimFiltersForApi(attendanceFilters),
      gpaFilters: normalizeDimFiltersForApi(gpaFilters),
      interventionFilters:
        interventionFilters?.length
          ? interventionFilters.filter((v) => v !== "all")
          : undefined,
      classStatusFilters:
        classStatusFilters?.length && !classStatusFilters.includes("all")
          ? classStatusFilters.filter((v) => v !== "all")
          : undefined,
      resolutionFilters:
        resolutionFilters?.length
          ? resolutionFilters.filter((v) => v !== "all")
          : undefined,
    };
    fetch("/api/dashboard/filter-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        filters,
        ...(filterApiRoleScope ? { roleScope: filterApiRoleScope } : {}),
      }),
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
    current.batches?.join(","),
    current.semester,
    selectedAlert,
    attendanceFilters?.join(","),
    gpaFilters?.join(","),
    interventionFilters?.join(","),
    classStatusFilters?.join(","),
    resolutionFilters?.join(","),
    filterApiRoleScope?.role,
    filterApiRoleScope?.facultyId,
    filterApiRoleScope?.departmentIds?.join(","),
    filterApiRoleScope?.pernr,
  ]);

  const gpaItemsWithCounts = useMemo(() => {
    if (!dropdownCounts) return GPA_ATTENDANCE_OPTIONS;
    const c = dropdownCounts.gpa;
    return GPA_ATTENDANCE_OPTIONS.map((o) => ({
      value: o.value,
      label: labelWithOptionalCount(
        o.label,
        o.value === "red"
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
        o.value === "red"
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
        o.value === "not_started"
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

  const handleBatch = (values: string[]) => {
    onChangeMasterFilter?.({
      batches: values.length ? values : undefined,
    });
  };

  const handleSemester = (value: string | undefined) => {
    // Selecting the configured current term is the same as default current semester.
    if (!value || (currentSemester && value === currentSemester.value)) {
      onChangeMasterFilter?.({ semester: undefined });
      return;
    }
    onChangeMasterFilter?.({
      semester: value,
    });
  };

  const semesterEmptyLabel = currentSemester
    ? `${currentSemester.label} (current)`
    : "Current semester";
  const selectedSemester =
    current.semester &&
    current.semester !== currentSemester?.value &&
    parseAcademicTermKey(current.semester)
      ? current.semester
      : undefined;

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

  const handleClassStatusFilters = (values: string[]) => {
    onChangeClassStatusFilters?.(values);
  };

  if (!role) return null;

  const showDepartment = role === "dean" || role === "hod" || role === "teacher";
  const showProgram = role === "dean" || role === "hod" || role === "teacher";
  const showInstructor = role === "dean" || role === "hod";
  const showCourse = true;

  const hasActiveFilter =
    (current.department_ids?.length ?? 0) > 0 ||
    (current.programs?.length ?? 0) > 0 ||
    (current.instructor_ids?.length ?? 0) > 0 ||
    (current.course_ids?.length ?? 0) > 0 ||
    (current.batches?.length ?? 0) > 0 ||
    Boolean(current.semester) ||
    (gpaFilters?.length ?? 0) > 0 ||
    (attendanceFilters?.length ?? 0) > 0 ||
    (classStatusFilters?.length ?? 0) > 0 ||
    (interventionFilters?.length ?? 0) > 0 ||
    (resolutionFilters?.length ?? 0) > 0;

  const handleClearAll = () => {
    onChangeMasterFilter?.({
      department_ids: undefined,
      programs: undefined,
      instructor_ids: undefined,
      course_ids: undefined,
      batches: undefined,
      semester: undefined,
    });
    onChangeGpaFilters?.([]);
    onChangeAttendanceFilters?.([]);
    onChangeClassStatusFilters?.([]);
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
      batch: null,
      semester: null,
      gpa_filter: null,
      attendance_filter: null,
      class_status_filter: null,
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
          searchable
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
          searchable
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
          searchable
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
          searchable
          data-testid="filter-instructor"
        />
      )}
      {(options.batches?.length ?? 0) > 0 && (
        <FilterMultiSelect
          label="Batch"
          selected={current.batches ?? []}
          items={options.batches}
          onChange={handleBatch}
          isOpen={openFilter === "batch"}
          onOpenChange={toggleFilter("batch")}
          searchable
          data-testid="filter-batch"
        />
      )}

      <FilterSingleSelect
        label="Semester"
        selected={selectedSemester}
        items={semesterOptions}
        onChange={handleSemester}
        isOpen={openFilter === "semester"}
        onOpenChange={toggleFilter("semester")}
        emptyLabel={semesterEmptyLabel}
        loading={semestersLoading}
        data-testid="filter-semester"
      />

      <FilterMultiSelect
        label="Attendance"
        selected={attendanceFilters ?? []}
        items={attendanceItemsWithCounts}
        onChange={handleAttendanceFilters}
        isOpen={openFilter === "attendance"}
        onOpenChange={toggleFilter("attendance")}
        data-testid="filter-attendance"
      />
      {session?.data?.user?.role !== 'instructor' && (
      <FilterMultiSelect
        label="SGPA"
        selected={gpaFilters ?? []}
        items={gpaItemsWithCounts}
        onChange={handleGpaFilters}
        isOpen={openFilter === "gpa"}
        onOpenChange={toggleFilter("gpa")}
        data-testid="filter-gpa"
      />
      )}
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
            : "cursor-not-allowed border-stroke/50 bg-red-600/60 text-white/80 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        )}
      >
        Clear All
      </button>
    </div>
  );
}
