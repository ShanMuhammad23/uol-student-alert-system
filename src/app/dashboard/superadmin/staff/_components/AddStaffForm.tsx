"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { appToast } from "@/components/ui-elements/toast-client";
import type { CreateStaffResult } from "@/app/dashboard/superadmin/staff/create-staff-action";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";

type FacultyOption = {
  id: string;
  name: string;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type StaffRole =
  | "coordinator"
  | "admin";

type PseudoAccessRole =
  | "superadmin"
  | "dean"
  | "hod"
  | "instructor"
  | "wellbeing"
  | "wellbeing-head"
  | "wellbeing-counseller";

type AddStaffFormProps = {
  createStaff: (formData: FormData) => Promise<CreateStaffResult>;
  faculties: FacultyOption[];
  departments: DepartmentOption[];
};

export function AddStaffForm({
  createStaff,
  faculties,
  departments,
}: AddStaffFormProps) {
  const router = useRouter();
  const [actualRole, setActualRole] = useState<StaffRole>("admin");
  const [pseudoRole, setPseudoRole] = useState<PseudoAccessRole>("instructor");
  const [pending, setPending] = useState(false);
  const showDepartments = pseudoRole === "hod";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    try {
      const formData = new FormData(form);
      const result = await createStaff(formData);
      if (result.ok) {
        appToast.success("Staff added successfully.", {
          toastId: "staff-add-success",
        });
        router.refresh();
        const pwd = form.querySelector<HTMLInputElement>('input[name="password"]');
        if (pwd) pwd.value = "";
      } else {
        appToast.error(result.message, {
          toastId: `staff-add-error-${result.message}`,
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
    >
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
        <p className="text-xs text-dark-5 dark:text-slate-400">
          Must appear as an instructor in current enrollment data (same value as instructor PERNR on enrollments).
        </p>
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
        <label className="text-sm font-medium text-dark dark:text-white">Actual Role *</label>
        <select
          name="actual_role"
          required
          value={actualRole}
          onChange={(ev) => setActualRole(ev.target.value as StaffRole)}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
        >
          <option value="admin">admin</option>
          <option value="coordinator">coordinator</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Pseudo Role *</label>
        <select
          name="pseudo_role"
          required
          value={pseudoRole}
          onChange={(ev) => setPseudoRole(ev.target.value as PseudoAccessRole)}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
        >
          <option value="superadmin">superadmin</option>
          <option value="dean">dean</option>
          <option value="hod">hod</option>
          <option value="instructor">instructor</option>
          <option value="wellbeing">wellbeing</option>
          <option value="wellbeing-head">wellbeing-head</option>
          <option value="wellbeing-counseller">wellbeing-counseller</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">
          Parent Faculty *
        </label>
        <select
          name="faculty_id"
          required
          defaultValue=""
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
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add Staff"}
        </button>
      </div>
    </form>
  );
}
