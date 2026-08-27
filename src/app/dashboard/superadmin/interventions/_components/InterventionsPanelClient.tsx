"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import type { InterventionListItem, InterventionListStats } from "@/lib/db/interventions";
import type { CourseRow, DepartmentRow, FacultyRow, ProgramRow } from "@/lib/staff-directory-queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InterventionStatusBadge } from "@/app/(home)/dashboard/_components/intervention-status-badge";
import { InterventionStatsCards, type StatusFilter } from "./InterventionStatsCards";
import { cn } from "@/lib/utils";

const EMPTY_STATS: InterventionListStats = {
  total: 0,
  initiated: 0,
  inProgress: 0,
  referred: 0,
  resolved: 0,
  noActionRequired: 0,
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatOutreachMode(mode: string): string {
  return mode.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function studentInitials(name: string | null, sapId: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (sapId.trim().slice(0, 2) || "?").toUpperCase();
}

function TypeChip({ type }: { type: InterventionListItem["intervention_type"] }) {
  const styles = {
    attendance: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    gpa: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    both: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  } as const;
  const labels = { attendance: "Attendance", gpa: "GPA", both: "Both" } as const;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        styles[type]
      )}
    >
      {labels[type]}
    </span>
  );
}

const TH_CLASS =
  "h-11 whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:pl-5 last:pr-5 dark:text-slate-400";
const TD_CLASS = "px-4 py-4 align-middle first:pl-5 last:pr-5";

type Props = {
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  programs: ProgramRow[];
  courses: CourseRow[];
};

