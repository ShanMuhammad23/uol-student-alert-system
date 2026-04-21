"use client";

import { useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const OUTREACH_MODES = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone-call", label: "Phone Call" },
  { value: "meeting", label: "Meeting" },
  { value: "not-applicable", label: "Not Applicable" },
] as const;

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateId = useId();
  const outreachId = useId();
  const typeId = useId();
  const statusId = useId();
  const assigneeId = useId();

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
  const [loadingAssignees, setLoadingAssignees] = useState(isDirect);
  const [assigneeStaffId, setAssigneeStaffId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [interventionType, setInterventionType] = useState<"attendance" | "gpa" | "both">(
    "attendance"
  );
  const [outreachMode, setOutreachMode] = useState("");
  const [interventionStatus, setInterventionStatus] = useState("in-progress");
  const [externalNotes, setExternalNotes] = useState("");

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
      .finally(() => {
        if (!cancelled) setLoadingAssignees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDirect]);

  const clearDirectCaseQuery = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("direct_case");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

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
    if (!assigneeStaffId.trim()) {
      setMessage({ type: "error", text: "Select a wellbeing assignee." });
      return;
    }
    if (!outreachMode) {
      setMessage({ type: "error", text: "Select an outreach mode." });
      return;
    }

    setIsSaving(true);
    try {
      await recordDirectWellbeingCase(studentSapId, {
        date,
        interventionType,
        outreachMode,
        remarks,
        status: interventionStatus,
        assigneeStaffId,
        externalNotes,
      });
      setMessage({ type: "success", text: "Direct case recorded successfully." });
      clearDirectCaseQuery();
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
          External direct case — no course focus. Enrollment context is taken from the student&apos;s
          record.
        </p>

        <div>
          <label
            htmlFor={assigneeId}
            className="mb-2 block text-sm font-medium text-dark dark:text-white"
          >
            Assignee (wellbeing handler)
          </label>
          <div className="relative">
            <select
              id={assigneeId}
              value={assigneeStaffId}
              onChange={(e) => setAssigneeStaffId(e.target.value)}
              required
              disabled={loadingAssignees}
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="">{loadingAssignees ? "Loading…" : "Select assignee"}</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.pernr ? ` (${a.pernr})` : ""}
                </option>
              ))}
            </select>
            <ChevronUpIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-180" />
          </div>
        </div>

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

        <div className="space-y-2">
          <span className="block text-sm font-medium text-dark dark:text-white">Type</span>
          <div id={typeId} className="flex flex-wrap gap-4">
            {(
              [
                ["attendance", "Attendance"],
                ["gpa", "GPA"],
                ["both", "Both"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="direct-intervention-type"
                  value={value}
                  checked={interventionType === value}
                  onChange={() => setInterventionType(value)}
                />
                <span className="text-sm text-dark dark:text-white">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={outreachId} className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Outreach mode
          </label>
          <div className="relative">
            <select
              id={outreachId}
              value={outreachMode}
              onChange={(e) => setOutreachMode(e.target.value)}
              required
              className="w-full appearance-none rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
            >
              <option value="" disabled hidden>
                Select mode
              </option>
              {OUTREACH_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronUpIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-180" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Remarks</label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            External notes (optional)
          </label>
          <textarea
            rows={2}
            value={externalNotes}
            onChange={(e) => setExternalNotes(e.target.value)}
            placeholder="Partner agency, referral reference, etc."
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor={statusId} className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Intervention status
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
