"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ReminderModalProps = {
  /** When true, the modal is shown (also requires non-empty HTML). */
  isVisible: boolean;
  /** HTML body rendered inside the modal. */
  reminderModalHtml?: string | null;
  /** CTA button label. Defaults to "Got it". */
  reminderModalCta?: string | null;
  /** Called when the user clicks the CTA (acknowledge / dismiss). */
  onCta?: () => void | Promise<void>;
  /** Called when the user clicks Close (also dismisses). */
  onClose?: () => void | Promise<void>;
  className?: string;
};

/**
 * Universal reminder modal. Pass any HTML + CTA label to show info to a user.
 * Can be driven from staff.is_visible / reminder_modal_html / reminder_modal_cta.
 */
export function ReminderModal({
  isVisible,
  reminderModalHtml,
  reminderModalCta,
  onCta,
  onClose,
  className,
}: ReminderModalProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const html = (reminderModalHtml ?? "").trim();
  const ctaLabel = (reminderModalCta ?? "").trim() || "Got it";

  useEffect(() => {
    setOpen(Boolean(isVisible && html));
  }, [isVisible, html]);

  if (!open || !html) return null;

  const dismiss = async (handler?: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await handler?.();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[1000] flex items-center justify-center bg-dark/50 px-4",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Reminder"
      onClick={() => void dismiss(onClose ?? onCta)}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="prose prose-sm max-w-none text-dark dark:prose-invert dark:text-white"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-5 flex justify-end gap-2">
          {onClose ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void dismiss(onClose)}
              className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void dismiss(onCta)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Saving..." : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReminderModalHostProps = {
  isVisible: boolean;
  reminderModalHtml: string | null;
  reminderModalCta: string | null;
};

/** Root host: shows DB-backed reminder; Close and CTA both set is_visible = false. */
export function ReminderModalHost({
  isVisible,
  reminderModalHtml,
  reminderModalCta,
}: ReminderModalHostProps) {
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  const dismissReminder = async () => {
    const res = await fetch("/api/reminder-modal/dismiss", { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to dismiss reminder");
    }
    setVisible(false);
  };

  return (
    <ReminderModal
      isVisible={visible}
      reminderModalHtml={reminderModalHtml}
      reminderModalCta={reminderModalCta}
      onClose={dismissReminder}
      onCta={dismissReminder}
    />
  );
}
