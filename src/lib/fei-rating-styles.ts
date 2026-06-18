import type { EiRating } from "@/lib/effectiveness-scoring";
import { EI_GRADE_LABELS } from "@/lib/ei-metric-definitions";

export type FeiGradeConfig = {
  color: string;
  bg: string;
  label: string;
};

export const FEI_GRADE_CONFIG: Record<EiRating, FeiGradeConfig> = {
  A: { color: "#10B981", bg: "rgba(16,185,129,0.15)", label: EI_GRADE_LABELS.A },
  B: { color: "#3B82F6", bg: "rgba(59,130,246,0.15)", label: EI_GRADE_LABELS.B },
  C: { color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: EI_GRADE_LABELS.C },
  D: { color: "#F43F5E", bg: "rgba(244,63,94,0.15)", label: EI_GRADE_LABELS.D },
};

export const EI_GRADE_CONFIG = FEI_GRADE_CONFIG;
