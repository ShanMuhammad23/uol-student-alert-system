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
import { WellbeingResolutionFormWithAction } from "./WellbeingResolutionFormWithAction";
import { cn } from "@/lib/utils";

type InterventionRecord = {
  id: string;
  date: string;
  intervention_type: "attendance" | "gpa" | "both";
  outreach_mode: string;
  remarks: string;
  status: string;
  performed_at?: string;
  uploader_name?: string | null;
  uploader_email?: string | null;
  uploader_pernr?: string | null;
};

type SentEmailRecord = {
  id: string;
  template_key: "sos_check_in" | "student_referral";
  subject: string;
  body_html?: string | null;
  recipient_email?: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_pernr: string | null;
  sent_at: string;
};

type WellbeingCaseRecord = {
  id: string;
  studentSapId: string;
  category: string;
  wellbeingStatus: "open" | "closed";
  remarks: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  staffName: string | null;
  staffPernr: string | null;
};

const STATUS_STYLES: Record<string, { label: string; bg: string }> = {
  initiated: { label: "Initiated", bg: "#B5B126" },
  "in-progress": { label: "In-Progress", bg: "#DBBE0F" },
  referred: { label: "Referred", bg: "#9C5A99" },
  resolved: { label: "Resolved", bg: "#477061" },
  "no-action-required": { label: "No Action Required", bg: "#64748B" },
};

