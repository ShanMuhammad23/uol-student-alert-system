"use client";

import { useQuery } from "@tanstack/react-query";
import type { Student } from "@/app/(home)/dashboard/fetch";

export type MonitoringQueryParams = {
  Campus?: string;
  PYear?: string;
  PSess?: string;
  Begda?: string;
  Endda?: string;
};

export type MonitoringClassSummary = {
  CrCode: string;
  SecCode: string;
  Att: number;
  ToDate: number;
};

export type MonitoringResponse = {
  params: { Campus: string; PYear: string; PSess: string; Begda: string; Endda: string };
  count: number;
  students: Student[];
  classes?: MonitoringClassSummary[];
};

async function fetchMonitoring(params?: MonitoringQueryParams): Promise<MonitoringResponse> {
  const sp = new URLSearchParams();
  if (params?.Campus) sp.set("Campus", params.Campus);
  if (params?.PYear) sp.set("PYear", params.PYear);
  if (params?.PSess) sp.set("PSess", params.PSess);
  if (params?.Begda) sp.set("Begda", params.Begda);
  if (params?.Endda) sp.set("Endda", params.Endda);
  const url = `/api/monitoring${sp.toString() ? `?${sp.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Failed to fetch: ${res.status}`);
  }
  return res.json();
}

export function useMonitoringStudents(params?: MonitoringQueryParams) {
  return useQuery({
    queryKey: ["monitoring", params ?? {}],
    queryFn: () => fetchMonitoring(params),
  });
}
