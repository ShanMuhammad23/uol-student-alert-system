"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertSnapshotTrendPoint } from "../fetch";
import { AlertSnapshotsLineChart } from "./AlertSnapshotsLineChart";

type Props = {
  points: AlertSnapshotTrendPoint[];
};

export function AlertSnapshotsCollapsible({ points }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-dark dark:text-white">
          Alert Snapshot Trend
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="mt-4"><AlertSnapshotsLineChart points={points} /></div> : null}
    </div>
  );
}
