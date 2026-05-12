"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import { StaffDirectoryTableClient } from "./StaffDirectoryTableClient";
import { StaffStatsCards, type RoleFilterValue } from "./StaffStatsCards";

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

type FacultyRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string; code: string | null; faculty_id: string | null };

function matchesRoleFilter(row: StaffListRow, selectedRole: RoleFilterValue): boolean {
  if (selectedRole === "all") return true;
  if (selectedRole === "superadmin") {
    return row.pseudo_role === "superadmin" || row.actual_role === "superadmin";
  }
  if (selectedRole === "dean") {
    return row.pseudo_role === "dean" || row.actual_role === "dean";
  }
  if (selectedRole === "pseudo-dean") {
    return row.pseudo_role === "dean" && (row.actual_role === "admin" || row.actual_role === "coordinator");
  }
  if (selectedRole === "hod") {
    return row.pseudo_role === "hod" || row.actual_role === "hod";
  }
  if (selectedRole === "pseudo-hod") {
    return row.pseudo_role === "hod" && (row.actual_role === "admin" || row.actual_role === "coordinator");
  }
  if (selectedRole === "instructor") {
    return row.pseudo_role === "instructor" || row.actual_role === "instructor";
  }
  if (selectedRole === "wellbeing-staff") {
    return (
      row.pseudo_role === "wellbeing-head" ||
      row.pseudo_role === "wellbeing-counseller" ||
      row.actual_role === "wellbeing-head" ||
      row.actual_role === "wellbeing-counseller"
    );
  }
  return true;
}

export function StaffDirectoryPanelClient({
  staff,
  faculties,
  departments,
  scopedFacultyId,
  readOnly = false,
}: {
  staff: StaffListRow[];
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  /** When set, directory is limited to this parent faculty (faculty filter hidden). */
  scopedFacultyId?: string | null;
  /** Hide add/edit/delete (dean view). */
  readOnly?: boolean;
}) {
  const [selectedFaculty, setSelectedFaculty] = useState<string>(
    () => scopedFacultyId ?? "all"
  );

  useEffect(() => {
    if (scopedFacultyId) setSelectedFaculty(scopedFacultyId);
  }, [scopedFacultyId]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<RoleFilterValue>("all");
  const [search, setSearch] = useState<string>("");

  const filteredDepartments = useMemo(() => {
    if (selectedFaculty === "all") return departments;
    return departments.filter((d) => d.faculty_id === selectedFaculty);
  }, [departments, selectedFaculty]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((row) => {
      const matchFaculty = selectedFaculty === "all" || (row.faculty_id ?? "") === selectedFaculty;
      const rowDepartmentIds = row.department_ids ?? [];
      const matchDepartment = selectedDepartment === "all" || rowDepartmentIds.includes(selectedDepartment);
      const matchRole = matchesRoleFilter(row, selectedRole);
      const matchSearch =
        term.length === 0 ||
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        row.pernr.toLowerCase().includes(term);
      return matchFaculty && matchDepartment && matchRole && matchSearch;
    });
  }, [search, selectedDepartment, selectedFaculty, selectedRole, staff]);

  const stats = useMemo(() => {
    const byActualRole = filteredStaff.reduce((acc, s) => {
      const key = s.actual_role ?? "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pseudoDeanCount = filteredStaff.filter(
      (s) => s.pseudo_role === "dean" && (s.actual_role === "admin" || s.actual_role === "coordinator")
    ).length;
    const pseudoHodCount = filteredStaff.filter(
      (s) => s.pseudo_role === "hod" && (s.actual_role === "admin" || s.actual_role === "coordinator")
    ).length;
    const wellbeingStaffCount =
      (byActualRole["wellbeing-head"] || 0) + (byActualRole["wellbeing-counseller"] || 0);

    return {
      totalStaff: filteredStaff.length,
      superadminCount: byActualRole.superadmin || 0,
      deanCount: byActualRole.dean || 0,
      hodCount: byActualRole.hod || 0,
      pseudoDeanCount,
      pseudoHodCount,
      instructorCount: byActualRole.instructor || 0,
      wellbeingStaffCount,
    };
  }, [filteredStaff]);

  const roleOptions: { value: RoleFilterValue; label: string }[] = [
    { value: "all", label: "All Roles" },
    { value: "superadmin", label: "Superadmin (actual/pseudo)" },
    { value: "dean", label: "Dean (actual/pseudo)" },
    { value: "pseudo-dean", label: "Pseudo Dean" },
    { value: "hod", label: "HoD (actual/pseudo)" },
    { value: "pseudo-hod", label: "Pseudo HoD" },
    { value: "instructor", label: "Instructor (actual/pseudo)" },
    { value: "wellbeing-staff", label: "Wellbeing Staff (Head + Counsellor)" },
  ];

  const showFacultyFilter = !scopedFacultyId;

  return (
    <div className="space-y-4">
      <div
        className={`grid gap-3 md:grid-cols-2 ${showFacultyFilter ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
      >
        {showFacultyFilter && (
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
        )}

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
          onChange={(e) => setSelectedRole(e.target.value as RoleFilterValue)}
          className="h-11 rounded-lg border border-stroke bg-transparent px-3 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
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

      <StaffStatsCards stats={stats} activeRoleFilter={selectedRole} onRoleSelect={setSelectedRole} />

      <StaffDirectoryTableClient
        staff={filteredStaff}
        faculties={faculties}
        departments={departments}
        readOnly={readOnly}
      />
    </div>
  );
}
