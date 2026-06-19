"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  FORM_PSEUDO_ROLE_OPTIONS,
  clampActualFormValueToPseudo,
  getActualRoleFormOptionsForPseudo,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";
import { appToast } from "@/components/ui-elements/toast-client";
import type { CreateStaffResult } from "@/app/dashboard/superadmin/staff/create-staff-action";

export const GRANT_ACCESS_DEFAULT_PASSWORD = "uol@1234";

type StaffRow = {
  pernr: string;
  name: string;
  email: string;
  faculty_id: string | null;
  department_ids: string[] | null;
};

type FacultyRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string; code: string | null; faculty_id: string | null };

type Props = {
  staff: StaffRow;
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  createStaff: (formData: FormData) => Promise<CreateStaffResult>;
  onClose: () => void;
};

export function GrantAccessDialog({
  staff,
  faculties,
  departments,
  createStaff,
  onClose,
}: Props) {
  const router = useRouter();
  const [pseudoRole, setPseudoRole] = useState<StoredPseudoRole>("instructor");
  const [actualRoleForm, setActualRoleForm] = useState(() => {
    const fallback = getActualRoleFormOptionsForPseudo("instructor")[0]?.value ?? "";
    return clampActualFormValueToPseudo("instructor", fallback);
  });
  const [isSaving, setIsSaving] = useState(false);

  const actualOptionsForPseudo = useMemo(
    () => getActualRoleFormOptionsForPseudo(pseudoRole),
    [pseudoRole]
  );

  const showDepartments = pseudoRole === "hod";
  const displayName = staff.name.trim() || "—";
  const displayEmail = staff.email.trim().toLowerCase();
  const displayPernr = staff.pernr.trim();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!displayName || displayName === "—") {
      appToast.error("Instructor name is missing in enrollment data.");
      return;
    }
    if (!displayEmail) {
      appToast.error("Instructor email is missing in enrollment data.");
      return;
    }
    if (!displayPernr) {
      appToast.error("PERNR is missing.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("name", displayName);
    formData.set("email", displayEmail);
    formData.set("pernr", displayPernr);
    formData.set("password", GRANT_ACCESS_DEFAULT_PASSWORD);
    formData.set("pseudo_role", pseudoRole);
    formData.set("actual_role", actualRoleForm);

    setIsSaving(true);
    try {
      let result = await createStaff(formData);

      if (!result.ok && result.code === "enrollment_mismatch") {
        const confirmed = window.confirm(
          `${result.message}\n\nDo you want to grant access anyway?`
        );
        if (confirmed) {
          formData.set("skip_enrollment_check", "1");
          result = await createStaff(formData);
        } else {
          return;
        }
      }

      if (!result.ok) {
        appToast.error(result.message, {
          toastId: `grant-access-error-${result.message}`,
        });
        return;
      }

      appToast.success("Staff access granted successfully.", {
        toastId: "grant-access-success",
      });
      onClose();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-dark/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Grant staff access"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-dark dark:text-white">Grant Access</h3>
            <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
              Set role and permissions. Account details are filled from enrollment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Close
          </button>
        </div>

        <div className="mb-5 rounded-lg border border-stroke bg-gray-2/50 p-4 dark:border-dark-3 dark:bg-dark-2/50">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
            Auto-filled from enrollment
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-dark-5 dark:text-dark-6">Name</dt>
              <dd className="font-medium text-dark dark:text-white">{displayName}</dd>
            </div>
            <div>
              <dt className="text-dark-5 dark:text-dark-6">Email</dt>
              <dd className="font-medium text-dark dark:text-white">
                {displayEmail || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-dark-5 dark:text-dark-6">PERNR</dt>
              <dd className="font-medium text-dark dark:text-white">{displayPernr || "—"}</dd>
            </div>
            <div>
              <dt className="text-dark-5 dark:text-dark-6">Initial password</dt>
              <dd className="font-medium text-dark dark:text-white">
                {GRANT_ACCESS_DEFAULT_PASSWORD}
              </dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-dark dark:text-white">Pseudo Role *</label>
            <select
              name="pseudo_role"
              required
              value={pseudoRole}
              onChange={(e) => {
                const next = e.target.value as StoredPseudoRole;
                setPseudoRole(next);
                setActualRoleForm((prev) => clampActualFormValueToPseudo(next, prev));
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
          <div className="flex flex-col gap-1 md:col-span-2">
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
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSaving ? "Granting access..." : "Grant Access"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
