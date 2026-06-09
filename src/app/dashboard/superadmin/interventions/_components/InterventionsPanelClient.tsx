"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function formatInterventionType(type: InterventionListItem["intervention_type"]): string {
  if (type === "gpa") return "GPA";
  if (type === "both") return "Both";
  return "Attendance";
}

function formatOutreachMode(mode: string): string {
  return mode.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

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
    "h-11 w-full rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";

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

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {loading ? "Loading…" : `${total.toLocaleString()} intervention${total === 1 ? "" : "s"}`}
          </p>
          {error ? (
            <button
              type="button"
              onClick={() => void fetchInterventions()}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Retry
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Faculty / Dept</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Outreach</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-slate-500">
                    Loading interventions…
                  </TableCell>
                </TableRow>
              ) : interventions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-slate-500">
                    No interventions match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                interventions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/students/${encodeURIComponent(row.student_sap_id)}`}
                        className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {row.student_name?.trim() || row.student_sap_id}
                      </Link>
                      <p className="text-xs text-slate-500">{row.student_sap_id}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell className="text-xs">{formatInterventionType(row.intervention_type)}</TableCell>
                    <TableCell>
                      <InterventionStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs" title={row.course_title ?? row.course_id ?? ""}>
                      {row.course_id
                        ? row.course_title
                          ? `${row.course_id} — ${row.course_title}`
                          : row.course_id
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] text-xs">
                      <p className="truncate" title={row.faculty_name ?? ""}>
                        {resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name ?? "") ??
                          row.faculty_name ??
                          "—"}
                      </p>
                      <p className="truncate text-slate-500" title={row.department_name ?? ""}>
                        {row.department_name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs" title={row.program_title ?? ""}>
                      {row.program_title ?? row.program_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{formatOutreachMode(row.outreach_mode)}</TableCell>
                    <TableCell className="text-xs">{row.uploader_name ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {!loading && totalPages > 1 ? (
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                page <= 1
                  ? "cursor-not-allowed text-slate-400"
                  : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              )}
            >
              Previous
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                page >= totalPages
                  ? "cursor-not-allowed text-slate-400"
                  : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              )}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
