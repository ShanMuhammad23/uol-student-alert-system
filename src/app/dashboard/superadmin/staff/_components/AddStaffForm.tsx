"use client";

import { useState } from "react";

type FacultyOption = {
  id: string;
  name: string;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type StaffRole =
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeing-head"
  | "wellbeing-counseller";

type AddStaffFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  faculties: FacultyOption[];
  departments: DepartmentOption[];
};

export function AddStaffForm({
  action,
  faculties,
  departments,
}: AddStaffFormProps) {
  const [role, setRole] = useState<StaffRole>("instructor");
  const showDepartments = role === "hod";

  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Name *</label>
        <input
          name="name"
          required
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="Staff full name"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Email *</label>
        <input
          type="email"
          name="email"
          required
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="name@uol.edu.pk"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Pernr *</label>
        <input
          name="pernr"
          required
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="e.g. 00016932"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Password *</label>
        <input
          type="password"
          name="password"
          required
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="Set initial password"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Role *</label>
        <select
          name="role"
          required
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
        >
          <option value="superadmin">superadmin</option>
          <option value="dean">dean</option>
          <option value="hod">hod</option>
          <option value="instructor">instructor</option>
          <option value="wellbeing-head">wellbeing-head</option>
          <option value="wellbeing-counseller">wellbeing-counseller</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Faculty</label>
        <select
          name="faculty_id"
          defaultValue=""
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
        >
          <option value="">Select faculty (optional)</option>
          {faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.name}
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

      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Add Staff
        </button>
      </div>
    </form>
  );
}
