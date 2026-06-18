import type { EiCriterionBreakdown } from "@/lib/effectiveness-scoring";
import { normalizeDateString, type EiRating } from "@/lib/effectiveness-scoring";

export type FacultyEffectivenessView = {
  id: string;
  name: string;
  code: string;
  dimensionType: "faculty" | "department" | "instructor";
  ei: number;
  grade: EiRating;
  criteria: EiCriterionBreakdown[];
  loginRate: number;
  attendancePost: number;
  coverage: number;
  ttfa: number;
  caseProgression: number;
  resolution: number;
  wbUptake: number;
  wbProgression: number;
  wbResolution: number;
  alerted: number;
  intervened: number;
  referred: number;
  concluded: number;
  nTotal: number;
  trend: number[];
};

export function formatTrendLabel(value: unknown): string {
  const dateStr = normalizeDateString(value);
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
