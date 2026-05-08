"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { appToast } from "@/components/ui-elements/toast-client";
import type {
  CreateStaffResult,
  StaffFieldValidationResult,
} from "@/app/dashboard/superadmin/staff/create-staff-action";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import {
  FORM_PSEUDO_ROLE_OPTIONS,
  clampActualFormValueToPseudo,
  getActualRoleFormOptionsForPseudo,
  normalizeActualRoleFromForm,
  type StoredPseudoRole,
} from "@/lib/staff-role-rules";

type FacultyOption = {
  id: string;
  name: string;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type AddStaffFormProps = {
  createStaff: (formData: FormData) => Promise<CreateStaffResult>;
  validateStaffFields: (
    email: string,
    pernr: string
  ) => Promise<StaffFieldValidationResult>;
  faculties: FacultyOption[];
  departments: DepartmentOption[];
};

export function AddStaffForm({
  createStaff,
  validateStaffFields,
  faculties,
  departments,
}: AddStaffFormProps) {
  const router = useRouter();
  const [pseudoRole, setPseudoRole] = useState<StoredPseudoRole | "">("");
  const [actualRole, setActualRole] = useState<string>("");
  const [email, setEmail] = useState("");
  const [pernr, setPernr] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pernrError, setPernrError] = useState<string | null>(null);
  const [pernrWarning, setPernrWarning] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [pernrChecking, setPernrChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const hasPseudoRole = pseudoRole !== "";

  const actualOptions = useMemo(() => {
    if (!pseudoRole) return [];
    return getActualRoleFormOptionsForPseudo(pseudoRole);
  }, [pseudoRole]);

  const showDepartments = pseudoRole === "hod";

  async function handleEmailBlur() {
    const value = email.trim().toLowerCase();
    if (!value) {
      setEmailError(null);
      return;
    }
    setEmailChecking(true);
    try {
      const result = await validateStaffFields(value, pernr);
      setEmailError(
        result.emailDuplicate
          ? "This email is already assigned to an existing staff member."
          : null
      );
    } finally {
      setEmailChecking(false);
    }
  }

  async function handlePernrBlur() {
    const value = pernr.trim();
    if (!value) {
      setPernrError(null);
      setPernrWarning(null);
      return;
    }
    setPernrChecking(true);
    try {
      const result = await validateStaffFields(email, value);
      setPernrError(
        result.pernrDuplicate
          ? "This PERNR is already assigned to an existing staff member."
          : null
      );
      setPernrWarning(
        result.pernrInEnrollment === false
          ? "PERNR not found in enrollment data. You can still continue, but this should be reviewed."
          : null
      );
    } finally {
      setPernrChecking(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    if (!pseudoRole) {
      appToast.error("Please select a pseudo role first.", {
        toastId: "staff-add-pseudo-required",
      });
      return;
    }
    const normalizedActual = normalizeActualRoleFromForm(actualRole);
    if (!normalizedActual || !actualOptions.some((o) => o.value === actualRole)) {
      appToast.error("Please select a valid actual role for this pseudo role.", {
        toastId: "staff-add-actual-required",
      });
      return;
    }
    if (emailError || pernrError) {
      appToast.error("Please resolve email/PERNR validation errors before submitting.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData(form);
      formData.set("pseudo_role", pseudoRole);
      formData.set("actual_role", actualRole);

      let result = await createStaff(formData);

      if (!result.ok && result.code === "enrollment_mismatch") {
        const confirmed = window.confirm(
          `${result.message}\n\nDo you want to add this staff member anyway?`
        );
        if (confirmed) {
          formData.set("skip_enrollment_check", "1");
          result = await createStaff(formData);
        } else {
          setPending(false);
          return;
        }
      }

      if (!result.ok) {
        appToast.error(result.message, {
          toastId: `staff-add-error-${result.message}`,
        });
        return;
      }

      appToast.success("Staff added successfully.", {
        toastId: "staff-add-success",
      });
      router.refresh();
      const pwd = form.querySelector<HTMLInputElement>('input[name="password"]');
      if (pwd) pwd.value = "";
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
          value={email}
          onChange={(ev) => {
            setEmail(ev.target.value);
            if (emailError) setEmailError(null);
          }}
          onBlur={handleEmailBlur}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="name@uol.edu.pk"
        />
        {emailChecking ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Checking email...</p>
        ) : null}
        {emailError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{emailError}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Pernr *</label>
        <input
          name="pernr"
          required
          value={pernr}
          onChange={(ev) => {
            setPernr(ev.target.value);
            if (pernrError) setPernrError(null);
            if (pernrWarning) setPernrWarning(null);
          }}
          onBlur={handlePernrBlur}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
          placeholder="e.g. 00016932"
        />
        {pernrChecking ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Checking PERNR...</p>
        ) : null}
        {pernrError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{pernrError}</p>
        ) : null}
        {pernrWarning ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{pernrWarning}</p>
        ) : null}
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
        <label className="text-sm font-medium text-dark dark:text-white">Pseudo Role *</label>
        <select
          required
          value={pseudoRole}
          onChange={(ev) => {
            const v = ev.target.value;
            if (v === "") {
              setPseudoRole("");
              setActualRole("");
              return;
            }
            const next = v as StoredPseudoRole;
            setPseudoRole(next);
            setActualRole((prev) => clampActualFormValueToPseudo(next, prev));
          }}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark"
        >
          <option value="">Select pseudo role first</option>
          {FORM_PSEUDO_ROLE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-dark-5 dark:text-slate-400">
          Choose how this account appears in the system; actual permissions follow next.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-dark dark:text-white">Actual Role *</label>
        <select
          required={hasPseudoRole}
          disabled={actualOptions.length === 0}
          value={actualRole}
          onChange={(ev) => setActualRole(ev.target.value)}
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-3 dark:bg-gray-dark"
        >
          {!hasPseudoRole ? (
            <option value="">Select pseudo role first</option>
          ) : (
            actualOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          )}
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
          disabled={pending || !hasPseudoRole || Boolean(emailError || pernrError)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add Staff"}
        </button>
      </div>
    </form>
  );
}
