"use client";

import { StatusStackedChart } from "@/components/Charts/status-stacked-chart/chart";
import type { StatusStackedChartData } from "@/components/Charts/status-stacked-chart/chart";
import type { FilterApiRoleScope } from "./master-filter";

type Props = {
  title?: string;
  filterApiRoleScope?: FilterApiRoleScope | null;
};

export function WellbeingChartClient({
  title = "Wellbeing Resolution",
  filterApiRoleScope: _filterApiRoleScope,
}: Props) {
  const data: StatusStackedChartData = {
    open: [12, 8, 15, 6, 2],
    closed: [5, 10, 4, 9, 1],
  };

  return (
    <StatusStackedChart
      title={title}
      data={data}
    />
  );
}

