import type { FeiRating } from "@/lib/effectiveness-scoring";

export type FeiGradeConfig = {
  color: string;
  bg: string;
  label: string;
};

export const FEI_GRADE_CONFIG: Record<FeiRating, FeiGradeConfig> = {
  A: { color: "#10B981", bg: "rgba(16,185,129,0.15)", label: "Exemplary" },
  B: { color: "#3B82F6", bg: "rgba(59,130,246,0.15)", label: "Effective" },
  C: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Developing" },
  D: { color: "#F97316", bg: "rgba(249,115,22,0.15)", label: "At Risk" },
  E: { color: "#F43F5E", bg: "rgba(244,63,94,0.15)", label: "Critical" },
};
