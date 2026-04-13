"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type AutomationStatus = {
  isRunning: boolean;
  lastUpdateAt: string | null;
};

type Props = {
  showLogs?: boolean;
};

export function AutomationPanel({ showLogs = false }: Props) {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    lastUpdateAt: null,
  });
  const [logs, setLogs] = useState<string[]>([]);
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

  const loadLogs = useCallback(async () => {
    if (!showLogs) return;
    const res = await fetch("/api/superadmin/automation/logs", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load automation logs");
    const body = (await res.json()) as { lines: string[] };
    setLogs(Array.isArray(body.lines) ? body.lines : []);
  }, [showLogs]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadStatus(), loadLogs()]);
    } catch {
      setMessage("Unable to load automation state.");
    } finally {
      setIsLoading(false);
    }
  }, [loadLogs, loadStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadStatus();
      if (showLogs) void loadLogs();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadLogs, loadStatus, showLogs]);

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
          <div className="border-b border-stroke px-3 py-2 text-sm font-medium dark:border-dark-3">
            Automation Logs
          </div>
          <pre className="max-h-[420px] overflow-auto p-3 text-xs leading-5 text-dark-5 dark:text-dark-6">
            {isLoading
              ? "Loading..."
              : logs.length
              ? logs.join("\n")
              : "No log entries yet."}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

