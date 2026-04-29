"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minimize2 } from "lucide-react";

type Props = {
  title?: string;
  children: (isExpanded: boolean) => ReactNode;
};

export function ChipSectionExpand({ title = "", children }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const layoutId = useId();

  useEffect(() => {
    if (!isExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isExpanded]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-chip-expand-trigger
        onClick={() => setIsExpanded(true)}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <motion.div layoutId={layoutId}>{children(false)}</motion.div>

      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            className="fixed inset-0 z-[120] bg-black/45 p-4 backdrop-blur-[2px] md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              layoutId={layoutId}
              className="mx-auto flex h-full w-full  flex-col rounded-xl border border-stroke bg-white p-4 shadow-2xl dark:border-dark-3 dark:bg-gray-dark"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-dark dark:text-white">{title}</h3>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-stroke px-2 py-1 text-xs font-medium text-dark-6 transition hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white"
                  aria-label={`Minimize ${title}`}
                  title={`Minimize ${title}`}
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Minimize
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1 w-full">{children(true)}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

