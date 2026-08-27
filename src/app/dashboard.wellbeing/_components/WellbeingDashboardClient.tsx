"use client";

import { useEffect, useMemo, useState } from "react";

import { WellbeingChartClient } from "@/app/(home)/dashboard/_components/WellbeingChartClient";
import type {
  MasterFilterOptions,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { WellbeingChartsCollapsible } from "@/app/dashboard/wellbeing/_components/WellbeingChartsCollapsible";
import { WellbeingDashboardHeader } from "@/app/dashboard/wellbeing/_components/WellbeingDashboardHeader";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { WELLBEING_RESOLUTION_OPTIONS } from "@/lib/wellbeing-resolution-options";
import type { FilterDropdownCounts } from "@/lib/db/student-listing";
import { WellbeingMasterFilter } from "./WellbeingMasterFilter";

type Props = {
  initialMasterFilter: MasterFilterParams;
  filterOptions: MasterFilterOptions;
  asWellbeingScope?: boolean;
};

function Card({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "green" | "purple";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600"
      : tone === "purple"
        ? "text-purple-600"
        : "text-dark dark:text-white";
  return (
    <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <p className="text-sm text-dark-5 dark:text-dark-6">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function WellbeingDashboardClient({
  initialMasterFilter,
  filterOptions,
  asWellbeingScope = false,
}: Props) {
  const [masterFilter, setMasterFilter] =
    useState<MasterFilterParams>(initialMasterFilter);
  const [resolutionFilters, setResolutionFilters] = useState<string[]>([]);
  const [counts, setCounts] = useState<FilterDropdownCounts | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/filter-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        filters: {
          ...(masterFilter ?? {}),
          resolutionFilters: resolutionFilters.length ? resolutionFilters : undefined,
        },
        ...(asWellbeingScope ? { roleScope: { role: "wellbeing" as const } } : {}),
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("counts"))))
      .then((body: FilterDropdownCounts) => {
        if (!controller.signal.aborted) setCounts(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCounts(null);
      });
    return () => controller.abort();
  }, [
    masterFilter.department_ids?.join(","),
    masterFilter.programs?.join(","),
    masterFilter.instructor_ids?.join(","),
    masterFilter.course_ids?.join(","),
    resolutionFilters.join(","),
  ]);

  const { openCases, closedCases } = useMemo(() => {
    if (!counts) return { openCases: 0, closedCases: 0 };
    let open = 0;
    let closed = 0;
    for (let idx = 0; idx < WELLBEING_RESOLUTION_OPTIONS.length; idx++) {
      const opt = WELLBEING_RESOLUTION_OPTIONS[idx];
      const n = Number(counts.wellbeing[idx] ?? 0);
      if (opt.closed) closed += n;
      else open += n;
    }
    return { openCases: open, closedCases: closed };
  }, [counts]);

  const returnToUrl = asWellbeingScope
    ? "/dashboard/wellbeing/counseller?as=wellbeing"
    : "/dashboard/wellbeing/counseller";

  return (
    <div className="mt-4 space-y-4">
      <WellbeingDashboardHeader
        title="Caseload"
        description="Review referred cases and log a direct case."
        returnToUrl={returnToUrl}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          label="Referred Cases"
          value={Number(counts?.intervention.referred ?? 0)}
          tone="purple"
        />
        <Card
          label="Resolved Cases"
          value={closedCases}
          tone="purple"
        />
        <Card label="Open Cases" value={openCases} tone="green" />
      </div>

      <WellbeingChartsCollapsible
        title="Wellbeing Intervention & Resolution"
        description="Open vs closed cases by resolution category"
        className="bg-white shadow-1 dark:bg-gray-dark dark:shadow-card"
      >
        <WellbeingChartClient title="Wellbeing Intervention & Resolution" />
      </WellbeingChartsCollapsible>
      <WellbeingMasterFilter
        options={filterOptions}
        current={masterFilter}
        resolutionFilters={resolutionFilters}
        asWellbeingScope={asWellbeingScope}
        onChangeMasterFilter={(updates) =>
          setMasterFilter((prev) => ({ ...prev, ...updates }))
        }
        onChangeResolutionFilters={setResolutionFilters}
      />
      <TopChannelsTableClient
        returnToUrl={returnToUrl}
        uniqueStudents
        masterFilter={masterFilter}
        resolutionFilters={resolutionFilters}
      />
    </div>
  );
}