export function InterventionsPanelClient({
  faculties,
  departments,
  programs,
  courses,
}: Props) {
  const [selectedFaculty, setSelectedFaculty] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [interventions, setInterventions] = useState<InterventionListItem[]>([]);
  const [stats, setStats] = useState<InterventionListStats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 50;

  const filteredDepartments = useMemo(() => {
    if (selectedFaculty === "all") return departments;
    return departments.filter((d) => d.faculty_id === selectedFaculty);
  }, [departments, selectedFaculty]);

  const filteredPrograms = useMemo(() => {
    let list = programs;
    if (selectedFaculty !== "all") {
      list = list.filter((p) => p.faculty_id === selectedFaculty);
    }
    if (selectedDepartment !== "all") {
      list = list.filter((p) => p.department_id === selectedDepartment);
    }
    return list;
  }, [programs, selectedDepartment, selectedFaculty]);

  const filteredCourses = useMemo(() => {
    let list = courses;
    if (selectedFaculty !== "all") {
      list = list.filter((c) => c.faculty_id === selectedFaculty);
    }
    if (selectedDepartment !== "all") {
      list = list.filter((c) => c.department_id === selectedDepartment);
    }
    if (selectedProgram !== "all") {
      list = list.filter((c) => c.program_id === selectedProgram);
    }
    return list;
  }, [courses, selectedDepartment, selectedFaculty, selectedProgram]);

  const fetchInterventions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedFaculty !== "all") params.set("facultyId", selectedFaculty);
      if (selectedDepartment !== "all") params.set("departmentId", selectedDepartment);
      if (selectedProgram !== "all") params.set("programId", selectedProgram);
      if (selectedCourse !== "all") params.set("courseId", selectedCourse);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/superadmin/interventions?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load interventions");
      }
      const data = await res.json();
      setInterventions(data.interventions ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setTotal(data.total ?? 0);
    } catch {
      setError("Unable to load interventions. Please try again.");
      setInterventions([]);
      setStats(EMPTY_STATS);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCourse, selectedDepartment, selectedFaculty, selectedProgram, statusFilter]);

  useEffect(() => {
    void fetchInterventions();
  }, [fetchInterventions]);

  useEffect(() => {
    setPage(1);
  }, [selectedFaculty, selectedDepartment, selectedProgram, selectedCourse, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectClassName =
    "h-11 w-full rounded-lg border border-stroke bg-white px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <select
          value={selectedFaculty}
          onChange={(e) => {
            setSelectedFaculty(e.target.value);
            setSelectedDepartment("all");
            setSelectedProgram("all");
            setSelectedCourse("all");
          }}
          className={selectClassName}
        >
          <option value="all">All Faculties</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>
              {resolveFacultyNameFromIdOrName(f.id, f.name) ?? f.name ?? f.id}
            </option>
          ))}
        </select>

        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value);
            setSelectedProgram("all");
            setSelectedCourse("all");
          }}
          className={selectClassName}
        >
          <option value="all">All Departments</option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedProgram}
          onChange={(e) => {
            setSelectedProgram(e.target.value);
            setSelectedCourse("all");
          }}
          className={selectClassName}
        >
          <option value="all">All Programs</option>
          {filteredPrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className={selectClassName}
        >
          <option value="all">All Courses</option>
          {filteredCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title ? `${c.id} — ${c.title}` : c.id}
            </option>
          ))}
        </select>
      </div>

      <InterventionStatsCards
        stats={stats}
        activeStatus={statusFilter}
        onStatusSelect={setStatusFilter}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Intervention records</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {loading
                ? "Loading records…"
                : `${total.toLocaleString()} ${total === 1 ? "result" : "results"}`}
            </p>
          </div>
          {error ? (
            <button
              type="button"
              onClick={() => void fetchInterventions()}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Retry
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="px-5 py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-white/[0.03]">
              <TableRow className="border-slate-200/80 hover:bg-transparent dark:border-white/10">
                <TableHead className={TH_CLASS}>Student</TableHead>
                <TableHead className={TH_CLASS}>Date</TableHead>
                <TableHead className={TH_CLASS}>Type</TableHead>
                <TableHead className={TH_CLASS}>Status</TableHead>
                <TableHead className={TH_CLASS}>Course</TableHead>
                <TableHead className={TH_CLASS}>Faculty / Dept</TableHead>
                <TableHead className={TH_CLASS}>Program</TableHead>
                <TableHead className={TH_CLASS}>Outreach</TableHead>
                <TableHead className={TH_CLASS}>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow
                    key={`skeleton-${index}`}
                    className="border-slate-100 dark:border-white/5 hover:bg-transparent"
                  >
                    <TableCell className={TD_CLASS} colSpan={9}>
                      <div className="flex items-center gap-3">
                        <div className="size-9 shrink-0 animate-pulse rounded-full bg-slate-100 dark:bg-white/10" />
                        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-slate-100 dark:bg-white/10" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : interventions.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                        <ClipboardList className="size-5" aria-hidden />
                      </span>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        No interventions match the current filters
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Try another faculty, status, or course.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                interventions.map((row) => {
                  const facultyLabel =
                    resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name ?? "") ??
                    row.faculty_name ??
                    "—";
                  const courseLabel = row.course_id
                    ? row.course_title
                      ? `${row.course_id} — ${row.course_title}`
                      : row.course_id
                    : "—";
                  return (
                    <TableRow
                      key={row.id}
                      className="border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-white/[0.04]"
                    >
                      <TableCell className={cn(TD_CLASS, "min-w-[200px]")}>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {studentInitials(row.student_name, row.student_sap_id)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/students/${encodeURIComponent(row.student_sap_id)}`}
                              className="block truncate font-medium text-slate-900 outline-none hover:text-emerald-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary dark:text-white dark:hover:text-emerald-400"
                            >
                              {row.student_name?.trim() || row.student_sap_id}
                            </Link>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {row.student_sap_id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={cn(TD_CLASS, "whitespace-nowrap text-sm text-slate-700 dark:text-slate-200")}>
                        {formatDate(row.date)}
                      </TableCell>
                      <TableCell className={TD_CLASS}>
                        <TypeChip type={row.intervention_type} />
                      </TableCell>
                      <TableCell className={TD_CLASS}>
                        <InterventionStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className={cn(TD_CLASS, "max-w-[220px]")}>
                        <p className="truncate text-sm text-slate-800 dark:text-slate-100" title={courseLabel}>
                          {courseLabel}
                        </p>
                      </TableCell>
                      <TableCell className={cn(TD_CLASS, "max-w-[200px]")}>
                        <p className="truncate text-sm text-slate-800 dark:text-slate-100" title={facultyLabel}>
                          {facultyLabel}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={row.department_name ?? ""}>
                          {row.department_name ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className={cn(TD_CLASS, "max-w-[180px]")}>
                        <p
                          className="truncate text-sm text-slate-800 dark:text-slate-100"
                          title={row.program_title ?? row.program_id ?? ""}
                        >
                          {row.program_title ?? row.program_id ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className={TD_CLASS}>
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {formatOutreachMode(row.outreach_mode)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TD_CLASS, "whitespace-nowrap text-sm text-slate-700 dark:text-slate-200")}>
                        {row.uploader_name ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}

        {!loading && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>{" "}
              of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                  page <= 1
                    ? "cursor-not-allowed border-slate-200 text-slate-400 dark:border-white/10"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                )}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </button>
              <span className="min-w-20 text-center text-sm text-slate-600 dark:text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                  page >= totalPages
                    ? "cursor-not-allowed border-slate-200 text-slate-400 dark:border-white/10"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                )}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
