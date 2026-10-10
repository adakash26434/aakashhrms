import { maskAccountNumber } from '@/lib/utils/mask';
import type { ScopeFilter } from '@/lib/auth/scope-filter';
import type { RunStep } from '@/lib/types/notification';

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
  /**
   * F13: the account on the employee record now (null / undefined: not known). A record that
   * differs from the payslip means the bank details changed after the run was made.
   */
  recordBankAccount?: string | null;
  /** F13: how the record's bank account last changed ("approved by Hari Thapa on 2026-10-10"). */
  bankChangeNote?: string | null;
}

export type VarianceCode = 'net_change' | 'non_positive_net' | 'new_in_payroll' | 'missing_from_run' | 'ot_high' | 'no_bank_account' | 'bank_changed' | 'bank_outdated';

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
/** Account numbers compare without spaces; "N/A" (no account when the slip was made) counts as none. */
const account = (v: string | null | undefined) => {
  const clean = (v ?? '').replace(/\s+/g, '');
  return clean.toUpperCase() === 'N/A' ? '' : clean;
};
/** Two different accounts as a flag shows them: masked (S18), or "both end ••••0001" when the last four digits match. */
function accountPair(a: string, b: string): { a: string; b: string } | { sameEnd: string } {
  const [ma, mb] = [maskAccountNumber(a), maskAccountNumber(b)];
  return ma === mb ? { sameEnd: ma } : { a: ma, b: mb };
}

