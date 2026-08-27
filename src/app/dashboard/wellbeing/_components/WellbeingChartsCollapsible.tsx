"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function WellbeingChartsCollapsible({
  title,
  description,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-stroke dark:border-dark-3",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-dark-2"
        aria-expanded={open}
      >
        <span>
          <span className="text-sm font-semibold text-dark dark:text-white">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-dark-5 dark:text-dark-6">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-dark-5 transition-transform dark:text-dark-6",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-stroke px-3 py-3 dark:border-dark-3">{children}</div>
      ) : null}
    </div>
  );
}
