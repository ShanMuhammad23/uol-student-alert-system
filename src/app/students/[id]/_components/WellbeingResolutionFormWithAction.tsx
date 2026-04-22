"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recordDirectWellbeingCase,
  recordWellbeingCase,
} from "@/app/(home)/dashboard/intervention-actions";
import { ChevronUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

type Props = {
  studentSapId: string;
  onClose?: () => void;
  /** `direct` = external direct case from wellbeing (always external). */
  variant?: "resolution" | "direct";
};

type Category = "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
type WellbeingStatus = "open" | "closed";
type InterventionStatusUpdate = "unchanged" | "resolved";

const STATUS_OPTIONS = [
  { value: "initiated", label: "Initiated" },
  { value: "in-progress", label: "In-Progress" },
  { value: "referred", label: "Referred" },
  { value: "resolved", label: "Resolved" },
  { value: "no-action-required", label: "No Action Required" },
] as const;

type Assignee = { id: string; name: string; pernr: string | null; email: string };

export function WellbeingResolutionFormWithAction({
  studentSapId,
  onClose,
  variant = "resolution",
}: Props) {
  const router = useRouter();
  const dateId = useId();
  const statusId = useId();

  const isDirect = variant === "direct";

  const [category, setCategory] = useState<Category>("Counselling");
  const [wellbeingStatus, setWellbeingStatus] = useState<WellbeingStatus>("open");
  const [interventionStatusUpdate, setInterventionStatusUpdate] =
    useState<InterventionStatusUpdate>("unchanged");
  const [remarks, setRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [interventionStatus, setInterventionStatus] = useState("in-progress");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [initialFindings, setInitialFindings] = useState("");

  useEffect(() => {
    if (!isDirect) return;
    let cancelled = false;
    fetch("/api/wellbeing/assignees")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { assignees?: Assignee[] }) => {
        if (!cancelled) setAssignees(Array.isArray(body.assignees) ? body.assignees : []);
      })
      .catch(() => {
        if (!cancelled) setAssignees([]);
      })
      .finally(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDirect]);

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      await recordWellbeingCase(studentSapId, {
        category,
        wellbeingStatus,
        remarks,
        setInterventionResolved: interventionStatusUpdate === "resolved",
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

  const handleSubmitDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!reasonForVisit.trim()) {
      setMessage({ type: "error", text: "Reason for visit is required." });
      return;
    }

    setIsSaving(true);
    try {
      const defaultAssignee = assignees[0]?.id ?? "";
      await recordDirectWellbeingCase(studentSapId, {
        date,
        reasonForVisit,
        initialFindings,
        status: interventionStatus,
        assigneeStaffId: defaultAssignee || undefined,
      });
      setMessage({ type: "success", text: "Direct case recorded successfully." });
      router.refresh();
      onClose?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save direct case.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isDirect) {
    return (
      <form onSubmit={handleSubmitDirect} className="space-y-4">
        <p className="text-xs text-dark-6 dark:text-dark-5">
          Direct case — no course focus. Enrollment context is taken from the student&apos;s
          record.
        </p>

        <div>
          <label htmlFor={dateId} className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Date
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Reason for Visit
          </label>
          <textarea
            rows={3}
            value={reasonForVisit}
            onChange={(e) => setReasonForVisit(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Initial Findings and Current Situation
          </label>
          <textarea
            rows={4}
            value={initialFindings}
            onChange={(e) => setInitialFindings(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor={statusId} className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Status
          </label>
          <div className="relative">
            <select
              id={statusId}
              value={interventionStatus}
              onChange={(e) => setInterventionStatus(e.target.value)}
              required
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronUpIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-180" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save direct case"}
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
            className={cn(
              "text-sm",
              message.type === "success" ? "text-green-600" : "text-red-600"
            )}
          >
            {message.text}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmitResolution} className="space-y-4">
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

      <p className="text-xs text-dark-6 dark:text-dark-5">
        Counselling/Monitoring entries are mirrored into Intervention History. Flex (Academic/Financial)
        entries remain in Resolution Recommendations. Each save creates a new row.
      </p>

      <div>
        <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
          Intervention Status
        </label>
        <select
          value={interventionStatusUpdate}
          onChange={(e) =>
            setInterventionStatusUpdate(e.target.value as InterventionStatusUpdate)
          }
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
        >
          <option value="unchanged">Do not change</option>
          <option value="resolved">Set latest intervention to Resolved</option>
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
          className={
            message.type === "success" ? "text-sm text-green-600" : "text-sm text-red-600"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
