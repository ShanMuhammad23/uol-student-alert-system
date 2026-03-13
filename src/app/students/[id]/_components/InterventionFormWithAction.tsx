"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InterventionForm from "@/components/Forms/Intervention-Form";
import type { InterventionFormData } from "@/components/Forms/Intervention-Form";
import { recordIntervention } from "@/app/(home)/dashboard/intervention-actions";

type Props = { studentSapId: string; onSuccess?: () => void };

export function InterventionFormWithAction({ studentSapId, onSuccess }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: InterventionFormData) => {
    setError(null);
    try {
      await recordIntervention(studentSapId, {
        date: data.date,
        outreachMode: data.outreachMode,
        remarks: data.remarks,
        status: data.status,
      });
      router.refresh();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save intervention.");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <InterventionForm onSubmit={handleSubmit} />
    </div>
  );
}
