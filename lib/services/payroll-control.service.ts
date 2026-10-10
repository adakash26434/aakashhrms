import { getDb } from '@/lib/db';
import { asRunType, isOffCycle } from '@/lib/engines/off-cycle.engine';
import { branches, leaveApplications, roles, userRoles } from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import * as repo from '@/lib/repositories/payroll-control.repository';
import * as payrollRepo from '@/lib/repositories/payroll.repository';
import * as employeeRepository from '@/lib/repositories/employee.repository';
import * as salaryMappingRepository from '@/lib/repositories/salary-mapping.repository';
import * as attendanceRepo from '@/lib/repositories/attendance.repository';
import { employeesNeedingSetup } from '@/lib/repositories/salary-structure.repository';
import {
  CHECKER_MESSAGE,
  DEFAULT_VARIANCE,
  asCheckerMode,
  canPublishRun,
  checkerRefusal,
  preflightFindings,
  unresolvedFlags,
  varianceFlags,
  type CheckerMode,
  type PreflightFinding,
  type SlipFact,
  type VarianceFlag,
} from '@/lib/engines/payroll-control.engine';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { getBSMonthRange } from '@/lib/utils/bs-calendar';
import type { PayrollRun, PayrollRunSetupPayload, PayrollSlip } from '@/lib/types/payroll';

// Payroll controls (4.8 / F1–F3): orchestration. The variance review compares a
// run with the previous month for the same branches and blocks approval until
// each flag is acknowledged; approval and locking follow the maker-checker rule
// (S21 for pay: nobody approves a run that pays them in strict mode, nobody
// edits their own payslip); payslips reach employees only when published.

export const CONFIG = {
  checker: 'payroll.makerChecker', // admin_exempt (default) | strict
  variancePct: 'payroll.variancePct', // net change in percent that needs a look (default 15)
  requireClosed: 'payroll.requireClosedAttendance', // on | off (default off)
} as const;

export interface PayrollControlSettings {
  makerChecker: CheckerMode;
  variancePct: number;
  requireClosedAttendance: boolean;
}

export async function readSettings(): Promise<PayrollControlSettings> {
  const [checker, pct, closed] = await Promise.all([repo.readConfig(CONFIG.checker), repo.readConfig(CONFIG.variancePct), repo.readConfig(CONFIG.requireClosed)]);
  const parsed = Number(pct);
  return {
    makerChecker: asCheckerMode(checker),
    variancePct: Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : DEFAULT_VARIANCE.thresholdPct,
    requireClosedAttendance: closed === 'on',
  };
}

export async function saveSettings(raw: unknown): Promise<PayrollControlSettings> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pct = Number(r.variancePct);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new UserFacingError('The variance threshold is a percentage between 1 and 100.');
  await Promise.all([
    repo.writeConfig(CONFIG.checker, asCheckerMode(r.makerChecker)),
    repo.writeConfig(CONFIG.variancePct, String(pct)),
    repo.writeConfig(CONFIG.requireClosed, r.requireClosedAttendance === true ? 'on' : 'off'),
  ]);
  return readSettings();
}

const factOf = (s: PayrollSlip): SlipFact => ({
  employeeId: s.employeeId,
  code: s.employeeCode,
  name: s.employeeName,
  basic: Number(s.basicSalary),
  gross: Number(s.grossEarnings),
  net: Number(s.netPayable),
  ot: Number(s.otAmount),
  bankAccount: s.bankAccountNumber ?? '',
});

const sameBranches = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export interface VarianceReview {
  runId: string;
  flags: VarianceFlag[];
  acknowledged: string[];
  /** Review flags nobody has acknowledged yet (these stop approval). */
  unresolved: string[];
  comparedWith: string | null;
  thresholdPct: number;
}

export async function varianceReview(runId: string): Promise<VarianceReview> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError('Not found: this payroll run no longer exists.');
  // F6: an off-cycle run pays one thing on its own, so there is no month-on-month variance to review.
  if (isOffCycle(run.runType)) {
    const settings = await readSettings();
    return { runId, flags: [], acknowledged: [], unresolved: [], comparedWith: null, thresholdPct: settings.variancePct };
  }
  const [settings, slips, acks, earlier] = await Promise.all([readSettings(), payrollRepo.findSlipsByRunId(runId), repo.acksFor(runId), repo.earlierRuns(run)]);
  const previous = earlier.find((e) => sameBranches(e.branchIds, run.branchIds)) ?? null;
  const previousSlips = previous ? (await payrollRepo.findSlipsByRunId(previous.id)).map(factOf) : null;
  const flags = varianceFlags(slips.map(factOf), previousSlips, { ...DEFAULT_VARIANCE, thresholdPct: settings.variancePct, sameScope: !!previous });
  const acked = new Set(acks.map((a) => a.flagKey));
  return {
    runId,
    flags,
    acknowledged: [...acked],
    unresolved: unresolvedFlags(flags, acked).map((f) => f.key),
    comparedWith: previous ? `${previous.payPeriodYear}-${String(previous.payPeriodMonth).padStart(2, '0')}` : null,
    thresholdPct: settings.variancePct,
  };
}

