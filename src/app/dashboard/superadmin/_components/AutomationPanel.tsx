"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import type { EtlRunRow } from "@/lib/etl-run-types";
import type {
  MissingAttendanceReminderEmailLog,
  MissingAttendanceReminderRunLog,
} from "@/lib/missing-attendance-reminder-log-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AutomationStatus = {
  isRunning: boolean;
  lastUpdateAt: string | null;
};

type Props = {
  showLogs?: boolean;
};

type LogTab = "etl" | "missing-attendance";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rem}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function EtlStatusBadge({ status }: { status: EtlRunRow["status"] }) {
  const styles: Record<EtlRunRow["status"], string> = {
    running:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    partial:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

function MaRunStatusBadge({
  status,
}: {
  status: MissingAttendanceReminderRunLog["status"];
}) {
  const styles: Record<MissingAttendanceReminderRunLog["status"], string> = {
    running:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    success:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}

function MaEmailStatusBadge({
  status,
}: {
  status: MissingAttendanceReminderEmailLog["status"];
}) {
  const styles: Record<MissingAttendanceReminderEmailLog["status"], string> = {
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    dry_run:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    skipped_no_email:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    skipped_duplicate_instructor:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        styles[status]
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function AutomationPanel({ showLogs = false }: Props) {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    lastUpdateAt: null,
  });
  const [activeTab, setActiveTab] = useState<LogTab>("etl");
  const [etlRuns, setEtlRuns] = useState<EtlRunRow[]>([]);
  const [maRuns, setMaRuns] = useState<MissingAttendanceReminderRunLog[]>([]);
  const [expandedEtlRunId, setExpandedEtlRunId] = useState<number | null>(null);
  const [expandedMaRunId, setExpandedMaRunId] = useState<number | null>(null);
  const [maEmailsByRunId, setMaEmailsByRunId] = useState<
    Record<number, MissingAttendanceReminderEmailLog[]>
  >({});
  const [maEmailsLoadingId, setMaEmailsLoadingId] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/superadmin/automation/status", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load automation status");
    const body = (await res.json()) as AutomationStatus;
    setStatus(body);
  }, []);

  const loadEtlRuns = useCallback(async () => {
    if (!showLogs) return;
    const res = await fetch("/api/superadmin/automation/etl-runs?limit=50", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load ETL runs");
    const body = (await res.json()) as { runs: EtlRunRow[] };
    setEtlRuns(Array.isArray(body.runs) ? body.runs : []);
  }, [showLogs]);

  const loadMaRuns = useCallback(async () => {
    if (!showLogs) return;
    const res = await fetch(
      "/api/superadmin/automation/missing-attendance-runs?limit=50",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to load missing attendance runs");
    const body = (await res.json()) as {
      runs: MissingAttendanceReminderRunLog[];
    };
    setMaRuns(Array.isArray(body.runs) ? body.runs : []);
  }, [showLogs]);

  const loadMaEmails = useCallback(async (runId: number) => {
    setMaEmailsLoadingId(runId);
    try {
      const res = await fetch(
        `/api/superadmin/automation/missing-attendance-runs/${runId}/emails`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load reminder emails");
      const body = (await res.json()) as {
        emails: MissingAttendanceReminderEmailLog[];
      };
      setMaEmailsByRunId((prev) => ({
        ...prev,
        [runId]: Array.isArray(body.emails) ? body.emails : [],
      }));
    } catch {
      setMaEmailsByRunId((prev) => ({ ...prev, [runId]: [] }));
    } finally {
      setMaEmailsLoadingId(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadStatus(), loadEtlRuns(), loadMaRuns()]);
    } catch {
      setMessage("Unable to load automation state.");
    } finally {
      setIsLoading(false);
    }
  }, [loadEtlRuns, loadMaRuns, loadStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadStatus();
      if (showLogs) {
        void loadEtlRuns();
        void loadMaRuns();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [loadEtlRuns, loadMaRuns, loadStatus, showLogs]);

  const toggleMaRun = async (runId: number) => {
    if (expandedMaRunId === runId) {
      setExpandedMaRunId(null);
      return;
    }
    setExpandedMaRunId(runId);
    if (!maEmailsByRunId[runId]) {
      await loadMaEmails(runId);
    }
  };

  const runNow = async () => {
    setIsRunningNow(true);
    setMessage(null);
    try {
      const res = await fetch("/api/superadmin/automation/run", {
        method: "POST",
      });
      const body = (await res.json()) as { message?: string };
      setMessage(body.message ?? (res.ok ? "Run started." : "Run failed."));
      await refresh();
    } catch {
      setMessage("Failed to start ETL run.");
    } finally {
      setIsRunningNow(false);
    }
  };

  return (
    <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dark dark:text-white">
            Automation
          </h2>
          <p className="text-sm text-dark-5 dark:text-dark-6">
            Last alert snapshot update:{" "}
            {status.lastUpdateAt
              ? new Date(status.lastUpdateAt).toLocaleString()
              : "No snapshot found"}
          </p>
          <p
            className={cn(
              "text-sm mt-1",
              status.isRunning
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400"
            )}
          >
            {status.isRunning ? "ETL is running" : "ETL is idle"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-stroke px-3 py-2 text-sm dark:border-dark-3"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={runNow}
            disabled={isRunningNow || status.isRunning}
            className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary disabled:opacity-60"
          >
            {isRunningNow ? "Starting..." : "Run Daily ETL"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-dark-2">
          {message}
        </p>
      ) : null}

      {showLogs ? (
        <div className="rounded-md border border-stroke dark:border-dark-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke px-3 py-2 dark:border-dark-3">
            <div
              role="tablist"
              aria-label="Automation log tabs"
              className="flex flex-wrap gap-1"
            >
              {(
                [
                  { id: "etl", label: "ETL Runs" },
                  {
                    id: "missing-attendance",
                    label: "Missing Attendance Reminders",
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-white"
                      : "text-dark-5 hover:bg-gray-50 dark:text-dark-6 dark:hover:bg-dark-2"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-dark-5 dark:text-dark-6">
              {activeTab === "etl" ? (
                <>
                  From <code className="text-[11px]">etl_runs</code>
                  {etlRuns.length ? ` · ${etlRuns.length} recent` : null}
                </>
              ) : (
                <>
                  From{" "}
                  <code className="text-[11px]">
                    missing_attendance_reminder_runs
                  </code>
                  {maRuns.length ? ` · ${maRuns.length} recent` : null}
                </>
              )}
            </div>
          </div>

          {activeTab === "etl" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">ID</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-dark-5 dark:text-dark-6"
                      >
                        Loading ETL runs...
                      </TableCell>
                    </TableRow>
                  ) : etlRuns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-dark-5 dark:text-dark-6"
                      >
                        No ETL runs found in{" "}
                        <code className="text-xs">etl_runs</code> yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    etlRuns.map((run) => {
                      const isExpanded = expandedEtlRunId === run.id;
                      return (
                        <Fragment key={run.id}>
                          <TableRow>
                            <TableCell className="font-mono text-xs">
                              {run.id}
                            </TableCell>
                            <TableCell className="font-medium">
                              {run.pipelineName}
                            </TableCell>
                            <TableCell>
                              <EtlStatusBadge status={run.status} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(run.startedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(run.completedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDuration(run.startedAt, run.completedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedEtlRunId(
                                    isExpanded ? null : run.id
                                  )
                                }
                                className="rounded border border-stroke px-2 py-1 text-xs dark:border-dark-3"
                              >
                                {isExpanded ? "Hide log" : "View log"}
                              </button>
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="bg-gray-50 p-0 dark:bg-dark-2"
                              >
                                <div className="space-y-2 p-3">
                                  <div className="flex flex-wrap gap-3 text-xs text-dark-5 dark:text-dark-6">
                                    <span>
                                      Enrollment:{" "}
                                      {run.sourceRowsEnrollment.toLocaleString()}
                                    </span>
                                    <span>
                                      Attendance:{" "}
                                      {run.sourceRowsAttendance.toLocaleString()}
                                    </span>
                                    <span>
                                      Monitoring:{" "}
                                      {run.sourceRowsMonitoring.toLocaleString()}
                                    </span>
                                    <span>
                                      Current rows:{" "}
                                      {run.producedRowsCurrent.toLocaleString()}
                                    </span>
                                    <span>
                                      Daily rows:{" "}
                                      {run.producedRowsDaily.toLocaleString()}
                                    </span>
                                  </div>
                                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded border border-stroke bg-white p-3 text-xs leading-5 text-dark-5 dark:border-dark-3 dark:bg-gray-dark dark:text-dark-6">
                                    {run.errorMessage?.trim()
                                      ? run.errorMessage
                                      : "No log/error message stored for this run."}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">ID</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Snapshot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-10 text-center text-sm text-dark-5 dark:text-dark-6"
                      >
                        Loading missing attendance runs...
                      </TableCell>
                    </TableRow>
                  ) : maRuns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-10 text-center text-sm text-dark-5 dark:text-dark-6"
                      >
                        No missing attendance reminder runs found yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    maRuns.map((run) => {
                      const isExpanded = expandedMaRunId === run.id;
                      const emails = maEmailsByRunId[run.id] ?? [];
                      const emailsLoading = maEmailsLoadingId === run.id;
                      return (
                        <Fragment key={run.id}>
                          <TableRow>
                            <TableCell className="font-mono text-xs">
                              {run.id}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">
                                {resolveFacultyNameFromIdOrName(run.facultyId) ??
                                  run.facultyId}
                              </div>
                              <div className="font-mono text-[11px] text-dark-5 dark:text-dark-6">
                                {run.facultyId}
                              </div>
                              {run.dryRun ? (
                                <span className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                                  dry run
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {run.snapshotDate}
                            </TableCell>
                            <TableCell>
                              <MaRunStatusBadge status={run.status} />
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {run.candidatesCount}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {run.sentCount}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {run.skippedNoEmail + run.skippedDuplicate}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {run.failedCount}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(run.startedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <button
                                type="button"
                                onClick={() => void toggleMaRun(run.id)}
                                className="rounded border border-stroke px-2 py-1 text-xs dark:border-dark-3"
                              >
                                {isExpanded ? "Hide emails" : "View emails"}
                              </button>
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow>
                              <TableCell
                                colSpan={10}
                                className="bg-gray-50 p-0 dark:bg-dark-2"
                              >
                                <div className="space-y-2 p-3">
                                  {run.errorMessage?.trim() ? (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                      {run.errorMessage}
                                    </p>
                                  ) : null}
                                  {emailsLoading ? (
                                    <p className="text-sm text-dark-5 dark:text-dark-6">
                                      Loading emails...
                                    </p>
                                  ) : emails.length === 0 ? (
                                    <p className="text-sm text-dark-5 dark:text-dark-6">
                                      No email rows logged for this run.
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto rounded border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Instructor</TableHead>
                                            <TableHead>Course</TableHead>
                                            <TableHead>Recipient</TableHead>
                                            <TableHead>Missing</TableHead>
                                            <TableHead>Sent at</TableHead>
                                            <TableHead>Error</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {emails.map((email) => (
                                            <TableRow key={email.id}>
                                              <TableCell>
                                                <MaEmailStatusBadge
                                                  status={email.status}
                                                />
                                              </TableCell>
                                              <TableCell className="text-xs">
                                                <div className="font-medium">
                                                  {email.instructorName || "—"}
                                                </div>
                                                <div className="font-mono text-[11px] text-dark-5 dark:text-dark-6">
                                                  {email.instructorPernr || ""}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-xs">
                                                <div className="font-medium">
                                                  {email.courseCode || "—"}
                                                </div>
                                                <div className="text-[11px] text-dark-5 dark:text-dark-6">
                                                  {email.courseName || ""}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-xs">
                                                {email.recipientEmail || "—"}
                                                {email.ccRecipients ? (
                                                  <div className="text-[11px] text-dark-5 dark:text-dark-6">
                                                    CC: {email.ccRecipients}
                                                  </div>
                                                ) : null}
                                              </TableCell>
                                              <TableCell className="tabular-nums text-xs">
                                                {email.missingEntries}
                                              </TableCell>
                                              <TableCell className="whitespace-nowrap text-xs">
                                                {formatDateTime(email.sentAt)}
                                              </TableCell>
                                              <TableCell className="max-w-[220px] truncate text-xs text-red-600 dark:text-red-400">
                                                {email.errorMessage || "—"}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
