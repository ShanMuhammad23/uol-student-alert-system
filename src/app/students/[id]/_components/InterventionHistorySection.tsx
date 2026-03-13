"use client";

import { useState, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InterventionFormWithAction } from "./InterventionFormWithAction";
import { cn } from "@/lib/utils";

type InterventionRecord = {
  id: string;
  date: string;
  outreach_mode: string;
  remarks: string;
  status: string;
};

const STATUS_STYLES: Record<string, { label: string; bg: string }> = {
  initiated: { label: "Initiated", bg: "#B5B126" },
  "in-progress": { label: "In-Progress", bg: "#DBBE0F" },
  referred: { label: "Referred", bg: "#9C5A99" },
  resolved: { label: "Resolved", bg: "#477061" },
};

function formatOutreachMode(mode: string): string {
  return mode.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

type Props = {
  interventions: InterventionRecord[];
  studentSapId: string;
};

export function InterventionHistorySection({ interventions, studentSapId }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Intervention History
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Interventions and follow-ups for this student
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-dark"
        >
          Add Intervention
        </button>
      </div>

      {interventions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stroke py-8 text-center text-sm text-gray-500 dark:border-dark-3 dark:text-gray-400">
          No interventions recorded yet. Click &quot;Add Intervention&quot; to add one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
          <Table>
            <TableHeader>
              <TableRow className="border-stroke dark:border-dark-3">
                <TableHead className="font-semibold text-dark dark:text-white">Date</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Mode</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Remarks</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interventions.map((int) => {
                const statusStyle = STATUS_STYLES[int.status] ?? { label: int.status, bg: "#94A3B8" };
                return (
                  <TableRow key={int.id} className="border-stroke dark:border-dark-3">
                    <TableCell className="text-dark dark:text-white">
                      <time dateTime={int.date}>
                        {new Date(int.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </time>
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {formatOutreachMode(int.outreach_mode)}
                    </TableCell>
                    <TableCell className="max-w-[280px] text-dark-6 dark:text-dark-5">
                      {int.remarks || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: statusStyle.bg }}
                      >
                        {statusStyle.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        onCancel={() => setOpen(false)}
        className={cn(
          "w-full max-w-lg rounded-xl border border-stroke bg-white p-0 shadow-xl dark:border-dark-3 dark:bg-gray-dark",
          "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
          "open:animate-in open:fade-in open:zoom-in-95 open:duration-200",
          "[&::backdrop]:bg-black/50"
        )}
      >
        <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
          <h4 className="text-lg font-semibold text-dark dark:text-white">
            Add Intervention
          </h4>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-dark-6 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <InterventionFormWithAction studentSapId={studentSapId} onSuccess={handleSuccess} />
        </div>
      </dialog>
    </div>
  );
}
