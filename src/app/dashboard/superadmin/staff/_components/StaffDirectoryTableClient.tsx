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

type SortKey =
  | "staff"
  | "pseudo_role"
  | "actual_role"
  | "pernr"
  | "faculty"
  | "departments"
  | "login_count"
  | "last_login"
  | "actions";
type SortDirection = "asc" | "desc";

const ROLE_OPTIONS: StaffListRow["role"][] = [
  "superadmin",
  "dean",
  "hod",
  "instructor",
  "wellbeing",
  "wellbeing-head",
  "wellbeing-counseller",
];

const ROLE_BADGE_STYLES: Record<string, string> = {
  superadmin:
    "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/40",
  dean: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:ring-blue-400/40",
  hod: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-500/20 dark:text-green-200 dark:ring-green-400/40",
  instructor:
    "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/40",
  wellbeing:
    "bg-teal-100 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:ring-teal-400/40",
  "wellbeing-head":
    "bg-cyan-100 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/40",
  "wellbeing-counseller":
    "bg-pink-100 text-pink-700 ring-1 ring-inset ring-pink-200 dark:bg-pink-500/20 dark:text-pink-200 dark:ring-pink-400/40",
  coordinator:
    "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:ring-indigo-400/40",
  admin:
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/40",
};

function resolveFacultyName(row: StaffListRow): string {
  return resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name) ?? "—";
}

function resolveDepartmentNames(row: StaffListRow): string[] {
  return (row.department_names ?? []).filter((name) => name.trim().length > 0);
}

function formatRoleLabel(role: string): string {
  return role.replaceAll("-", " ").toUpperCase();
}

function getRoleBadgeClassName(role: string): string {
  return (
    ROLE_BADGE_STYLES[role] ??
    "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-500/20 dark:text-gray-200 dark:ring-gray-400/40"
  );
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
  const [sortKey, setSortKey] = useState<SortKey>("staff");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
      const matchRole = selectedRole === "all" || row.pseudo_role === selectedRole;
      const matchSearch =
        term.length === 0 ||
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        row.pernr.toLowerCase().includes(term);
      return matchFaculty && matchDepartment && matchRole && matchSearch;
    });
  }, [staff, selectedFaculty, selectedDepartment, selectedRole, search]);

  const sortedStaff = useMemo(() => {
    const getValue = (row: StaffListRow): string | number => {
      switch (sortKey) {
        case "staff":
          return row.name || row.email || row.pernr || "—";
        case "pseudo_role":
          return row.pseudo_role ?? row.role ?? "";
        case "actual_role":
          return row.actual_role ?? "";
        case "pernr":
          return row.pernr ?? "";
        case "faculty":
          return resolveFacultyName(row).replace("Faculty of", "").trim();
        case "departments":
          return resolveDepartmentNames(row).join(", ");
        case "login_count":
          return row.login_count ?? 0;
        case "last_login":
          return row.last_login_at ? new Date(row.last_login_at).getTime() : 0;
        case "actions":
          return row.name || "";
        default:
          return "";
      }
    };

    return [...filteredStaff].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const result = String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredStaff, sortKey, sortDirection]);

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  };

  const sortIndicator = (key: SortKey): string => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

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
                <TableHead className="min-w-[280px]">
                  <button type="button" onClick={() => toggleSort("staff")} className="inline-flex items-center gap-1">
                    Staff <span className="text-xs">{sortIndicator("staff")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <button type="button" onClick={() => toggleSort("pseudo_role")} className="inline-flex items-center gap-1">
                    Pseudo Role <span className="text-xs">{sortIndicator("pseudo_role")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <button type="button" onClick={() => toggleSort("actual_role")} className="inline-flex items-center gap-1">
                    Actual Role <span className="text-xs">{sortIndicator("actual_role")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <button type="button" onClick={() => toggleSort("pernr")} className="inline-flex items-center gap-1">
                    Pernr <span className="text-xs">{sortIndicator("pernr")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <button type="button" onClick={() => toggleSort("faculty")} className="inline-flex items-center gap-1">
                    Parent Faculty <span className="text-xs">{sortIndicator("faculty")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[240px]">
                  <button type="button" onClick={() => toggleSort("departments")} className="inline-flex items-center gap-1">
                    Departments <span className="text-xs">{sortIndicator("departments")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[60px]">
                  <button type="button" onClick={() => toggleSort("login_count")} className="inline-flex items-center gap-1">
                    Login Count <span className="text-xs">{sortIndicator("login_count")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <button type="button" onClick={() => toggleSort("last_login")} className="inline-flex items-center gap-1">
                    Last Login <span className="text-xs">{sortIndicator("last_login")}</span>
                  </button>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <button type="button" onClick={() => toggleSort("actions")} className="inline-flex items-center gap-1">
                    Actions <span className="text-xs">{sortIndicator("actions")}</span>
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStaff.map((row) => (
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
                        role: row.pseudo_role ?? row.role,
                        pseudoRole: row.actual_role,
                        pernr: row.pernr || "—",
                        facultyName: resolveFacultyName(row),
                        departments: resolveDepartmentNames(row),
                      }}
                    />
                  </TableCell>
                  <TableCell className="!text-left text-dark dark:text-white ">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${getRoleBadgeClassName(
                        row.pseudo_role ?? row.role
                      )}`}
                    >
                      {formatRoleLabel(row.pseudo_role ?? row.role)}
                    </span>
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {row.actual_role ? (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${getRoleBadgeClassName(
                          row.actual_role
                        )}`}
                      >
                        {formatRoleLabel(row.actual_role)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {row.pernr || "—"}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {resolveFacultyName(row).replace("Faculty of", "")}
                  </TableCell>
                  <TableCell className="!text-left text-dark-6">
                    {((row.pseudo_role ?? row.role) === "hod" || (row.pseudo_role ?? row.role) === "instructor") &&
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
  const [pseudoRole, setPseudoRole] = useState<StaffListRow["role"]>(staff.pseudo_role ?? staff.role);
  const showDepartments = pseudoRole === "hod";

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
            <label className="text-sm font-medium text-dark dark:text-white">Pseudo Role *</label>
            <select
              name="pseudo_role"
              required
              value={pseudoRole}
              onChange={(e) => setPseudoRole(e.target.value as StaffListRow["role"])}
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
            <label className="text-sm font-medium text-dark dark:text-white">Actual Role *</label>
            <select
              name="actual_role"
              required
              defaultValue={staff.actual_role ?? "admin"}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              <option value="superadmin">superadmin</option>
              <option value="dean">dean</option>
              <option value="hod">hod</option>
              <option value="instructor">instructor</option>
              <option value="wellbeing">wellbeing</option>
              <option value="wellbeing-head">wellbeing-head</option>
              <option value="wellbeing-counseller">wellbeing-counseller</option>
              <option value="admin">admin</option>
              <option value="coordinator">coordinator</option>
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
