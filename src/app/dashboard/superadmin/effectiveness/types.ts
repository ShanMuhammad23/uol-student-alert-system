import { normalizeDateString, type FeiRating } from "@/lib/effectiveness-scoring";

export type FacultyEffectivenessView = {
  id: string;
  name: string;
  code: string;
  fei: number;
  grade: FeiRating;
  response: number;
  wellbeing: number;
  outcome: number;
  readiness: number;
  sustained: number;
  coverage: number;
  critCoverage: number;
  ttfc: number;
  staleRate: number;
  conclusionRate: number;
  wellbeingPct: number;
  recovery: number;
  repeatAlert: number;
  attendancePost: number;
  alerted: number;
  intervened: number;
  referred: number;
  concluded: number;
  recovered: number;
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
