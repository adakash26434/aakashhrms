// Performance evaluation (G1): shared types for the register, scoring window,
// cycles and the form tab.

import type { EvaluationForm, EvaluationStage } from '@/lib/engines/evaluation.engine';

export interface EvaluationCycleRow {
  id: string;
  label: string;
  period: 'annual' | 'half-yearly';
  fiscalYearId: string;
  fiscalYearLabel: string;
  status: 'open' | 'closed';
  openedByName: string;
  openedAt: string; // ISO
  evaluationCount: number;
  finalCount: number;
}

export interface EvaluationListRow {
  id: string;
  cycleId: string;
  cycleLabel: string;
  cycleStatus: 'open' | 'closed';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  branch: string;
  stage: EvaluationStage | 'final';
  stageName: string;
  status: 'in_progress' | 'final';
  total: number | null;
  band: string;
  bandNp: string;
  /** The signed-in user rates the current stage. */
  waitingForMe: boolean;
}

export interface StageScoreView {
  criterionId: string;
  marks: number;
  note: string | null;
}

export interface EvaluationDetail extends EvaluationListRow {
  form: EvaluationForm;
  raters: Record<string, string>; // stage -> userId
  raterNames: Record<string, string>; // stage -> display name
  /** stage -> criterion scores already saved. */
  scores: Record<string, StageScoreView[]>;
  stagePercents: Record<string, number>;
}

export interface EvaluationsPageData {
  evaluations: EvaluationListRow[];
  cycles: EvaluationCycleRow[];
  template: { id: string; name: string; nameNp: string; form: EvaluationForm };
  formErrors: string[];
  employees: { id: string; fullName: string; employeeCode: string; branch: string }[];
  raterOptions: { id: string; name: string }[];
  fiscalYears: { id: string; label: string }[];
  waitingForMe: number;
  permissions: { open: boolean; start: boolean; rate: boolean; finalize: boolean; close: boolean; editForm: boolean };
}
