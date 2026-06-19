"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { StaffDirectoryTableClient } from "./StaffDirectoryTableClient";
import { TablePagination } from "@/components/Tables/nested-students-table/table-pagination";
import type { CreateStaffResult } from "@/app/dashboard/superadmin/staff/create-staff-action";

type StaffListRow = {
  id: string;
  pernr: string;
  name: string;
  img: string | null;
  email: string;
  role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller";
  actual_role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller"
    | "coordinator"
    | "admin"
    | null;
  pseudo_role:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | "wellbeing-head"
    | "wellbeing-counseller"
    | null;
  faculty_id: string | null;
  faculty_name: string | null;
  other_faculty_names: string[] | null;
  department_names: string[] | null;
  department_ids: string[] | null;
  login_count: number | null;
  last_login_at: string | null;
  ei_score: number | null;
  ei_rating: "A" | "B" | "C" | "D" | null;
  ei_dimension_label: string | null;
};

type FacultyRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string; code: string | null; faculty_id: string | null };

type Props = {
  staff: StaffListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  facultyId: string | null;
  departmentId: string | null;
  search: string;
  createStaff: (formData: FormData) => Promise<CreateStaffResult>;
};

export function UnregisteredStaffPanelClient({
  staff,
  total,
  page,
  pageSize,
  totalPages,
  faculties,
  departments,
  facultyId,
  departmentId,
  search,
  createStaff,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const filteredDepartments = useMemo(() => {
    if (!facultyId) return departments;
    return departments.filter((d) => d.faculty_id === facultyId);
  }, [departments, facultyId]);

  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    params.set("tab", "unregistered");

    const nextFaculty = updates.faculty !== undefined ? updates.faculty : facultyId;
    const nextDepartment =
      updates.department !== undefined ? updates.department : departmentId;
    const nextSearch = updates.search !== undefined ? updates.search : search;
    const nextPage = updates.page ?? String(page);

    if (nextFaculty) params.set("faculty", nextFaculty);
    if (nextDepartment) params.set("department", nextDepartment);
    if (nextSearch?.trim()) params.set("q", nextSearch.trim());
    if (nextPage && nextPage !== "1") params.set("page", nextPage);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const paginationBaseParams: Record<string, string> = { tab: "unregistered" };
  if (facultyId) paginationBaseParams.faculty = facultyId;
  if (departmentId) paginationBaseParams.department = departmentId;
  if (search.trim()) paginationBaseParams.q = search.trim();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Instructors found in current enrollment who do not yet have a staff account (
        {total.toLocaleString()} total).
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <select
          value={facultyId ?? "all"}
          onChange={(e) => {
            const value = e.target.value === "all" ? null : e.target.value;
            navigate({ faculty: value, department: null, page: "1" });
          }}
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          <option value="all">All Faculties</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>
              {resolveFacultyNameFromIdOrName(f.id, f.name) ?? f.name ?? f.id}
            </option>
          ))}
        </select>

        <select
          value={departmentId ?? "all"}
          onChange={(e) => {
            const value = e.target.value === "all" ? null : e.target.value;
            navigate({ department: value, page: "1" });
          }}
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          <option value="all">All Departments</option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const nextSearch = String(formData.get("q") ?? "");
            navigate({ search: nextSearch, page: "1" });
          }}
        >
          <input
            name="q"
            defaultValue={search}
            placeholder="Search name, email, or pernr"
            className="h-11 min-w-0 flex-1 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg border border-stroke px-4 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Search
          </button>
        </form>
      </div>

      <StaffDirectoryTableClient
        staff={staff}
        faculties={faculties}
        departments={departments}
        variant="unregistered"
        createStaff={createStaff}
      />

      {total > 0 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          baseSearchParams={paginationBaseParams}
        />
      )}
    </div>
  );
}
