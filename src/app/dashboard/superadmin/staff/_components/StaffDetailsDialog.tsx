"use client";

import { useState } from "react";
import Image from "next/image";

type StaffDetails = {
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
  pseudoRole: "coordinator" | "admin" | null;
  pernr: string;
  facultyName: string;
  departments: string[];
};

type Props = {
  staff: StaffDetails;
};

export function StaffDetailsDialog({ staff }: Props) {
  const [open, setOpen] = useState(false);
  const shouldShowDepartments =
    (staff.role === "hod" || staff.role === "instructor") &&
    staff.departments.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-md px-1 py-1 text-left hover:bg-gray-2 dark:hover:bg-dark-3"
        aria-label={`View details for ${staff.name || "staff"}`}
      >
        <Image
          src={`/images/${staff.img ?? "user/user-placeholder.jpg"}`}
          alt={`Avatar of ${staff.name || "staff"}`}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
        <span className="min-w-0">
          <span className="block truncate">{staff.name || "—"}</span>
          <span className="block truncate text-xs font-normal text-dark-6">
            {staff.email || "—"}
          </span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-dark/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Staff details"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Image
                src={`/images/${staff.img ?? "user/user-placeholder.jpg"}`}
                alt={`Avatar of ${staff.name || "staff"}`}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover"
              />
              <div>
                <h3 className="text-lg font-semibold text-dark dark:text-white">
                  {staff.name || "—"}
                </h3>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary dark:bg-primary/20 dark:text-primary">
                  {staff.role}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                  Personal Details
                </p>
                <div className="mt-2 space-y-1 text-sm text-dark dark:text-white">
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">Email: </span>
                    {staff.email || "—"}
                  </p>
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">Pernr: </span>
                    {staff.pernr || "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                  Access Details
                </p>
                <div className="mt-2 space-y-1 text-sm text-dark dark:text-white">
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">Pseudo Role: </span>
                    {staff.role}
                  </p>
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">Actual Role: </span>
                    {staff.pseudoRole ?? "—"}
                  </p>
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">Parent Faculty: </span>
                    {staff.facultyName || "—"}
                  </p>
                  <p>
                    <span className="text-dark-5 dark:text-dark-6">
                      Departments:{" "}
                    </span>
                    {shouldShowDepartments ? staff.departments.join(", ") : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