export function varianceFlags(current: readonly SlipFact[], previous: readonly SlipFact[] | null, options: VarianceOptions = DEFAULT_VARIANCE): VarianceFlag[] {
  const flags: VarianceFlag[] = [];
  const before = new Map((previous ?? []).map((p) => [p.employeeId, p]));
  const add = (s: SlipFact, code: VarianceCode, detail: string, severity: VarianceFlag['severity'] = 'review') =>
    flags.push({ key: flagKey(s.employeeId, code), employeeId: s.employeeId, code, name: s.name, employeeCode: s.code, detail, severity });

  for (const s of current) {
    const paysInto = account(s.bankAccount);
    if (s.net <= 0) add(s, 'non_positive_net', `Net pay is ${money(s.net)}.`);
    if (!paysInto) add(s, 'no_bank_account', 'No bank account on the payslip, so the payment cannot be made.');
    if (s.basic > 0 && (s.ot / s.basic) * 100 > options.otPctOfBasic) {
      add(s, 'ot_high', `Overtime ${money(s.ot)} is ${Math.round((s.ot / s.basic) * 100)}% of basic.`);
    }
    // F13: the record's bank account changed after this run was made (the payslip still has the old one).
    const onRecord = s.recordBankAccount == null ? null : account(s.recordBankAccount);
    const how = s.bankChangeNote ? ` (${s.bankChangeNote})` : '';
    if (paysInto && onRecord && onRecord !== paysInto) {
      const pair = accountPair(onRecord, paysInto);
      add(
        s,
        'bank_outdated',
        'sameEnd' in pair
          ? `The employee record now has a new account${how}; this run still pays the old one (both end ${pair.sameEnd}). Send the run back to draft to pick up the new account.`
          : `The employee record now has account ${pair.a}${how}; this run still pays ${pair.b}. Send the run back to draft to pick up the new account.`,
      );
    }
    if (previous) {
      const p = before.get(s.employeeId);
      if (!p) {
        add(s, 'new_in_payroll', 'Not in last month\'s run.', 'info');
      } else {
        if (p.net > 0) {
          const change = ((s.net - p.net) / p.net) * 100;
          if (Math.abs(change) >= options.thresholdPct) {
            add(s, 'net_change', `Net ${money(s.net)} against ${money(p.net)} last month (${change > 0 ? '+' : ''}${change.toFixed(1)}%).`);
          }
        }
        // F13: pay goes to a different account from last month — confirm the change was asked for.
        const paidInto = account(p.bankAccount);
        if (paysInto && paidInto && paysInto !== paidInto) {
          const pair = accountPair(paidInto, paysInto);
          add(s, 'bank_changed', 'sameEnd' in pair ? `This run pays a different account from last month (both end ${pair.sameEnd})${how}.` : `Paid into ${pair.a} last month; this run pays ${pair.b}${how}.`);
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

// ---- settings ----------------------------------------------------------------------

/** `system_config` keys of the payroll controls (Payroll controls screen, SYSTEM_CONTROL). */
export const CONTROL_KEYS = {
  checker: 'payroll.makerChecker', // admin_exempt (default) | strict
  variancePct: 'payroll.variancePct', // net change in percent that needs a look (default 15)
  requireClosed: 'payroll.requireClosedAttendance', // on | off (default off)
  detailApproval: 'employeeDetails.approval', // F13: required (default) | off
} as const;

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

// ---- F17: the step a run waits for (notification centre) ----------------------------

export interface RunStepFacts {
  status: string;
  publishedAt: Date | string | null;
  generatedBy: string;
  /** Payslips held back from employees. */
  heldCount: number;
  /** The run pays the acting user's own employee record. */
  includesActor: boolean;
}

export interface RunStepActor {
  userId: string;
  isAdmin: boolean;
  mode: CheckerMode;
  /** Payroll generate → Edit: sends a draft for review. */
  canSend: boolean;
  /** Payroll review → Approve. */
  canApprove: boolean;
  /** Payroll review → Lock: locks, publishes and releases held payslips. */
  canLock: boolean;
}

/**
 * The step on a run that waits for this person, or null. It follows the server's own checks
 * (the action's permission, `checkerRefusal`, `canPublishRun`), so the bell never offers a step
 * the server would refuse. Held payslips on a published run are a reminder (`release`).
 */
export function nextRunStep(run: RunStepFacts, actor: RunStepActor): RunStep | null {
  const allowed = (step: 'approve' | 'lock') =>
    checkerRefusal({ mode: actor.mode, step, generatedBy: run.generatedBy, actor: actor.userId, actorIsAdmin: actor.isAdmin, runIncludesActor: run.includesActor }) === null;
  switch (run.status) {
    case 'DRAFT':
      return actor.canSend ? 'send' : null;
    case 'UNDER_REVIEW':
      return actor.canApprove && allowed('approve') ? 'approve' : null;
    case 'APPROVED':
      return actor.canLock && allowed('lock') ? 'lock' : null;
    case 'LOCKED':
      if (!actor.canLock) return null;
      if (canPublishRun(run.status, run.publishedAt)) return 'publish';
      return run.heldCount > 0 ? 'release' : null;
    default:
      return null;
  }
}

/**
 * Whether a run concerns someone with this scope: company-wide people see every run; branch and
 * department people see runs for all branches (departments) or for one of theirs.
 */
export function runConcerns(run: { branchIds: readonly string[]; departmentIds: readonly string[] | null }, scope: Pick<ScopeFilter, 'scopeType' | 'branchIds' | 'departmentIds'>): boolean {
  const overlaps = (runIds: readonly string[] | null, mine: readonly string[]) => !runIds?.length || runIds.some((id) => mine.includes(id));
  switch (scope.scopeType) {
    case 'GLOBAL':
      return true;
    case 'BRANCH':
      return overlaps(run.branchIds, scope.branchIds);
    case 'DEPARTMENT':
      return overlaps(run.departmentIds, scope.departmentIds);
    default:
      return false;
  }
}

// ---- pre-flight --------------------------------------------------------------------

export type PreflightCode =
  | 'attendance_open'
  | 'no_salary'
  | 'needs_setup'
  | 'pending_leave'
  | 'no_bank_account'
  | 'no_pan'
  | 'duplicate_run'
  | 'missing_tds_head'
  | 'missing_statutory_head'
  | 'covered_by_opening'
  | 'loan_on_structure'
  | 'fiscal_year';

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
  /** Statutory pay heads present in the master (flags on `pay_heads`). TDS is needed by every run; PF / SSF / CIT only when something is deducted under them. */
  statutoryHeads?: { tds: boolean; pf: boolean; ssf: boolean; cit: boolean };
  /**
   * F6: the run type. Off-cycle runs (FESTIVAL, ARREARS) read no attendance, leave or pay-head
   * setup and deduct no PF / SSF / CIT, so only the checks that matter to them apply.
   */
  runType?: 'REGULAR' | 'FESTIVAL' | 'ARREARS';
  /** F15: people whose opening balance covers this month (the old system paid it). */
  employeesCoveredByOpening?: string[];
  /** 4.10: a loan amount on the salary structure with no loan recorded (payroll no longer deducts it). */
  employeesWithLoanOnStructure?: string[];
  /** 4.12: why the month's fiscal year can't take the run (none covers it, or it is closed). */
  fiscalYearProblem?: string | null;
}

export function preflightFindings(f: PreflightFacts): PreflightFinding[] {
  const out: PreflightFinding[] = [];
  const push = (code: PreflightCode, severity: PreflightFinding['severity'], title: string, people: string[] = []) => people.length || code === 'pending_leave' || code === 'duplicate_run' || code === 'attendance_open' || code === 'fiscal_year' ? out.push({ code, severity, title, people }) : undefined;
  if (f.fiscalYearProblem) push('fiscal_year', 'blocker', f.fiscalYearProblem);
  if (f.statutoryHeads && !f.statutoryHeads.tds) push('missing_tds_head', 'blocker', 'The TDS (income tax) pay head is missing from Setup → Pay heads; payroll cannot post tax without it.', ['TDS']);
  const regular = (f.runType ?? 'REGULAR') === 'REGULAR';
  if (f.statutoryHeads && regular) {
    const absent = (['pf', 'ssf', 'cit'] as const).filter((k) => !f.statutoryHeads![k]).map((k) => k.toUpperCase());
    if (absent.length) push('missing_statutory_head', 'warning', 'These statutory pay heads are not set up; a run that deducts under them will fail.', absent);
  }
  const what = regular ? 'run' : f.runType === 'FESTIVAL' ? 'festival allowance run' : 'arrears run';
  if (f.existingRunStatus) push('duplicate_run', f.existingRunStatus === 'LOCKED' ? 'blocker' : 'warning', f.existingRunStatus === 'LOCKED' ? `A locked ${what} already exists for this month.` : `A ${f.existingRunStatus.toLowerCase().replace('_', ' ')} ${what} already exists for this month; generating again replaces it.`);
  if (regular && f.openAttendanceBranches.length) push('attendance_open', f.requireClosedAttendance ? 'blocker' : 'warning', 'Attendance for the month is not closed. Payroll will use days worked out now, which can still change.', f.openAttendanceBranches);
  if (f.runType !== 'ARREARS') push('no_salary', 'blocker', 'No salary structure in force for the month.', f.employeesWithoutSalary);
  push('covered_by_opening', 'blocker', 'Their opening balance already covers this month (the old system paid it); paying it here would count it twice.', f.employeesCoveredByOpening ?? []);
  if (regular) push('needs_setup', 'blocker', 'New hires still need their pay heads set up in Salary structure.', f.employeesNeedingSetup);
  if (regular && f.pendingLeaveCount > 0) push('pending_leave', 'blocker', `${f.pendingLeaveCount} leave application(s) in the month are still pending. Decide them first.`);
  if (regular) push('loan_on_structure', 'warning', 'A loan amount is on their salary structure but no loan is recorded: payroll deducts only recorded loans now. Enter it under Loans → Import opening balances.', f.employeesWithLoanOnStructure ?? []);
  push('no_bank_account', 'warning', 'No bank account on file; these people cannot be paid by transfer.', f.employeesWithoutBank);
  push('no_pan', 'warning', 'No PAN on file; tax is deducted at the higher non-PAN treatment where the law applies.', f.employeesWithoutPan);
  return out;
}

export const hasBlocker = (findings: readonly PreflightFinding[]) => findings.some((f) => f.severity === 'blocker');