function formatOutreachMode(mode: string): string {
  return mode.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function formatInterventionType(type: InterventionRecord["intervention_type"]): string {
  if (type === "gpa") return "GPA";
  if (type === "both") return "Both";
  return "Attendance";
}

type Props = {
  interventions: InterventionRecord[];
  wellbeingCases: WellbeingCaseRecord[];
  sentEmails: SentEmailRecord[];
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
  currentUserRole:
    | "superadmin"
    | "dean"
    | "hod"
    | "instructor"
    | "wellbeing"
    | null;
  currentUserPernr: string | null;
};

const EDIT_WINDOW_MS = 30 * 60 * 1000;

function canEditIntervention(
  intervention: InterventionRecord,
  role: Props["currentUserRole"],
  pernr: string | null
): boolean {
  if (!role) return false;
  if (role === "superadmin") return true;
  const uploaderPernr = String(intervention.uploader_pernr ?? "").trim();
  const sessionPernr = String(pernr ?? "").trim();
  if (!uploaderPernr || !sessionPernr || uploaderPernr !== sessionPernr) return false;
  const createdAtMs = new Date(intervention.performed_at ?? "").getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs <= EDIT_WINDOW_MS;
}

export function InterventionHistorySection({
  interventions,
  wellbeingCases,
  sentEmails,
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
  currentUserRole,
  currentUserPernr,
}: Props) {
  const canDelete = currentUserRole === "superadmin";
  const canAddIntervention = true;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(interventions);
  const [wellbeingRows, setWellbeingRows] = useState(wellbeingCases);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingWellbeingId, setEditingWellbeingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [wellbeingEditForm, setWellbeingEditForm] = useState<{
    category: "Counselling" | "Monitoring" | "Flex (Academic)" | "Flex (Financial)";
    wellbeingStatus: "open" | "closed";
    remarks: string;
  }>({
    category: "Counselling",
    wellbeingStatus: "open",
    remarks: "",
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [editForm, setEditForm] = useState({
    date: "",
    intervention_type: "attendance" as "attendance" | "gpa" | "both",
    outreach_mode: "email",
    remarks: "",
    status: "initiated",
  });
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  useEffect(() => {
    setRows(interventions);
  }, [interventions]);

  useEffect(() => {
    setWellbeingRows(wellbeingCases);
  }, [wellbeingCases]);

  const handleDelete = async (id: string) => {
    if (!canDelete) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/interventions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to delete intervention");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete intervention");
    } finally {
      setDeletingId(null);
    }
  };

  const beginEdit = (intervention: InterventionRecord) => {
    if (!canEditIntervention(intervention, currentUserRole, currentUserPernr)) return;
    setEditError(null);
    setEditingId(intervention.id);
    setEditForm({
      date: intervention.date,
      intervention_type: intervention.intervention_type,
      outreach_mode: intervention.outreach_mode || "email",
      remarks: intervention.remarks || "",
      status: intervention.status || "initiated",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const target = rows.find((r) => r.id === editingId);
      const res = await fetch(`/api/interventions/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          // Non-superadmin users cannot update remarks.
          remarks:
            currentUserRole === "superadmin"
              ? editForm.remarks
              : target?.remarks ?? editForm.remarks,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to update intervention");
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                date: editForm.date,
                intervention_type: editForm.intervention_type,
                outreach_mode: editForm.outreach_mode,
                remarks:
                  currentUserRole === "superadmin"
                    ? editForm.remarks
                    : r.remarks,
                status: editForm.status,
              }
            : r
        )
      );
      setEditingId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update intervention");
    } finally {
      setEditSaving(false);
    }
  };

  const beginWellbeingEdit = (row: WellbeingCaseRecord) => {
    setEditError(null);
    setEditingWellbeingId(row.id);
    setWellbeingEditForm({
      category: row.category as
        | "Counselling"
        | "Monitoring"
        | "Flex (Academic)"
        | "Flex (Financial)",
      wellbeingStatus: row.wellbeingStatus,
      remarks: row.remarks ?? "",
    });
  };

  const saveWellbeingEdit = async () => {
    if (!editingWellbeingId) return;
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/wellbeing-cases/${encodeURIComponent(editingWellbeingId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wellbeingEditForm),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to update wellbeing case");
      }
      setWellbeingRows((prev) =>
        prev.map((r) =>
          r.id === editingWellbeingId
            ? {
                ...r,
                category: wellbeingEditForm.category,
                wellbeingStatus: wellbeingEditForm.wellbeingStatus,
                remarks: wellbeingEditForm.remarks,
              }
            : r
        )
      );
      setEditingWellbeingId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update wellbeing case");
    } finally {
      setEditSaving(false);
    }
  };

  const downloadInterventionHistoryPdf = async () => {
    setEditError(null);
    setIsExportingPdf(true);
    try {
      const target = document.getElementById("student-profile-pdf-content");
      if (!target) {
        throw new Error("Student profile container not found.");
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imgWidth = pageWidth;
      const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, "", "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, "", "FAST");
        heightLeft -= pageHeight;
      }

      const safeSap = String(studentSapId || "student").replace(/[^\w-]/g, "_");
      pdf.save(`student-profile-${safeSap}.pdf`);
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Failed to download student profile PDF."
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isWellbeingView = currentUserRole === "wellbeing";
  const resolutionRows = wellbeingRows.filter(
    (wb) => wb.category === "Flex (Academic)" || wb.category === "Flex (Financial)"
  );

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-dark">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {isWellbeingView ? "Resolution Recommendations" : "Intervention History"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isWellbeingView
              ? "Wellbeing case tracking for this referred student"
              : "Interventions and follow-ups for this student"}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadInterventionHistoryPdf}
          disabled={isExportingPdf}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-dark"
        >
          {isExportingPdf ? "Preparing PDF..." : "Download PDF"}
        </button>
        {canAddIntervention && (
          <div className="flex items-center gap-2">
          <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-dark"
            >
            {isWellbeingView ? "Add Resolution" : "Add Intervention"}
            </button>
          </div>
        )}
      </div>

      {deleteError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {deleteError}
        </p>
      )}

      {isWellbeingView && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">
            Intervention History
          </h4>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stroke py-4 text-center text-sm text-gray-500 dark:border-dark-3 dark:text-gray-400">
              No interventions recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
              <Table>
                <TableHeader>
                  <TableRow className="border-stroke dark:border-dark-3">
                    <TableHead className="font-semibold text-dark dark:text-white">Date</TableHead>
                    <TableHead className="font-semibold text-dark dark:text-white">Type</TableHead>
                    <TableHead className="font-semibold text-dark dark:text-white">Mode</TableHead>
                    <TableHead className="font-semibold text-dark dark:text-white">Status</TableHead>
                    <TableHead className="font-semibold text-dark dark:text-white">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((int) => {
                    const statusStyle = STATUS_STYLES[int.status] ?? {
                      label: int.status,
                      bg: "#94A3B8",
                    };
                    return (
                      <TableRow key={`wb-int-${int.id}`} className="border-stroke dark:border-dark-3">
                        <TableCell className="text-dark dark:text-white">
                          <time dateTime={int.date}>
                            {new Date(int.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </time>
                        </TableCell>
                        <TableCell className="text-dark dark:text-white">
                          {formatInterventionType(int.intervention_type)}
                        </TableCell>
                        <TableCell className="text-dark dark:text-white">
                          {formatOutreachMode(int.outreach_mode)}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: statusStyle.bg }}
                          >
                            {statusStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[280px] text-dark-6 dark:text-dark-5">
                          {int.remarks || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {(isWellbeingView ? resolutionRows.length === 0 : rows.length === 0) ? (
        <p className="rounded-lg border border-dashed border-stroke py-8 text-center text-sm text-gray-500 dark:border-dark-3 dark:text-gray-400">
          {isWellbeingView
            ? "No resolution recommendations recorded yet. Flex (Academic/Financial) cases appear here."
            : "No interventions recorded yet. Click Add Intervention to add one."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
          <Table>
            <TableHeader>
              <TableRow className="border-stroke dark:border-dark-3">
                <TableHead className="font-semibold text-dark dark:text-white">
                  {isWellbeingView ? "Opened" : "Date"}
                </TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">
                  {isWellbeingView ? "Category" : "Type"}
                </TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">
                  {isWellbeingView ? "Resolved At" : "Mode"}
                </TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Remarks</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Status</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">Added By</TableHead>
                <TableHead className="font-semibold text-dark dark:text-white">
                  {isWellbeingView ? "Updated At" : "Emails"}
                </TableHead>
                <TableHead className="font-semibold text-dark dark:text-white text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isWellbeingView ? resolutionRows : rows).map((rowItem, idx) => {
                if (isWellbeingView) {
                  const wb = rowItem as WellbeingCaseRecord;
                  return (
                    <TableRow key={wb.id} className="border-stroke dark:border-dark-3">
                      <TableCell className="text-dark dark:text-white">
                        {new Date(wb.openedAt).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })}
                      </TableCell>
                      <TableCell className="text-dark dark:text-white">
                        {wb.category}
                      </TableCell>
                      <TableCell className="text-dark dark:text-white">
                        {wb.resolvedAt
                          ? new Date(wb.resolvedAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-dark-6 dark:text-dark-5">
                        {wb.remarks || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
                            wb.wellbeingStatus === "closed" ? "bg-green-600" : "bg-amber-600"
                          )}
                        >
                          {wb.wellbeingStatus === "closed" ? "Closed" : "Open"}
                        </span>
                      </TableCell>
                      <TableCell className="text-dark dark:text-white">
                        {wb.staffName ?? "—"}
                        {wb.staffPernr ? (
                          <span className="ml-1 text-xs text-dark-6 dark:text-dark-5">
                            ({wb.staffPernr})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-dark dark:text-white">
                        {new Date(wb.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => beginWellbeingEdit(wb)}
                          className="inline-flex items-center rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          Edit
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                }
                const int = rowItem as InterventionRecord;
                const statusStyle = STATUS_STYLES[int.status] ?? { label: int.status, bg: "#94A3B8" };
                const latestEmail = sentEmails[0];
                return (
                  <TableRow key={int.id} className="border-stroke dark:border-dark-3">
                    <TableCell className="text-dark dark:text-white">
                      <time dateTime={int.date}>
                        {new Date(int.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </time>
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {formatInterventionType(int.intervention_type)}
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
                    <TableCell className="text-dark dark:text-white">
                      <div className="flex flex-col">
                        <span>{int.uploader_name} - {int.uploader_pernr || "—"}</span>
                        <span className="text-xs text-dark-6 dark:text-dark-5">
                          {int.uploader_email || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {idx === 0 ? (
                        sentEmails.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">
                              {sentEmails.length} sent
                            </span>
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              {latestEmail.subject}
                            </span>
                            <span className="text-xs text-dark-6 dark:text-dark-5">
                              {new Date(latestEmail.sent_at).toLocaleString()}
                            </span>
                            <details className="rounded-md border border-stroke p-2 dark:border-dark-3">
                              <summary className="cursor-pointer text-xs font-medium text-primary">
                                View full sent emails
                              </summary>
                              <div className="mt-2 max-h-72 space-y-3 overflow-y-auto">
                                {sentEmails.map((email) => (
                                  <div
                                    key={email.id}
                                    className="rounded border border-stroke p-2 text-xs dark:border-dark-3"
                                  >
                                    <p className="font-semibold text-dark dark:text-white">
                                      {email.subject}
                                    </p>
                                    <p className="mt-1 text-dark-6 dark:text-dark-5">
                                      To: {email.recipient_email || "—"}
                                    </p>
                                    <p className="text-dark-6 dark:text-dark-5">
                                      From: {email.sender_email || "—"}
                                    </p>
                                    <p className="text-dark-6 dark:text-dark-5">
                                      Sent: {new Date(email.sent_at).toLocaleString()}
                                    </p>
                                    {email.body_html ? (
                                      <div
                                        className="mt-2 max-h-40 overflow-auto rounded border border-stroke bg-gray-50 p-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                        dangerouslySetInnerHTML={{ __html: email.body_html }}
                                      />
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ) : (
                          <span className="text-xs text-dark-6 dark:text-dark-5">No emails</span>
                        )
                      ) : (
                        <span className="text-xs text-dark-6 dark:text-dark-5">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {canEditIntervention(int, currentUserRole, currentUserPernr) && (
                          <button
                            type="button"
                            onClick={() => beginEdit(int)}
                            className="inline-flex items-center rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-900/20"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(int.id)}
                            disabled={deletingId === int.id}
                            className="inline-flex items-center rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            {deletingId === int.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
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
          "fixed left-1/2 top-1/2 z-[60] m-0 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stroke bg-white p-0 shadow-xl dark:border-dark-3 dark:bg-gray-dark",
          "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
          "open:animate-in open:fade-in open:zoom-in-95 open:duration-200",
          "[&::backdrop]:bg-black/50"
        )}
      >
        <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
          <h4 className="text-lg font-semibold text-dark dark:text-white">
            {isWellbeingView ? "Add Wellbeing Resolution" : "Add Intervention"}
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
          {isWellbeingView ? (
            <WellbeingResolutionFormWithAction
              studentSapId={studentSapId}
              onClose={() => setOpen(false)}
            />
          ) : (
            <InterventionFormWithAction
              mode="intervention"
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
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      </dialog>

      {editingId && (
        <dialog
          open
          onCancel={() => setEditingId(null)}
          className={cn(
            "fixed left-1/2 top-1/2 z-[70] m-0 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stroke bg-white p-0 shadow-xl dark:border-dark-3 dark:bg-gray-dark",
            "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
            "[&::backdrop]:bg-black/50"
          )}
        >
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h4 className="text-lg font-semibold text-dark dark:text-white">
              Edit Intervention
            </h4>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md p-1.5 text-dark-6 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="space-y-4 px-6 py-4">
            {editError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {editError}
              </p>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Date</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Type</label>
              <select
                value={editForm.intervention_type}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    intervention_type:
                      e.target.value === "gpa"
                        ? "gpa"
                        : e.target.value === "both"
                          ? "both"
                          : "attendance",
                  }))
                }
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
              >
                <option value="attendance">Attendance</option>
                <option value="gpa">GPA</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Mode</label>
              <select
                value={editForm.outreach_mode}
                onChange={(e) => setEditForm((prev) => ({ ...prev, outreach_mode: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone-call">Phone Call</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
              >
                <option value="initiated">Initiated</option>
                <option value="in-progress">In-Progress</option>
                <option value="referred">Referred</option>
                <option value="resolved">Resolved</option>
                <option value="no-action-required">No Action Required</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">Remarks</label>
              <textarea
                rows={4}
                value={editForm.remarks}
                disabled={currentUserRole !== "superadmin"}
                onChange={(e) => setEditForm((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-3 dark:text-white"
              />
              {currentUserRole !== "superadmin" && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Remarks can only be edited by superadmin.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md border border-stroke px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {editingWellbeingId && (
        <dialog
          open
          onCancel={() => setEditingWellbeingId(null)}
          className={cn(
            "fixed left-1/2 top-1/2 z-[70] m-0 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stroke bg-white p-0 shadow-xl dark:border-dark-3 dark:bg-gray-dark",
            "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
            "[&::backdrop]:bg-black/50"
          )}
        >
          <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h4 className="text-lg font-semibold text-dark dark:text-white">
              Edit Wellbeing Case
            </h4>
            <button
              type="button"
              onClick={() => setEditingWellbeingId(null)}
              className="rounded-md p-1.5 text-dark-6 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="space-y-4 px-6 py-4">
            {editError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {editError}
              </p>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Category
              </label>
              <select
                value={wellbeingEditForm.category}
                onChange={(e) =>
                  setWellbeingEditForm((prev) => ({
                    ...prev,
                    category: e.target.value as
                      | "Counselling"
                      | "Monitoring"
                      | "Flex (Academic)"
                      | "Flex (Financial)",
                  }))
                }
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
                value={wellbeingEditForm.wellbeingStatus}
                onChange={(e) =>
                  setWellbeingEditForm((prev) => ({
                    ...prev,
                    wellbeingStatus: e.target.value as "open" | "closed",
                  }))
                }
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
                value={wellbeingEditForm.remarks}
                onChange={(e) =>
                  setWellbeingEditForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-dark outline-none dark:border-dark-3 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingWellbeingId(null)}
                className="rounded-md border border-stroke px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveWellbeingEdit}
                disabled={editSaving}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {!isWellbeingView && (
        <div className="mt-6 rounded-lg border border-stroke dark:border-dark-3">
          <div className="border-b border-stroke px-4 py-3 dark:border-dark-3">
            <h4 className="text-base font-semibold text-dark dark:text-white">
              Wellbeing Resolution Records
            </h4>
          </div>
          {resolutionRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
              No wellbeing resolution records yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-stroke dark:border-dark-3">
                  <TableHead className="font-semibold text-dark dark:text-white">
                    Category
                  </TableHead>
                  <TableHead className="font-semibold text-dark dark:text-white">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-dark dark:text-white">
                    Remarks
                  </TableHead>
                  <TableHead className="font-semibold text-dark dark:text-white">
                    Updated At
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolutionRows.map((wb) => (
                  <TableRow key={wb.id} className="border-stroke dark:border-dark-3">
                    <TableCell className="text-dark dark:text-white">
                      {wb.category}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
                          wb.wellbeingStatus === "closed" ? "bg-green-600" : "bg-amber-600"
                        )}
                      >
                        {wb.wellbeingStatus === "closed" ? "Closed" : "Open"}
                      </span>
                    </TableCell>
                    <TableCell className="text-dark-6 dark:text-dark-5">
                      {wb.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {new Date(wb.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
