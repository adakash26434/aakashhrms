// Payroll controls (4.8 / F1–F3): pure rules for the variance review, the
// maker-checker on run approval and locking, the pre-flight report and who
// sees a published payslip. Nothing here touches the database.

// ---- F1 variance review ----------------------------------------------------------

export interface SlipFact {
  employeeId: string;
  code: string;
  name: string;
  basic: number;
  gross: number;
  net: number;
  ot: number;
  bankAccount: string;
}

export type VarianceCode = 'net_change' | 'non_positive_net' | 'new_in_payroll' | 'missing_from_run' | 'ot_high' | 'no_bank_account';

export interface VarianceFlag {
  /** Stable key for acknowledging: `<employeeId>:<code>`. */
  key: string;
  employeeId: string;
  code: VarianceCode;
  name: string;
  employeeCode: string;
  detail: string;
  /** `review` flags block approval until acknowledged; `info` flags do not. */
  severity: 'review' | 'info';
}

export interface VarianceOptions {
  /** Net pay change from last month that needs a look, in percent. */
  thresholdPct: number;
  /** OT above this share of basic needs a look, in percent. */
  otPctOfBasic: number;
  /** Compare who is in the run with who was in the last one (only when both cover the same people). */
  sameScope: boolean;
}

export const DEFAULT_VARIANCE: VarianceOptions = { thresholdPct: 15, otPctOfBasic: 50, sameScope: true };

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const flagKey = (employeeId: string, code: VarianceCode) => `${employeeId}:${code}`;

export function varianceFlags(current: readonly SlipFact[], previous: readonly SlipFact[] | null, options: VarianceOptions = DEFAULT_VARIANCE): VarianceFlag[] {
  const flags: VarianceFlag[] = [];
  const before = new Map((previous ?? []).map((p) => [p.employeeId, p]));
  const add = (s: SlipFact, code: VarianceCode, detail: string, severity: VarianceFlag['severity'] = 'review') =>
    flags.push({ key: flagKey(s.employeeId, code), employeeId: s.employeeId, code, name: s.name, employeeCode: s.code, detail, severity });

  for (const s of current) {
    if (s.net <= 0) add(s, 'non_positive_net', `Net pay is ${money(s.net)}.`);
    if (!s.bankAccount.trim()) add(s, 'no_bank_account', 'No bank account on the payslip, so the payment cannot be made.');
    if (s.basic > 0 && (s.ot / s.basic) * 100 > options.otPctOfBasic) {
      add(s, 'ot_high', `Overtime ${money(s.ot)} is ${Math.round((s.ot / s.basic) * 100)}% of basic.`);
    }
    if (previous) {
      const p = before.get(s.employeeId);
      if (!p) {
        add(s, 'new_in_payroll', 'Not in last month\'s run.', 'info');
      } else if (p.net > 0) {
        const change = ((s.net - p.net) / p.net) * 100;
        if (Math.abs(change) >= options.thresholdPct) {
          add(s, 'net_change', `Net ${money(s.net)} against ${money(p.net)} last month (${change > 0 ? '+' : ''}${change.toFixed(1)}%).`);
        }
      }
    }
  }
  if (previous && options.sameScope) {
    const now = new Set(current.map((s) => s.employeeId));
    for (const p of previous) {
      if (!now.has(p.employeeId)) add(p, 'missing_from_run', `Was paid ${money(p.net)} last month and is not in this run.`);
    }
  }
  return flags;
}

/** Flags that still stop approval: `review` ones nobody has acknowledged. */
export function unresolvedFlags(flags: readonly VarianceFlag[], acknowledged: ReadonlySet<string>): VarianceFlag[] {
  return flags.filter((f) => f.severity === 'review' && !acknowledged.has(f.key));
}

export function canApproveRun(flags: readonly VarianceFlag[], acknowledged: ReadonlySet<string>): boolean {
  return unresolvedFlags(flags, acknowledged).length === 0;
}

// ---- F2 maker-checker -----------------------------------------------------------

/**
 * `admin_exempt` (default): whoever generated the run cannot approve or lock it,
 * except a company administrator. `strict`: nobody can, administrators included,
 * and nobody approves or locks a run that pays them.
 */
export type CheckerMode = 'admin_exempt' | 'strict';

export const asCheckerMode = (v: unknown): CheckerMode => (v === 'strict' ? 'strict' : 'admin_exempt');

