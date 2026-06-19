"use client";

import type { EiRating } from "@/lib/effectiveness-scoring";
import { EI_GRADE_LABELS } from "@/lib/ei-metric-definitions";
import { cn } from "@/lib/utils";

const RATING_STYLES: Record<EiRating, string> = {
  A: "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700",
  B: "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700",
  C: "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  D: "bg-red-100 text-red-800 ring-red-300 dark:bg-red-900/40 dark:text-red-100 dark:ring-red-700",
};

type Props = {
  rating: EiRating | null;
  score: number | null;
  dimensionLabel?: string | null;
};

export function EiScoreBadge({ rating, score, dimensionLabel }: Props) {
  if (rating == null || score == null) {
    return <span className="text-dark-6">—</span>;
  }

  const title = dimensionLabel
    ? `${EI_GRADE_LABELS[rating]} · ${dimensionLabel}`
    : EI_GRADE_LABELS[rating];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        RATING_STYLES[rating]
      )}
      title={title}
    >
      <span>{rating}</span>
      <span className="font-normal opacity-80">{score.toFixed(0)}</span>
    </span>
  );
}