export interface ControlCtx {
  userId: string;
  actorEmployeeId: string | null;
}

/** Acknowledges the named flags (only flags that exist on the run now), with a note. */
export async function acknowledgeFlags(runId: string, keys: unknown, note: unknown, ctx: ControlCtx): Promise<VarianceReview> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError('Not found: this payroll run no longer exists.');
  if (run.status === 'LOCKED') throw new UserFacingError('A locked run cannot change.');
  const wanted = [...new Set((Array.isArray(keys) ? keys : []).filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 100))];
  if (!wanted.length) throw new UserFacingError('Choose at least one flag to acknowledge.');
  const text = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  if (text.length < 3) throw new UserFacingError('Add a short note saying why this is expected.');
  const review = await varianceReview(runId);
  const known = new Map(review.flags.map((f) => [f.key, f]));
  const rows = wanted.filter((k) => known.has(k)).map((k) => ({ flagKey: k, employeeId: known.get(k)!.employeeId }));
  if (!rows.length) throw new UserFacingError('Those flags are no longer on this run — refresh.');
  // S21: nobody acknowledges a flag about their own pay.
  if (ctx.actorEmployeeId && rows.some((r) => r.employeeId === ctx.actorEmployeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'APPROVE', module: 'PAYROLL_REVIEW', recordId: runId, result: DENIED_SELF });
    throw new UserFacingError('A flag about your own pay must be acknowledged by someone else.');
  }
  await repo.insertAcks(runId, rows, text, ctx.userId);
  return varianceReview(runId);
}

async function isCompanyAdmin(userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ slug: roles.slug }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, userId));
  return rows.some((r) => r.slug === 'system_admin' || r.slug === 'office_admin');
}

export class MakerCheckerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MakerCheckerError';
  }
}

/**
 * The controls on a status move, checked before it happens: approving needs
 * every variance flag acknowledged and a different person from the generator;
 * locking needs a different person from the generator (strict mode: also not
 * someone the run pays). Refusals about the person are audited DENIED_SELF.
 */
export async function assertCanMove(run: PayrollRun, to: string, actorUserId: string): Promise<void> {
  if (to !== 'APPROVED' && to !== 'LOCKED') return;
  const step = to === 'APPROVED' ? 'approve' : 'lock';
  const [settings, admin, actorEmployee] = await Promise.all([readSettings(), isCompanyAdmin(actorUserId), repo.actorEmployeeId(actorUserId)]);
  const slips = actorEmployee || settings.makerChecker === 'strict' ? await payrollRepo.findSlipsByRunId(run.id) : [];
  const refusal = checkerRefusal({
    mode: settings.makerChecker,
    step,
    generatedBy: run.generatedBy,
    actor: actorUserId,
    actorIsAdmin: admin,
    runIncludesActor: !!actorEmployee && slips.some((s) => s.employeeId === actorEmployee),
  });
  if (refusal) {
    await recordAuditLog({ userId: actorUserId, action: 'APPROVE', module: 'PAYROLL_REVIEW', recordId: run.id, result: DENIED_SELF, newValues: { step, reason: refusal } });
    throw new MakerCheckerError(CHECKER_MESSAGE[refusal](step));
  }
  if (to === 'APPROVED') {
    const review = await varianceReview(run.id);
    if (review.unresolved.length) {
      throw new UserFacingError(`${review.unresolved.length} variance flag(s) still need to be acknowledged before this run can be approved.`);
    }
  }
}

// ---- F3 publish / hold / release -----------------------------------------------------

export async function publishRun(runId: string, ctx: ControlCtx): Promise<{ publishedAt: Date }> {
  const run = await payrollRepo.findPayrollRunById(runId);
  if (!run) throw new UserFacingError('Not found: this payroll run no longer exists.');
  if (!canPublishRun(run.status, run.publishedAt ?? null)) throw new UserFacingError(run.status !== 'LOCKED' ? 'Only a locked run can be published.' : 'This run is already published.');
  const row = await repo.publishRun(runId, ctx.userId);
  if (!row?.publishedAt) throw new UserFacingError('Someone already published this run — refresh.');
  return { publishedAt: row.publishedAt };
}

