"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { DirectWellbeingCaseForm } from "@/app/dashboard.wellbeing/_components/DirectWellbeingCaseForm";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  returnToUrl: string;
};

export function WellbeingDashboardHeader({ title, description, returnToUrl }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition",
            showForm
              ? "border border-stroke bg-white text-dark hover:bg-gray-50 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              : "bg-primary text-white hover:bg-primary/90"
          )}
          aria-expanded={showForm}
        >
          {showForm ? (
            <>
              <X className="size-4" aria-hidden />
              Hide form
            </>
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              Add Direct Case
            </>
          )}
        </button>
      </div>
      {showForm ? <DirectWellbeingCaseForm returnToUrl={returnToUrl} /> : null}
    </div>
  );
}
