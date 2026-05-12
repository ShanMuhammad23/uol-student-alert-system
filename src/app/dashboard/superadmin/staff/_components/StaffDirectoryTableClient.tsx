"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  resolveFacultyNameFromIdOrName,
  toShortFacultyName,
} from "@/lib/faculty-name";
import {
  FORM_PSEUDO_ROLE_OPTIONS,
  clampActualFormValueToPseudo,
  formatActualRoleDisplay,
  getActualRoleFormOptionsForPseudo,
  isStoredPseudoRole,
  storedActualRoleToFormValue,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";
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
  other_faculty_names: string[] | null;
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
  | "other_faculties"
  | "departments"
  | "login_count"
  | "last_login"
  | "actions";
type SortDirection = "asc" | "desc";

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
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/40",
  admin:
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/40",
};

function resolveFacultyName(row: StaffListRow): string {
  return resolveFacultyNameFromIdOrName(row.faculty_id, row.faculty_name) ?? "—";
}

function resolveDepartmentNames(row: StaffListRow): string[] {
  return (row.department_names ?? []).filter((name) => name.trim().length > 0);
}

/** Resolved + shortened labels for the Other Faculties column (matches lib fallbacks). */
function resolveOtherFacultyDisplayParts(row: StaffListRow): string[] {
  return (row.other_faculty_names ?? [])
    .filter((name) => name.trim().length > 0)
    .map((raw) => {
      const resolved =
        resolveFacultyNameFromIdOrName(raw, raw)?.trim() ?? raw.trim();
      return (
        toShortFacultyName(resolved) ??
        resolved.replace(/^Faculty of\s+/i, "").trim()
      );
    })
    .filter((s) => s.length > 0);
}

function formatOtherFacultiesCell(row: StaffListRow): string {
  const parts = resolveOtherFacultyDisplayParts(row);
  return parts.length > 0 ? parts.join(", ") : "—";
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
  readOnly = false,
}: {
  staff: StaffListRow[];
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  /** Dean directory: no edit/delete/actions column */
  readOnly?: boolean;
}) {
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("staff");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const goWithStatus = (query: string) => {
    window.location.assign(`/dashboard/superadmin/staff?${query}`);
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = window.confirm(`Delete ${name}? This action cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/dashboard/superadmin/staff/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        goWithStatus("error=delete_failed");
        return;
      }
      goWithStatus("success=deleted");
    } catch {
      goWithStatus("error=delete_failed");
    }
  };

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
        case "other_faculties":
          return resolveOtherFacultyDisplayParts(row).join(", ");
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

    return [...staff].sort((a, b) => {
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
  }, [staff, sortKey, sortDirection]);

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
      {sortedStaff.length === 0 ? (
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
                <TableHead className="min-w-[200px]">
                  <button type="button" onClick={() => toggleSort("other_faculties")} className="inline-flex items-center gap-1">
                    Other Faculties <span className="text-xs">{sortIndicator("other_faculties")}</span>
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
                {!readOnly && (
                  <TableHead className="min-w-[200px]">
                    <button type="button" onClick={() => toggleSort("actions")} className="inline-flex items-center gap-1">
                      Actions <span className="text-xs">{sortIndicator("actions")}</span>
                    </button>
                  </TableHead>
                )}
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
                          row.actual_role === "admin" || row.actual_role === "coordinator"
                            ? "admin"
                            : row.actual_role
                        )}`}
                      >
                        {formatActualRoleDisplay(row.actual_role)}
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
                    {formatOtherFacultiesCell(row)}
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
                  {!readOnly && (
                    <TableCell className="!text-left">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingStaff(row)}
                          className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id, row.name)}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingStaff && !readOnly && (
        <EditStaffModal
          staff={editingStaff}
          faculties={faculties}
          departments={departments}
          onClose={() => setEditingStaff(null)}
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
}: {
  staff: StaffListRow;
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  onClose: () => void;
}) {
  const initialPseudo: StoredPseudoRole =
    staff.pseudo_role && isStoredPseudoRole(staff.pseudo_role)
      ? staff.pseudo_role
      : "instructor";

  const [pseudoRole, setPseudoRole] = useState<StoredPseudoRole>(initialPseudo);

  const [actualRoleForm, setActualRoleForm] = useState(() => {
    const raw = storedActualRoleToFormValue(staff.actual_role);
    const fallback = getActualRoleFormOptionsForPseudo(initialPseudo)[0]?.value ?? "";
    return clampActualFormValueToPseudo(initialPseudo, raw || fallback);
  });

  const actualOptionsForPseudo = useMemo(
    () => getActualRoleFormOptionsForPseudo(pseudoRole),
    [pseudoRole]
  );

  const showDepartments = pseudoRole === "hod";

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      pernr: String(formData.get("pernr") ?? "").trim(),
      actual_role: String(formData.get("actual_role") ?? "").trim(),
      pseudo_role: String(formData.get("pseudo_role") ?? "").trim(),
      faculty_id: String(formData.get("faculty_id") ?? "").trim(),
      password: String(formData.get("password") ?? "").trim(),
      department_ids: formData.getAll("department_ids").map((v) => String(v)),
    };

    try {
      setIsSaving(true);
      const res = await fetch(`/api/dashboard/superadmin/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        window.location.assign(`/dashboard/superadmin/staff?error=${body.error ?? "update_failed"}`);
        return;
      }
      window.location.assign("/dashboard/superadmin/staff?success=updated");
    } catch {
      window.location.assign("/dashboard/superadmin/staff?error=update_failed");
    } finally {
      setIsSaving(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              onChange={(e) => {
                const next = e.target.value as StoredPseudoRole;
                setPseudoRole(next);
                setActualRoleForm((prev) =>
                  clampActualFormValueToPseudo(next, prev)
                );
              }}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              {FORM_PSEUDO_ROLE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Actual Role *</label>
            <select
              name="actual_role"
              required
              value={actualRoleForm}
              onChange={(e) => setActualRoleForm(e.target.value)}
              className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
            >
              {actualOptionsForPseudo.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
              disabled={isSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