export interface CheckerInput {
  mode: CheckerMode;
  step: 'approve' | 'lock';
  generatedBy: string;
  actor: string;
  actorIsAdmin: boolean;
  /** The run pays the acting user's own employee record. */
  runIncludesActor: boolean;
}

export type CheckerRefusal = 'generator' | 'own_pay';

export function checkerRefusal(i: CheckerInput): CheckerRefusal | null {
  if (i.generatedBy === i.actor && !(i.mode === 'admin_exempt' && i.actorIsAdmin)) return 'generator';
  if (i.mode === 'strict' && i.runIncludesActor) return 'own_pay';
  return null;
}

export const CHECKER_MESSAGE: Record<CheckerRefusal, (step: 'approve' | 'lock') => string> = {
  generator: (step) => `The person who generated a payroll run cannot ${step} it. Ask another approver.`,
  own_pay: (step) => `This run pays your own employee record, so someone else must ${step} it.`,
};

// ---- F3 payslip publishing --------------------------------------------------------

export interface PublishState {
  runStatus: string;
  runPublishedAt: Date | string | null;
  slipHeldAt: Date | string | null;
}

/** A payslip is visible to the employee only after its run is locked and published, and not on hold. */
export function slipVisibleToEmployee(s: PublishState): boolean {
  return s.runStatus === 'LOCKED' && !!s.runPublishedAt && !s.slipHeldAt;
}

/** A run can be published once it is locked and not already published. */
export function canPublishRun(runStatus: string, publishedAt: Date | string | null): boolean {
  return runStatus === 'LOCKED' && !publishedAt;
}

// ---- pre-flight --------------------------------------------------------------------

export type PreflightCode = 'attendance_open' | 'no_salary' | 'needs_setup' | 'pending_leave' | 'no_bank_account' | 'no_pan' | 'duplicate_run';

export interface PreflightFinding {
  code: PreflightCode;
  /** `blocker` stops the run; `warning` is shown and the run can still go ahead. */
  severity: 'blocker' | 'warning';
  title: string;
  people: string[];
}

export interface PreflightFacts {
  /** Branches in scope whose attendance month is not closed. */
  openAttendanceBranches: string[];
  employeesWithoutSalary: string[];
  employeesNeedingSetup: string[];
  pendingLeaveCount: number;
  employeesWithoutBank: string[];
  employeesWithoutPan: string[];
  /** A run already exists for this month and scope (not locked). */
  existingRunStatus: string | null;
  /** Whether closed attendance is required (system setting); otherwise open months only warn. */
  requireClosedAttendance: boolean;
}

export function preflightFindings(f: PreflightFacts): PreflightFinding[] {
  const out: PreflightFinding[] = [];
  const push = (code: PreflightCode, severity: PreflightFinding['severity'], title: string, people: string[] = []) => people.length || code === 'pending_leave' || code === 'duplicate_run' || code === 'attendance_open' ? out.push({ code, severity, title, people }) : undefined;
  if (f.existingRunStatus) push('duplicate_run', f.existingRunStatus === 'LOCKED' ? 'blocker' : 'warning', f.existingRunStatus === 'LOCKED' ? 'A locked run already exists for this month.' : `A ${f.existingRunStatus.toLowerCase().replace('_', ' ')} run already exists for this month; generating again replaces it.`);
  if (f.openAttendanceBranches.length) push('attendance_open', f.requireClosedAttendance ? 'blocker' : 'warning', 'Attendance for the month is not closed. Payroll will use days worked out now, which can still change.', f.openAttendanceBranches);
  push('no_salary', 'blocker', 'No salary structure in force for the month.', f.employeesWithoutSalary);
  push('needs_setup', 'blocker', 'New hires still need their pay heads set up in Salary structure.', f.employeesNeedingSetup);
  if (f.pendingLeaveCount > 0) push('pending_leave', 'blocker', `${f.pendingLeaveCount} leave application(s) in the month are still pending. Decide them first.`);
  push('no_bank_account', 'warning', 'No bank account on file; these people cannot be paid by transfer.', f.employeesWithoutBank);
  push('no_pan', 'warning', 'No PAN on file; tax is deducted at the higher non-PAN treatment where the law applies.', f.employeesWithoutPan);
  return out;
}

export const hasBlocker = (findings: readonly PreflightFinding[]) => findings.some((f) => f.severity === 'blocker');
