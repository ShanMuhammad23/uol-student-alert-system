import type { WellbeingHeadDashboardData } from "@/lib/db/wellbeing-head-dashboard";
import { WellbeingChartsCollapsible } from "@/app/dashboard/wellbeing/_components/WellbeingChartsCollapsible";
import { WellbeingHeadStackedChart } from "./WellbeingHeadStackedChart";
import { WellbeingHeadStatCard } from "./WellbeingHeadStatCard";

type SectionMetrics = WellbeingHeadDashboardData["totalRecords"];

type WellbeingHeadSectionProps = {
  title: string;
  metrics: SectionMetrics;
  compact?: boolean;
  statMode?: "overall" | "referred" | "direct";
};

export function WellbeingHeadSection({
  title,
  metrics,
  compact = false,
  statMode = "overall",
}: WellbeingHeadSectionProps) {
  const statCards =
    statMode === "referred"
      ? [
          { label: "Referred", value: metrics.totals.totalCases, tone: "purple" as const },
          { label: "Resolved", value: metrics.totals.resolved, tone: "purple" as const },
          { label: "Open", value: metrics.totals.openCases, tone: "green" as const },
        ]
      : statMode === "direct"
      ? [
          { label: "Total Cases", value: metrics.totals.totalCases },
          { label: "Resolved", value: metrics.totals.resolved, tone: "purple" as const },
          { label: "Open", value: metrics.totals.openCases, tone: "green" as const },
        ]
      : [
          { label: "Total Cases", value: metrics.totals.totalCases },
          { label: "Resolved", value: metrics.totals.resolved, tone: "purple" as const },
          { label: "Open", value: metrics.totals.openCases, tone: "green" as const },
        ];

  return (
    <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h2 className="mb-3 text-xl font-semibold text-dark dark:text-white">{title}</h2>
      <div className="flex gap-4">
        {statCards.map((card) => (
          <WellbeingHeadStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            tone={card.tone}
          />
        ))}
      </div>
      <WellbeingChartsCollapsible
        title="Charts"
        description="Category-wise and counsellor-wise open vs closed cases"
        className="mt-4"
      >
        <div
          className={
            compact
              ? "space-y-4"
              : "space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0"
          }
        >
          <div className="rounded-[10px] border border-stroke p-3 dark:border-dark-3">
            <WellbeingHeadStackedChart
              title="All (Category-wise)"
              xAxis={metrics.categoryChart.categories}
              open={metrics.categoryChart.open}
              closed={metrics.categoryChart.closed}
            />
          </div>
          <div className="rounded-[10px] border border-stroke p-3 dark:border-dark-3">
            <WellbeingHeadStackedChart
              title="Counsellor-wise"
              xAxis={metrics.counsellorChart.counsellors}
              open={metrics.counsellorChart.open}
              closed={metrics.counsellorChart.closed}
            />
          </div>
        </div>
      </WellbeingChartsCollapsible>
    </section>
  );
}
