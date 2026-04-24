"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InterventionForm from "@/components/Forms/Intervention-Form";
import type {
  InterventionEmailData,
  InterventionFormData,
} from "@/components/Forms/Intervention-Form";
import {
  recordIntervention,
  recordInterventionEmail,
  recordWellbeingCase,
} from "@/app/(home)/dashboard/intervention-actions";

type Props = {
  studentSapId: string;
  studentName?: string | null;
  attendancePercent?: number | null;
  attendanceAlertLevel?: "warning" | "critical" | null;
  gpaPrevious?: number | null;
  gpaCurrent?: number | null;
  gpaDrop?: number | null;
  cgpaPrevious?: number | null;
  cgpaCurrent?: number | null;
  cgpaDrop?: number | null;
  senderName?: string | null;
  senderDesignation?: string | null;
  senderDepartment?: string | null;
  senderFaculty?: string | null;
  senderEmail?: string | null;
  focusedCourseId?: string | null;
  focusedSectionCode?: string | null;
  focusedEventPackageId?: string | null;
  focusedCourseTitle?: string | null;
  focusedClassType?: string | null;
  mode?: "intervention" | "wellbeing";
};

export function InterventionFormWithAction({
  studentSapId,
  studentName,
  attendancePercent,
  attendanceAlertLevel,
  gpaPrevious,
  gpaCurrent,
  gpaDrop,
  cgpaPrevious,
  cgpaCurrent,
  cgpaDrop,
  senderName,
  senderDesignation,
  senderDepartment,
  senderFaculty,
  senderEmail,
  focusedCourseId,
  focusedSectionCode,
  focusedEventPackageId,
  focusedCourseTitle,
  focusedClassType,
  mode = "intervention",
  onClose,
}: Props & { onClose?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (data: InterventionFormData) => {
    setError(null);
    setSuccess(null);
    try {
      if (mode === "wellbeing") {
        const wellbeingStatus =
          data.status === "resolved" || data.status === "no-action-required"
            ? "closed"
            : "open";
        await recordWellbeingCase(studentSapId, {
          category:
            data.interventionType === "gpa"
              ? "Flex (Academic)"
              : data.interventionType === "both"
                ? "Monitoring"
                : "Counselling",
          wellbeingStatus,
          remarks: data.remarks,
        });
        setSuccess("Wellbeing case added successfully.");
      } else {
        await recordIntervention(studentSapId, {
          date: data.date,
          interventionType: data.interventionType,
          outreachMode: data.outreachMode,
          remarks: data.remarks,
          status: data.status,
          focusedCourseId: focusedCourseId ?? null,
          focusedSectionCode: focusedSectionCode ?? null,
          focusedEventPackageId: focusedEventPackageId ?? null,
        });
        setSuccess("Intervention added successfully.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save intervention.");
    }
  };

  const handleSendEmail = async (data: InterventionEmailData) => {
    setError(null);
    setSuccess(null);
    try {
      await recordInterventionEmail(studentSapId, data);
      setSuccess("Email sent and logged successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email.");
    }
  };

  return (
    <div className="space-y-4">
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <InterventionForm
        onSubmit={handleSubmit}
        onSendEmail={handleSendEmail}
        onCancel={onClose}
        studentSapId={studentSapId}
        studentName={studentName}
        attendancePercent={attendancePercent}
        attendanceAlertLevel={attendanceAlertLevel}
        gpaPrevious={gpaPrevious}
        gpaCurrent={gpaCurrent}
        gpaDrop={gpaDrop}
        cgpaPrevious={cgpaPrevious}
        cgpaCurrent={cgpaCurrent}
        cgpaDrop={cgpaDrop}
        senderName={senderName}
        senderDesignation={senderDesignation}
        senderDepartment={senderDepartment}
        senderFaculty={senderFaculty}
        senderEmail={senderEmail}
        focusedCourseTitle={focusedCourseTitle}
        focusedClassType={focusedClassType}
        mode={mode}
      />
    </div>
  );
}
