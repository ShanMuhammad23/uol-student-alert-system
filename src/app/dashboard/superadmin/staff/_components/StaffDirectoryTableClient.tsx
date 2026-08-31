"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  KeyRound,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffDetailsDialog } from "./StaffDetailsDialog";
import { GrantAccessDialog } from "./GrantAccessDialog";
import { EiScoreBadge } from "./EiScoreBadge";
import type { CreateStaffResult } from "@/app/dashboard/superadmin/staff/create-staff-action";
import type { EiRating } from "@/lib/effectiveness-scoring";

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
  ei_rating: EiRating | null;
  ei_dimension_label: string | null;
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
  | "pseudo_actual"
  | "pernr"
  | "faculty"
  | "other_faculties"
  | "departments"
  | "ei_score"
  | "login_count"
  | "last_login"
  | "actions";
type SortDirection = "asc" | "desc";

const ROLE_BADGE_STYLES: Record<string, string> = {
  superadmin:
    "bg-violet-100 text-violet-800 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/25",
  dean: "bg-blue-100 text-blue-800 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/25",
  hod: "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  instructor:
    "bg-amber-100 text-amber-800 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
  wellbeing:
    "bg-teal-100 text-teal-800 ring-teal-200/80 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/25",
  "wellbeing-head":
    "bg-cyan-100 text-cyan-800 ring-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-400/25",
  "wellbeing-counseller":
    "bg-pink-100 text-pink-800 ring-pink-200/80 dark:bg-pink-500/15 dark:text-pink-200 dark:ring-pink-400/25",
  coordinator:
    "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/25",
  admin:
    "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/25",
};

const ROLE_SHORT_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  dean: "Dean",
  hod: "HoD",
  instructor: "Instructor",
  wellbeing: "Wellbeing",
  "wellbeing-head": "WB Head",
  "wellbeing-counseller": "Counsellor",
  coordinator: "Coordinator",
  admin: "Admin",
};

const TH_CLASS =
  "h-11 whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:pl-5 last:pr-5 dark:text-slate-400";
const TD_CLASS = "px-3 py-3.5 align-middle first:pl-5 last:pr-5";

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

function formatRoleLabel(role: string): string {
  if (role === "admin" || role === "coordinator") return "Admin / Coord";
  return ROLE_SHORT_LABELS[role] ?? role.replaceAll("-", " ");
}

function getRoleBadgeClassName(role: string): string {
  const key = role === "admin" || role === "coordinator" ? "admin" : role;
  return (
    ROLE_BADGE_STYLES[key] ??
    "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/25"
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      title={formatActualRoleDisplay(role)}
      className={cn(
        "inline-flex h-6 max-w-[9.5rem] shrink-0 items-center truncate rounded-md px-2 text-[11px] font-semibold leading-none tracking-normal ring-1 ring-inset",
        getRoleBadgeClassName(role)
      )}
    >
      {formatRoleLabel(role)}
    </span>
  );
}

function RolePair({
  accessRole,
  actualRole,
}: {
  accessRole: string;
  actualRole: string | null;
}) {
  return (
    <div className="flex min-w-[10.5rem] flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="w-[2.65rem] shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Access
        </span>
        <RoleBadge role={accessRole} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-[2.65rem] shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Actual
        </span>
        {actualRole ? <RoleBadge role={actualRole} /> : <span className="text-xs text-slate-400">—</span>}
      </div>
    </div>
  );
}

function formatLastLogin(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortButton({
  column,
  sortKey,
  sortDirection,
  onSort,
  children,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (column: SortKey) => void;
  children: string;
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
    >
      {children}
      {active ? (
        sortDirection === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-35" aria-hidden />
      )}
    </button>
  );
}

function CountListDropdown({
  items,
  labelSingular,
  labelPlural,
}: {
  items: string[];
  labelSingular: string;
  labelPlural: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const count = items.length;

  if (count === 0) {
    return <span className="text-sm text-slate-400 dark:text-slate-500">—</span>;
  }

  const label =
    count === 1 ? `1 ${labelSingular}` : `${count} ${labelPlural}`;

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]">
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </DropdownTrigger>
      <DropdownContent
        align="start"
        className="min-w-[12rem] border border-slate-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-gray-dark"
      >
        <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-slate-700 dark:text-white">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-md px-2 py-1.5 leading-snug hover:bg-slate-50 dark:hover:bg-white/[0.06]"
            >
              {item}
            </li>
          ))}
        </ul>
      </DropdownContent>
    </Dropdown>
  );
}

