"use client";

import { useEffect, useMemo, useState } from "react";

import { WellbeingChartClient } from "@/app/(home)/dashboard/_components/WellbeingChartClient";
import type {
  MasterFilterOptions,
  MasterFilterParams,
} from "@/app/(home)/dashboard/fetch";
import { TopChannelsTableClient } from "@/components/Tables/nested-students-table/TopChannelsTableClient";
import { WELLBEING_RESOLUTION_OPTIONS } from "@/lib/wellbeing-resolution-options";
import type { FilterDropdownCounts } from "@/lib/db/student-listing";
import { WellbeingMasterFilter } from "./WellbeingMasterFilter";
import { DirectWellbeingCaseForm } from "./DirectWellbeingCaseForm";

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
  const [activeTab, setActiveTab] = useState<"caseload" | "direct">("caseload");

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

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h1 className="text-2xl font-bold text-dark dark:text-white">
           Caseload
        </h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Referred cases and dDirect cases.
        </p>
        <div className="mt-4 inline-flex rounded-lg border border-stroke p-1 dark:border-dark-3">
          <button
            type="button"
            onClick={() => setActiveTab("caseload")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === "caseload"
                ? "bg-primary text-white"
                : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white"
            }`}
          >
            Referred
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === "direct"
                ? "bg-primary text-white"
                : "text-dark-6 hover:text-dark dark:text-white dark:hover:text-white"
            }`}
          >
            Direct
          </button>
        </div>
      </div>

      {activeTab === "direct" ? (
        <DirectWellbeingCaseForm
          returnToUrl={
            asWellbeingScope
              ? "/dashboard/wellbeing/counseller?as=wellbeing"
              : "/dashboard/wellbeing/counseller"
          }
        />
      ) : (
        <>
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

      <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <WellbeingChartClient title="Wellbeing Intervention & Resolution" />
      </div>
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
        returnToUrl={
          asWellbeingScope
            ? "/dashboard/wellbeing/counseller?as=wellbeing"
            : "/dashboard/wellbeing/counseller"
        }
        uniqueStudents
        masterFilter={masterFilter}
        resolutionFilters={resolutionFilters}
      />
        </>
      )}
    </div>
  );
}
