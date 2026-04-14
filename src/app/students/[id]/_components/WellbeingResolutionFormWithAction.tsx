"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordWellbeingCase } from "@/app/(home)/dashboard/intervention-actions";

type Props = {
  studentSapId: string;
  onClose?: () => void;
};

type Category = "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
type WellbeingStatus = "open" | "closed";

export function WellbeingResolutionFormWithAction({ studentSapId, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("Counselling");
  const [wellbeingStatus, setWellbeingStatus] = useState<WellbeingStatus>("open");
  const [remarks, setRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      await recordWellbeingCase(studentSapId, {
        category,
        wellbeingStatus,
        remarks,
      });
      setMessage({ type: "success", text: "Wellbeing resolution added successfully." });
      router.refresh();
      onClose?.();
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to save wellbeing resolution.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
        >
          <option value="Counselling">Counselling</option>
          <option value="Monitoring">Monitoring</option>
          <option value="Flex (Academic)">Flex (Academic)</option>
          <option value="Flex (Financial)">Flex (Financial)</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
          Wellbeing Status
        </label>
        <select
          value={wellbeingStatus}
          onChange={(e) => setWellbeingStatus(e.target.value as WellbeingStatus)}
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
          Remarks
        </label>
        <textarea
          rows={4}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add wellbeing notes..."
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Resolution"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark dark:border-dark-3 dark:text-white"
          >
            Cancel
          </button>
        )}
      </div>

      {message && (
        <p
          className={message.type === "success" ? "text-sm text-green-600" : "text-sm text-red-600"}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
