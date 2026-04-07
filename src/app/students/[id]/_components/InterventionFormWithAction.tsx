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
} from "@/app/(home)/dashboard/intervention-actions";

type Props = {
  studentSapId: string;
  studentName?: string | null;
  attendancePercent?: number | null;
  gpaPrevious?: number | null;
  gpaCurrent?: number | null;
  gpaDrop?: number | null;
  senderName?: string | null;
  senderDesignation?: string | null;
  senderDepartment?: string | null;
  senderFaculty?: string | null;
  senderEmail?: string | null;
};

export function InterventionFormWithAction({
  studentSapId,
  studentName,
  attendancePercent,
  gpaPrevious,
  gpaCurrent,
  gpaDrop,
  senderName,
  senderDesignation,
  senderDepartment,
  senderFaculty,
  senderEmail,
  onClose,
}: Props & { onClose?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (data: InterventionFormData) => {
    setError(null);
    setSuccess(null);
    try {
      await recordIntervention(studentSapId, {
        date: data.date,
        interventionType: data.interventionType,
        outreachMode: data.outreachMode,
        remarks: data.remarks,
        status: data.status,
      });
      setSuccess("Intervention added successfully.");
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
        gpaPrevious={gpaPrevious}
        gpaCurrent={gpaCurrent}
        gpaDrop={gpaDrop}
        senderName={senderName}
        senderDesignation={senderDesignation}
        senderDepartment={senderDepartment}
        senderFaculty={senderFaculty}
        senderEmail={senderEmail}
      />
    </div>
  );
}