export async function holdSlip(slipId: string, reason: unknown, ctx: ControlCtx): Promise<void> {
  const target = await repo.findSlipRun(slipId);
  if (!target) throw new UserFacingError('Not found: this payslip no longer exists.');
  const text = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
  if (text.length < 3) throw new UserFacingError('Say why the payslip is held back.');
  if (!(await repo.holdSlip(slipId, text, ctx.userId))) throw new UserFacingError('This payslip is already on hold.');
}

export async function releaseSlip(slipId: string): Promise<void> {
  if (!(await repo.releaseSlip(slipId))) throw new UserFacingError('This payslip is not on hold.');
}

export async function heldPayslips(runId: string) {
  return repo.heldSlips(runId);
}

/** S21 on pay: nobody changes their own payslip (override, recalculation, new head, delete). */
export async function assertNotOwnSlip(slipId: string, userId: string, action: 'EDIT' | 'DELETE'): Promise<void> {
  const actorEmployee = await repo.actorEmployeeId(userId);
  if (!actorEmployee) return;
  const target = await repo.findSlipRun(slipId);
  if (target && target.employeeId === actorEmployee) {
    await recordAuditLog({ userId, action, module: 'PAYROLL_REVIEW', recordId: slipId, result: DENIED_SELF });
    throw new UserFacingError('Your own payslip must be changed by someone else.');
  }
}

// ---- pre-flight --------------------------------------------------------------------------

export interface PreflightResult {
  findings: PreflightFinding[];
  employeeCount: number;
  blocked: boolean;
}

export async function preflight(payload: PayrollRunSetupPayload): Promise<PreflightResult> {
  const { start, end } = getBSMonthRange(payload.payPeriodYear, payload.payPeriodMonth);
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const all = await employeeRepository.findAll({ search: '', branchId: payload.branchIds.length === 1 ? payload.branchIds[0] : 'all', departmentId: 'all', category: 'all', status: 'Active' });
  const people = all.filter(
    (e) =>
      payload.branchIds.includes(e.branchId) &&
      (!payload.departmentIds?.length || payload.departmentIds.includes(e.departmentId)) &&
      (!payload.designationIds?.length || payload.designationIds.includes(e.designationId)) &&
      (!payload.employeeCategories?.length || payload.employeeCategories.includes(e.category)) &&
      (!payload.employeeIds?.length || payload.employeeIds.includes(e.id)),
  );
  const ids = people.map((e) => e.id);
  const label = (e: { fullName: string; employeeCode: string }) => `${e.fullName} (${e.employeeCode})`;

  const db = await getDb();
  const [settings, salaries, needSetup, periods, existing, gaps, pending, branchRows, statutoryHeads] = await Promise.all([
    readSettings(),
    salaryMappingRepository.findInForceByEmployeeIds(ids, endStr),
    employeesNeedingSetup(),
    attendanceRepo.findPeriods('BS', payload.payPeriodYear, payload.payPeriodMonth),
    payrollRepo.findPayrollRunByPeriodAndBranch({ payPeriodMonth: payload.payPeriodMonth, payPeriodYear: payload.payPeriodYear, branchIds: payload.branchIds, runType: asRunType(payload.runType) }),
    repo.bankAndPanGaps(ids),
    ids.length
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(leaveApplications)
          .where(and(inArray(leaveApplications.employeeId, ids), eq(leaveApplications.status, 'Pending'), sql`leave_applications.effective_from <= ${endStr}::date`, sql`leave_applications.effective_to >= ${startStr}::date`))
      : Promise.resolve([{ n: 0 }]),
    payload.branchIds.length ? db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, payload.branchIds)) : Promise.resolve([]),
    repo.statutoryHeadsPresent(),
  ]);

  const closed = new Set(periods.filter((p) => p.status === 'closed').map((p) => p.branchId));
  const branchesInUse = new Set(people.map((e) => e.branchId));
  const openBranches = branchRows.filter((b) => branchesInUse.has(b.id) && !closed.has(b.id)).map((b) => b.name);
  const statuses = existing.map((r) => r.status);
  const findings = preflightFindings({
    openAttendanceBranches: openBranches,
    employeesWithoutSalary: people.filter((e) => !salaries.has(e.id)).map(label),
    employeesNeedingSetup: people.filter((e) => needSetup.has(e.id)).map(label),
    pendingLeaveCount: Number(pending[0]?.n ?? 0),
    employeesWithoutBank: gaps.withoutBank,
    employeesWithoutPan: gaps.withoutPan,
    existingRunStatus: statuses.includes('LOCKED') ? 'LOCKED' : statuses[0] ?? null,
    requireClosedAttendance: settings.requireClosedAttendance,
    statutoryHeads,
    runType: asRunType(payload.runType),
  });
  return { findings, employeeCount: people.length, blocked: findings.some((f) => f.severity === 'blocker') };
}
