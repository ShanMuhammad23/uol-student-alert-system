"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dropdown, DropdownContent, DropdownTrigger, DropdownClose } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { recordStudentAction } from "@/app/(home)/dashboard/actions";
import type { StudentActionType, StudentActionResult } from "@/data/student-actions";
import type { Student } from "@/app/(home)/dashboard/fetch";

const ACTION_TYPES: { value: StudentActionType; label: string }[] = [
  { value: "sent_email", label: "Email" },
  { value: "made_call", label: "Phone Call" },
  { value: "inperson_meeting", label: "In-Person Meeting" },

];

type Props = {
  student: Student;
  /** Latest result from merged store (passed from server); falls back to client-side dummy data if omitted. */
  latestResult?: StudentActionResult | null;
};

function hasYellowOrRedAlert(student: Student): boolean {
  return (
    student.gpa.alert_level === "critical" ||
    student.gpa.alert_level === "warning" ||
    student.attendance.alert_level === "critical" ||
    student.attendance.alert_level === "warning"
  );
}

export function StudentActionDropdown({ student, latestResult: latestResultProp }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const showActionMenu = hasYellowOrRedAlert(student);
  const latestResult = latestResultProp ?? null;

  const handleSelectAction = async (actionType: StudentActionType) => {
    setIsOpen(false);
    setIsSubmitting(true);
    try {
      await recordStudentAction(student.sap_id, actionType);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {latestResult && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            latestResult === "improved"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          )}
          title="Latest action result"
        >
          {latestResult === "improved" ? "Improved" : "Escalated"}
        </span>
      )}
     
      {showActionMenu && (
        <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
          <span className={cn("inline-block", isSubmitting && "pointer-events-none opacity-50")}>
            <DropdownTrigger className="inline-flex items-center justify-center rounded-md border border-stroke bg-white px-2.5 py-1.5 text-sm font-medium text-dark hover:bg-gray-50 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-3">
            Actions
            <svg
              className="ml-1 h-4 w-4 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            </DropdownTrigger>
          </span>
          <DropdownContent align="end" className="overflow-hidden rounded-lg border border-stroke bg-white py-1 shadow-lg dark:border-dark-3 dark:bg-gray-dark">
            {ACTION_TYPES.map(({ value, label }) => (
              <DropdownClose key={value}>
                <button
                  type="button"
                  onClick={() => handleSelectAction(value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-dark-3"
                >
                  {label}
                </button>
              </DropdownClose>
            ))}
          </DropdownContent>
        </Dropdown>
      )}
    </div>
  );
}
