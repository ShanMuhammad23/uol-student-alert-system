"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InterventionForm from "@/components/Forms/Intervention-Form";
import type { InterventionFormData } from "@/components/Forms/Intervention-Form";
import { recordIntervention } from "@/app/(home)/dashboard/intervention-actions";

type Props = { studentSapId: string };

export function InterventionFormWithAction({ studentSapId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (data: InterventionFormData) => {
    setError(null);
    setSuccess(null);
    try {
      await recordIntervention(studentSapId, {
        date: data.date,
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
      <InterventionForm onSubmit={handleSubmit} />
    </div>
  );
}
