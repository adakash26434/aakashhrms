import type { PromotionWeights } from '@/lib/engines/promotion.engine';

// Promotion score: the ranking page's data. Composite is computed, never stored.

export interface PromotionRow {
  rank: number | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designationId: string;
  designation: string;
  branch: string;
  yearsInPost: number;
  inPostSince: string;
  evaluationAvg: number | null;
  evaluationPoints: number;
  seniorityPoints: number;
  trainingHours: number;
  trainingPoints: number;
  penalty: number;
  composite: number;
  note: string | null;
}

export interface PromotionPageData {
  rows: PromotionRow[];
  designations: { id: string; name: string }[];
  weights: PromotionWeights;
  /** Disciplinary outcomes counted from this date (24 months back). */
  disciplineSinceAd: string;
  permissions: { editWeights: boolean; recordEvent: boolean; export: boolean };
}
