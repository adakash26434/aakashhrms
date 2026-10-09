// Targets & achievements (G15): shared types for the office screen and the portal.

import type { PeriodKind, TargetStatus } from '@/lib/engines/target.engine';

export const TARGET_ATTACHMENT_MAX = 5;

export interface TargetAttachmentRef {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface TargetRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branch: string;
  periodKind: PeriodKind;
  fy: string;
  monthNo: number | null;
  periodLabel: string;
  title: string;
  unit: string;
  targetValue: number;
  weight: number;
  status: TargetStatus;
  achievedValue: number | null;
  achievedNote: string;
  verifiedValue: number | null;
  reviewerNote: string;
  returnReason: string;
  /** Achievement % of the figure used for scoring (verified over reported); null when nothing is reported. */
  pct: number | null;
  attachments: TargetAttachmentRef[];
}

/** A person's score for one period (the rows of that period, weighted). */
export interface PeriodScore {
  employeeId: string;
  periodKind: PeriodKind;
  fy: string;
  monthNo: number | null;
  periodLabel: string;
  score: number | null;
  weightTotal: number;
}

export interface TargetEmployeeOption {
  id: string;
  fullName: string;
  employeeCode: string;
  branch: string;
}

export interface TargetsPageData {
  rows: TargetRow[];
  scores: PeriodScore[];
  employees: TargetEmployeeOption[];
  fiscalYears: string[];
  currentFy: string;
  permissions: { add: boolean; manage: boolean; decide: boolean };
}

/** The signed-in employee's own targets, or their team's when they supervise. */
export interface MyTargetsData {
  rows: TargetRow[];
  scores: PeriodScore[];
  fiscalYears: string[];
  currentFy: string;
}