export function StaffDirectoryTableClient({
  staff,
  faculties,
  departments,
  readOnly = false,
  variant = "default",
  createStaff,
}: {
  staff: StaffListRow[];
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  /** Dean directory: no edit/delete/actions column */
  readOnly?: boolean;
  /** Unregistered enrollment instructors: hide role/login columns, show Grant Access */
  variant?: "default" | "unregistered";
  createStaff?: (formData: FormData) => Promise<CreateStaffResult>;
}) {
  const isUnregistered = variant === "unregistered";
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null);
  const [grantAccessStaff, setGrantAccessStaff] = useState<StaffListRow | null>(null);
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
        case "pseudo_actual":
          return `${row.pseudo_role ?? row.role ?? ""}\0${row.actual_role ?? ""}`;
        case "pernr":
          return row.pernr ?? "";
        case "faculty":
          return resolveFacultyName(row).replace("Faculty of", "").trim();
        case "other_faculties":
          return resolveOtherFacultyDisplayParts(row).length;
        case "departments":
          return resolveDepartmentNames(row).length;
        case "ei_score":
          return row.ei_score ?? -1;
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm [overflow-anchor:none] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {isUnregistered ? "Unregistered instructors" : "Staff directory"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {sortedStaff.length.toLocaleString()}{" "}
            {sortedStaff.length === 1 ? "record" : "records"}
          </p>
        </div>
      </div>

      {sortedStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
            <Users className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No staff records match the selected filters
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try another faculty, department, role, or search term.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-white/[0.03]">
            <TableRow className="border-slate-200/80 hover:bg-transparent dark:border-white/10">
              <TableHead className={cn(TH_CLASS, "min-w-[240px]")}>
                <SortButton column="staff" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                  Staff
                </SortButton>
              </TableHead>
              {!isUnregistered && (
                <TableHead className={cn(TH_CLASS, "min-w-[168px]")}>
                  <SortButton column="pseudo_actual" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                    Roles
                  </SortButton>
                </TableHead>
              )}
              <TableHead className={cn(TH_CLASS, "min-w-[140px]")}>
                <SortButton column="faculty" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                  Parent Faculty
                </SortButton>
              </TableHead>
              <TableHead className={cn(TH_CLASS, "min-w-[120px]")}>
                <SortButton column="other_faculties" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                  Other Faculties
                </SortButton>
              </TableHead>
              <TableHead className={cn(TH_CLASS, "min-w-[120px]")}>
                <SortButton column="departments" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                  Departments
                </SortButton>
              </TableHead>
              <TableHead className={cn(TH_CLASS, "min-w-[88px]")}>
                <SortButton column="ei_score" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                  EI
                </SortButton>
              </TableHead>
              {!isUnregistered && (
                <>
                  <TableHead className={cn(TH_CLASS, "min-w-[88px]")}>
                    <SortButton column="login_count" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                      Logins
                    </SortButton>
                  </TableHead>
                  <TableHead className={cn(TH_CLASS, "min-w-[148px]")}>
                    <SortButton column="last_login" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                      Last Login
                    </SortButton>
                  </TableHead>
                </>
              )}
              {(!readOnly || isUnregistered) && (
                <TableHead className={cn(TH_CLASS, "min-w-[128px]")}>
                  <SortButton column="actions" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort}>
                    Actions
                  </SortButton>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="[overflow-anchor:none]">
            {sortedStaff.map((row) => (
              <TableRow
                key={row.id}
                className="border-slate-100 text-sm text-slate-700 dark:border-white/5 dark:text-slate-200"
              >
                <TableCell className={TD_CLASS}>
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
                {!isUnregistered && (
                  <TableCell className={TD_CLASS}>
                    <RolePair
                      accessRole={row.pseudo_role ?? row.role}
                      actualRole={row.actual_role}
                    />
                  </TableCell>
                )}
                <TableCell className={cn(TD_CLASS, "text-slate-600 dark:text-slate-300")}>
                  <span className="line-clamp-2 text-sm leading-snug">
                    {resolveFacultyName(row).replace("Faculty of", "").trim() || "—"}
                  </span>
                </TableCell>
                <TableCell className={TD_CLASS}>
                  <CountListDropdown
                    items={resolveOtherFacultyDisplayParts(row)}
                    labelSingular="faculty"
                    labelPlural="faculties"
                  />
                </TableCell>
                <TableCell className={TD_CLASS}>
                  <CountListDropdown
                    items={resolveDepartmentNames(row)}
                    labelSingular="department"
                    labelPlural="departments"
                  />
                </TableCell>
                <TableCell className={TD_CLASS}>
                  <EiScoreBadge
                    rating={row.ei_rating}
                    score={row.ei_score}
                    dimensionLabel={row.ei_dimension_label}
                  />
                </TableCell>
                {!isUnregistered && (
                  <>
                    <TableCell className={TD_CLASS}>
                      <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold tabular-nums text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                        {row.login_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className={cn(TD_CLASS, "whitespace-nowrap text-xs text-slate-500 dark:text-slate-400")}>
                      {formatLastLogin(row.last_login_at)}
                    </TableCell>
                  </>
                )}
                {!readOnly && !isUnregistered && (
                  <TableCell className={TD_CLASS}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingStaff(row)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id, row.name)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 text-xs font-medium text-white transition hover:bg-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                       
                      </button>
                    </div>
                  </TableCell>
                )}
                {isUnregistered && createStaff && (
                  <TableCell className={TD_CLASS}>
                    <button
                      type="button"
                      onClick={() => setGrantAccessStaff(row)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden />
                      Grant Access
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingStaff && !readOnly && !isUnregistered && (
        <EditStaffModal
          staff={editingStaff}
          faculties={faculties}
          departments={departments}
          onClose={() => setEditingStaff(null)}
        />
      )}

      {grantAccessStaff && isUnregistered && createStaff && (
        <GrantAccessDialog
          staff={grantAccessStaff}
          faculties={faculties}
          departments={departments}
          createStaff={createStaff}
          onClose={() => setGrantAccessStaff(null)}
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
