import type { WellbeingHeadDashboardData } from "@/lib/db/wellbeing-head-dashboard";
import { WellbeingHeadStackedChart } from "./WellbeingHeadStackedChart";
import { WellbeingHeadStatCard } from "./WellbeingHeadStatCard";

type SectionMetrics = WellbeingHeadDashboardData["totalRecords"];

type WellbeingHeadSectionProps = {
  title: string;
  metrics: SectionMetrics;
  compact?: boolean;
};

export function WellbeingHeadSection({
  title,
  metrics,
  compact = false,
}: WellbeingHeadSectionProps) {
  return (
    <section className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h2 className="text-xl font-semibold text-dark dark:text-white">{title}</h2>
      <div className="flex gap-4">
          <WellbeingHeadStatCard label="Total Cases" value={metrics.totals.totalCases} />
          <WellbeingHeadStatCard label="Referred" value={metrics.totals.referred} tone="purple" />
          <WellbeingHeadStatCard label="Resolved" value={metrics.totals.resolved} tone="purple" />
          <WellbeingHeadStatCard label="Open Cases" value={metrics.totals.openCases} tone="green" />
        </div>
      <div className='mt-4'>
       

        <div
          className={
            compact
              ? "space-y-4"
              : "space-y-4 lg:col-span-8 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0"
          }
        >
          <div className="rounded-[10px] border border-stroke p-3 dark:border-dark-3">
            <WellbeingHeadStackedChart
              title="All Cases (Category-wise)"
              xAxis={metrics.categoryChart.categories}
              open={metrics.categoryChart.open}
              closed={metrics.categoryChart.closed}
            />
          </div>
          <div className="rounded-[10px] border border-stroke p-3 dark:border-dark-3">
            <WellbeingHeadStackedChart
              title="Counseller-wise Cases"
              xAxis={metrics.counsellorChart.counsellors}
              open={metrics.counsellorChart.open}
              closed={metrics.counsellorChart.closed}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
