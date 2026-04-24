"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentProfileLink } from "@/components/Tables/nested-students-table/StudentProfileLink";
import { DirectWellbeingCaseForm } from "@/app/dashboard.wellbeing/_components/DirectWellbeingCaseForm";
import type {
  WellbeingAssigneeOption,
  WellbeingHeadCaseListItem,
} from "@/lib/db/wellbeing-head-cases";
import { cn } from "@/lib/utils";

type Props = {
  referredCases: WellbeingHeadCaseListItem[];
  directCases: WellbeingHeadCaseListItem[];
  assignees: WellbeingAssigneeOption[];
};

type TabId = "referred" | "direct";

export function WellbeingCaseTabs({ referredCases, directCases, assignees }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("referred");
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [selectedById, setSelectedById] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const row of [...referredCases, ...directCases]) {
      if (row.assigneeStaffId) out[row.interventionId] = row.assigneeStaffId;
    }
    return out;
  });
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [showDirectCaseForm, setShowDirectCaseForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tabRows = useMemo(
    () => (activeTab === "referred" ? referredCases : directCases),
    [activeTab, referredCases, directCases]
  );

  const assignCase = (row: WellbeingHeadCaseListItem) => {
    const assigneeStaffId = selectedById[row.interventionId] ?? "";
    if (!assigneeStaffId) {
      setErrorById((prev) => ({ ...prev, [row.interventionId]: "Select a counsellor first." }));
      return;
    }
    setErrorById((prev) => ({ ...prev, [row.interventionId]: "" }));
    setPendingById((prev) => ({ ...prev, [row.interventionId]: true }));

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/wellbeing-head/cases/${encodeURIComponent(row.interventionId)}/assign`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigneeStaffId }),
          }
        );
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to assign case");
        }
        router.refresh();
      } catch (e) {
        setErrorById((prev) => ({
          ...prev,
          [row.interventionId]: e instanceof Error ? e.message : "Failed to assign case",
        }));
      } finally {
        setPendingById((prev) => ({ ...prev, [row.interventionId]: false }));
      }
    });
  };

  return (
    <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-stroke p-1 dark:border-dark-3">
            <button
              type="button"
              onClick={() => setActiveTab("referred")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                activeTab === "referred"
                  ? "bg-primary text-white"
                  : "text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-dark-2"
              )}
            >
              Referred Cases ({referredCases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                activeTab === "direct"
                  ? "bg-primary text-white"
                  : "text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-dark-2"
              )}
            >
              Direct Cases ({directCases.length})
            </button>
          </div>
          {activeTab === "direct" ? (
            <button
              type="button"
              onClick={() => setShowDirectCaseForm((prev) => !prev)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              {showDirectCaseForm ? "Hide Add Direct Case" : "Add Direct Case"}
            </button>
          ) : null}
        </div>
      </div>
      {activeTab === "direct" && showDirectCaseForm ? (
        <div className="mb-4">
          <DirectWellbeingCaseForm returnToUrl="/dashboard/wellbeing/admin" />
        </div>
      ) : null}

      {tabRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stroke py-6 text-center text-sm text-dark-6 dark:border-dark-3 dark:text-white">
          No {activeTab} cases available.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
          <Table>
            <TableHeader>
              <TableRow className="border-stroke dark:border-dark-3">
                <TableHead>Student</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Degree</TableHead>
                <TableHead>Attendance %</TableHead>
                <TableHead>GPA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Assignee</TableHead>
                <TableHead>Assign Counsellor</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabRows.map((row) => {
                const statusLabel = row.status === "resolved" ? "Resolved" : "Open";
                const currentAssignee = row.assigneeName
                  ? `${row.assigneeName}${row.assigneePernr ? ` (${row.assigneePernr})` : ""}`
                  : "Unassigned";
                const isRowPending = Boolean(pendingById[row.interventionId]) || isPending;
                return (
                  <TableRow key={row.interventionId} className="border-stroke dark:border-dark-3">
                    <TableCell className="font-medium text-dark dark:text-white">
                      <StudentProfileLink
                        sapId={row.studentSapId}
                        returnToUrl="/dashboard/wellbeing/admin"
                        className="flex flex-col gap-1"
                        title="View profile"
                      >
                        <span className="text-sm font-medium text-green-500">{row.studentName}</span>
                        <span className="text-xs text-[#1f4a3d] dark:text-white">
                          SAPID: {row.studentSapId}
                        </span>
                      </StudentProfileLink>
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {row.facultyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {row.departmentName?.replace("Department of", "").trim() || "—"}
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">{row.programTitle ?? "—"}</TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {typeof row.attendancePercentage === "number" ? (
                        <span>
                          {row.attendancePercentage.toFixed(1)}%
                          {typeof row.classesAttended === "number" &&
                          typeof row.attendanceMarkedClasses === "number"
                            ? ` (${row.classesAttended}/${row.attendanceMarkedClasses})`
                            : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">
                      {typeof row.gpaCurrent === "number" ? row.gpaCurrent.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
                          row.status === "resolved" ? "bg-green-600" : "bg-amber-600"
                        )}
                      >
                        {statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-dark dark:text-white">{currentAssignee}</TableCell>
                    <TableCell>
                      <select
                        value={selectedById[row.interventionId] ?? ""}
                        onChange={(e) =>
                          setSelectedById((prev) => ({
                            ...prev,
                            [row.interventionId]: e.target.value,
                          }))
                        }
                        className="w-full min-w-[220px] rounded-md border border-stroke bg-white px-2 py-1.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      >
                        <option value="">Select counsellor</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.name}
                            {assignee.pernr ? ` (${assignee.pernr})` : ""}
                          </option>
                        ))}
                      </select>
                      {errorById[row.interventionId] ? (
                        <p className="mt-1 text-xs text-red-600">{errorById[row.interventionId]}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => assignCase(row)}
                        disabled={isRowPending}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRowPending ? "Assigning..." : "Assign"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
