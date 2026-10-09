// Targets & achievements (G15): pure rules. A target is one metric for one employee
// and one period (a fiscal month or the fiscal year). The employee reports the
// achievement, the supervisor verifies and forwards, HR closes. Nothing here
// touches the database.

export const PERIOD_KINDS = ['month', 'year'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const TARGET_STATUSES = ['set', 'submitted', 'returned', 'forwarded', 'closed'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

/** Who may take each step. `employee` is the target's own employee. */
export type TargetActor = 'employee' | 'supervisor' | 'hr';

const MOVES: readonly { from: TargetStatus; to: TargetStatus; actor: TargetActor }[] = [
  { from: 'set', to: 'submitted', actor: 'employee' },
  { from: 'returned', to: 'submitted', actor: 'employee' },
  { from: 'submitted', to: 'returned', actor: 'supervisor' },
  { from: 'submitted', to: 'forwarded', actor: 'supervisor' },
  { from: 'forwarded', to: 'returned', actor: 'hr' },
  { from: 'forwarded', to: 'closed', actor: 'hr' },
];

export function canMove(from: string, to: string, actor: TargetActor): boolean {
  return MOVES.some((m) => m.from === from && m.to === to && m.actor === actor);
}

/** The employee can still change the reported figure and attachments. */
export function employeeCanEdit(status: string): boolean {
  return status === 'set' || status === 'returned';
}

/** Targets can be changed or removed only before anything is reported. */
export function targetIsOpen(status: string): boolean {
  return status === 'set';
}

/** Months are fiscal-year months: 1 = Shrawan … 12 = Ashadh (Nepal's fiscal year starts mid-July). */
export const FISCAL_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh',
] as const;

export const FY_PATTERN = /^\d{4}\/\d{2}$/;
/** An achievement above this share of its target does not add more score. */
export const DEFAULT_CAP_PCT = 120;

export interface TargetForm {
  employeeId: string;
  periodKind: PeriodKind;
  fy: string;
  monthNo: number | null;
  title: string;
  unit: string;
  targetValue: number;
  weight: number;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

export function normalizeTargetForm(raw: unknown): TargetForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind: PeriodKind = r.periodKind === 'month' ? 'month' : 'year';
  const month = num(r.monthNo);
  return {
    employeeId: text(r.employeeId, 64),
    periodKind: kind,
    fy: text(r.fy, 9),
    monthNo: kind === 'month' && Number.isInteger(month) ? month : null,
    title: text(r.title, 160),
    unit: text(r.unit, 30),
    targetValue: num(r.targetValue),
    weight: Number.isNaN(num(r.weight)) ? 0 : num(r.weight),
  };
}

export function validateTargetForm(f: TargetForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.employeeId) e.employeeId = 'Choose an employee.';
  if (!FY_PATTERN.test(f.fy)) e.fy = 'Use the fiscal year like 2082/83.';
  if (f.periodKind === 'month' && (f.monthNo === null || f.monthNo < 1 || f.monthNo > 12)) e.monthNo = 'Choose the month.';
  if (!f.title) e.title = 'Say what the target is.';
  if (Number.isNaN(f.targetValue) || f.targetValue <= 0) e.targetValue = 'The target must be more than zero.';
  else if (f.targetValue > 1_000_000_000_000) e.targetValue = 'That target is too large.';
  if (f.weight < 0 || f.weight > 100) e.weight = 'Weight is between 0 and 100.';
  return e;
}

/** Total weight of the targets of one person and period: should be 100 to give a clean score. */
export function weightTotal(rows: readonly { weight: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + r.weight, 0) * 100) / 100;
}

export interface AchievementForm {
  achievedValue: number;
  note: string;
}

export function normalizeAchievementForm(raw: unknown): AchievementForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { achievedValue: num(r.achievedValue), note: text(r.note, 1000) };
}

export function validateAchievementForm(f: AchievementForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (Number.isNaN(f.achievedValue) || f.achievedValue < 0) e.achievedValue = 'Enter what you achieved (zero or more).';
  else if (f.achievedValue > 1_000_000_000_000) e.achievedValue = 'That figure is too large.';
  return e;
}

/** Achievement as a percentage of target, one decimal. */
export function achievementPct(target: number, achieved: number): number {
  if (!(target > 0) || !(achieved >= 0)) return 0;
  return Math.round((achieved / target) * 1000) / 10;
}

export interface ScoredRow {
  weight: number;
  target: number;
  /** The supervisor's verified figure when there is one, else the reported figure; null = nothing reported. */
  value: number | null;
}

/**
 * Weighted score 0..cap for a person's rows in one period: Σ weight × capped %
 * ÷ Σ weight. Rows with no figure count as zero; null when there is no weight.
 */
export function weightedScore(rows: readonly ScoredRow[], capPct = DEFAULT_CAP_PCT): number | null {
  const total = rows.reduce((s, r) => s + r.weight, 0);
  if (!(total > 0)) return null;
  const sum = rows.reduce((s, r) => s + r.weight * Math.min(capPct, achievementPct(r.target, r.value ?? 0)), 0);
  return Math.round((sum / total) * 10) / 10;
}

/** The figure used for scoring: the supervisor's verified value wins over the reported one. */
export function scoringValue(reported: number | null, verified: number | null): number | null {
  return verified ?? reported;
}

/**
 * Yearly roll-up from the monthly scores that exist: the plain average of the
 * months that have a score. null when no month has one.
 */
export function rollUpYear(monthScores: readonly (number | null)[]): number | null {
  const have = monthScores.filter((s): s is number => s !== null);
  if (!have.length) return null;
  return Math.round((have.reduce((s, x) => s + x, 0) / have.length) * 10) / 10;
}

/** Label for a period: "Shrawan 2082/83" or "FY 2082/83". */
export function periodLabel(kind: string, fy: string, monthNo: number | null): string {
  if (kind === 'month' && monthNo && monthNo >= 1 && monthNo <= 12) return `${FISCAL_MONTHS[monthNo - 1]} ${fy}`;
  return `FY ${fy}`;
}

export interface TargetNote {
  note: string;
}

/** A return needs a reason the employee can act on. */
export function validateReturnReason(reason: unknown): string | null {
  return typeof reason === 'string' && reason.trim().length >= 3 ? null : 'Say what needs to change (at least a few words).';
}
