"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  /** Used for the student page "Back to list" link and return context. */
  returnToUrl: string;
};

/**
 * Minimal entry: SAP ID + open profile. Wellbeing direct cases are always external. Full form is on
 * the student page (`?direct_case=external`) — see WellbeingResolutionFormWithAction.
 */
export function DirectWellbeingCaseForm({ returnToUrl }: Props) {
  const router = useRouter();
  const [sap, setSap] = useState("");

  const openStudent = () => {
    const trimmed = String(sap).trim();
    if (!trimmed) return;
    const from = encodeURIComponent(returnToUrl);
    router.push(
      `/students/${encodeURIComponent(trimmed)}?from=${from}&direct_case=external`
    );
  };

  return (
    <div
      className={cn(
        "space-y-5 rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card"
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-dark dark:text-white">Direct case (external)</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Enter the student SAP ID and open their profile to log an external direct case (no focused
          course). Internal resolution by academic staff is separate and not logged here.
        </p>
      </div>

      <div>
        <label
          htmlFor="direct-case-sap"
          className="mb-2 block text-sm font-medium text-dark dark:text-white"
        >
          Student SAP ID
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            id="direct-case-sap"
            type="text"
            value={sap}
            onChange={(e) => setSap(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openStudent();
              }
            }}
            placeholder="e.g. 12345"
            className="w-full flex-1 rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          />
          <button
            type="button"
            onClick={openStudent}
            disabled={!String(sap).trim()}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open student
          </button>
        </div>
      </div>
    </div>
  );
}
