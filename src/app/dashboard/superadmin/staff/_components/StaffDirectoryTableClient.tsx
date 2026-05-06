"use client";

import { useMemo, useState } from "react";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffDetailsDialog } from "./StaffDetailsDialog";

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
    | "wellbeing-head"
    | "wellbeing-counseller";
  faculty_id: string | null;
  faculty_name: string | null;
  department_names: string[] | null;
  department_ids: string[] | null;
  login_count: number | null;
  last_login_at: string | null;
};

type FacultyRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  faculty_id: string | null;
};

const ROLE_OPTIONS: StaffListRow["role"][] = [
  "superadmin",
  "dean",
  "hod",
  "instructor",
  "wellbeing-head",
  "wellbeing-counseller",
];

function resolveFacultyName(row: StaffListRow): string {
  return resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name) ?? "—";
}

function resolveDepartmentNames(row: StaffListRow): string[] {
  return (row.department_names ?? []).filter((name) => name.trim().length > 0);
}

export function StaffDirectoryTableClient({
  staff,
  faculties,
  departments,
  updateStaffAction,
  deleteStaffAction,
}: {
  staff: StaffListRow[];
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  updateStaffAction: (formData: FormData) => void | Promise<void>;
  deleteStaffAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null);

  const filteredDepartments = useMemo(() => {
    if (selectedFaculty === "all") return departments;
    return departments.filter((d) => d.faculty_id === selectedFaculty);
  }, [departments, selectedFaculty]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((row) => {
      const matchFaculty =
        selectedFaculty === "all" || (row.faculty_id ?? "") === selectedFaculty;
      const rowDepartmentIds = row.department_ids ?? [];
      const matchDepartment =
        selectedDepartment === "all" || rowDepartmentIds.includes(selectedDepartment);
      const matchRole = selectedRole === "all" || row.role === selectedRole;
      const matchSearch =
        term.length === 0 ||
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        row.pernr.toLowerCase().includes(term);
      return matchFaculty && matchDepartment && matchRole && matchSearch;
    });
  }, [staff, selectedFaculty, selectedDepartment, selectedRole, search]);

  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select
          value={selectedFaculty}
          onChange={(e) => {
            setSelectedFaculty(e.target.value);
            setSelectedDepartment("all");
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
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          <option value="all">All Departments</option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or pernr"
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        />
      </div>

      {filteredStaff.length === 0 ? (
        <p className="text-sm text-dark-5 dark:text-dark-6">
          No staff records match the selected filters.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-stroke bg-white dark:bg-gray-dark dark:border-dark-3 [&>tr]:border-stroke dark:[&>tr]:border-dark-3">
              <TableRow className="border-none uppercase [&>th]:!text-left [&>th]:bg-white [&>th]:dark:bg-gray-dark">
                <TableHead className="min-w-[280px]">Staff</TableHead>
                <TableHead className="min-w-[80px]">Role</TableHead>
                <TableHead className="min-w-[120px]">Pernr</TableHead>
                <TableHead className="min-w-[160px]">Parent Faculty</TableHead>
                <TableHead className="min-w-[240px]">Departments</TableHead>
                <TableHead className="min-w-[60px]">Login Count</TableHead>
                <TableHead className="min-w-[180px]">Last Login</TableHead>
                <TableHead className="min-w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((row) => (
                <TableRow
                  key={row.id}
                  className="text-base font-medium text-dark dark:text-white"
                >
                  <TableCell className="!text-left font-medium text-dark dark:text-white">
                    <StaffDetailsDialog
                      staff={{
                        name: row.name || "—",
                        img: row.img,
                        email: row.email,
                        role: row.role,
                        pernr: row.pernr || "—",
                        facultyName: resolveFacultyName(row),
                        departments: resolveDepartmentNames(row),
                      }}
                    />
                  </TableCell>
                  <TableCell className="!text-left text-dark dark:text-white">
                    {row.role.toUpperCase()}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {row.pernr || "—"}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {resolveFacultyName(row).replace("Faculty of", "")}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {(row.role === "hod" || row.role === "instructor") &&
                    resolveDepartmentNames(row).length
                      ? resolveDepartmentNames(row).join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {row.login_count ?? 0}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {row.last_login_at
                      ? new Date(row.last_login_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="!text-left">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingStaff(row)}
                        className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                      >
                        Edit
                      </button>
                      <form
                        action={deleteStaffAction}
                        onSubmit={(e) => {
                          const ok = window.confirm(
                            `Delete ${row.name}? This action cannot be undone.`
                          );
                          if (!ok) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingStaff && (
        <EditStaffModal
          staff={editingStaff}
          faculties={faculties}
          departments={departments}
          onClose={() => setEditingStaff(null)}
          action={updateStaffAction}
        />
      )}
    </div>
  );
}

function EditStaffModal({
  staff,
  faculties,
  departments,
  onClose,
  action,
}: {
  staff: StaffListRow;
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  onClose: () => void;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [role, setRole] = useState<StaffListRow["role"]>(staff.role);
  const showDepartments = role === "hod";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-dark/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit staff"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Edit Staff</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Close
          </button>
        </div>

        <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={staff.id} />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Name *</label>
            <input
              name="name"
              required
              defaultValue={staff.name}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Email *</label>
            <input
              type="email"
              name="email"
              required
              defaultValue={staff.email}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Pernr *</label>
            <input
              name="pernr"
              required
              defaultValue={staff.pernr}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">
              New Password
            </label>
            <input
              type="password"
              name="password"
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Role *</label>
            <select
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value as StaffListRow["role"])}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">
              Parent Faculty *
            </label>
            <select
              name="faculty_id"
              required
              defaultValue={staff.faculty_id ?? ""}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              <option value="">Select parent faculty</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {resolveFacultyNameFromIdOrName(faculty.id, faculty.name) ??
                    faculty.name ??
                    faculty.id}
                </option>
              ))}
            </select>
          </div>

          {showDepartments && (
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium text-dark dark:text-white">
                HoD Departments
              </label>
              <select
                name="department_ids"
                multiple
                defaultValue={staff.department_ids ?? []}
                className="min-h-32 rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-5 dark:text-dark-6">
                Use Ctrl/Cmd + click to select multiple departments for HoD.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 md:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
