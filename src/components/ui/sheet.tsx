"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2
              id="sheet-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
