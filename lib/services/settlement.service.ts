import * as repo from '@/lib/repositories/settlement.repository';
import { findEarlierTaxMonths } from '@/lib/repositories/payroll.repository';
import * as exitRepo from '@/lib/repositories/exit.repository';
import * as configRepo from '@/lib/repositories/payroll-control.repository';
import * as leaveRepo from '@/lib/repositories/leave.repository';
import * as salaryRepo from '@/lib/repositories/salary-mapping.repository';
import * as taxRateRepo from '@/lib/repositories/tax-rate.repository';
import * as systemControlRepo from '@/lib/repositories/system-control.repository';
import { userNames } from '@/lib/repositories/evaluation.repository';
import { payoutOf } from '@/lib/services/leave-salary.service';
import { calculateLeaveSalary } from '@/lib/engines/leave-salary.engine';
import { calculateAnnualTaxFromSlabs } from '@/lib/engines/payroll.engine';
import {
  buildSettlement,
  canMove,
  completedYears,
  DEFAULT_POLICY,
  normalizePolicy,
  validatePolicy,
  type LeaveEncashment,
  type SalaryPeriod,
  type SettlementLine,
  type SettlementPolicy,
  type SettlementStatus,
} from '@/lib/engines/settlement.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBS, getDaysInBSMonth } from '@/lib/utils/bs-calendar';
import { getFiscalMonthIndex } from '@/lib/utils/fiscal-year.utils';
import type { SettlementData, SettlementView } from '@/lib/types/settlement';
import type { TaxSheet } from '@/lib/engines/tax-projection.engine';

// Full & final settlement (4.8 / F8): gathers the facts, lets the pure engine work the
// statement out, freezes it, and walks it draft → approved → paid. S31 (the S21 pattern):
// nobody prepares, approves or pays the settlement of their own exit. Loans and fund
// balances are shown, never changed here: the employee goes Inactive on Complete, so no
// later payroll deducts the loan, and fund payouts stay under Funds (S33).

export class PolicyValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'PolicyValidationError';
  }
}

export interface SettlementCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

export async function readPolicy(): Promise<SettlementPolicy> {
  const raw = await configRepo.readConfig(repo.POLICY_KEY);
  if (!raw) return DEFAULT_POLICY;
  try {
    return normalizePolicy(JSON.parse(raw));
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function savePolicy(raw: unknown, ctx: SettlementCtx): Promise<SettlementPolicy> {
  const policy = normalizePolicy(raw);
  const errors = validatePolicy(policy);
  if (Object.keys(errors).length) throw new PolicyValidationError(errors);
  await configRepo.writeConfig(repo.POLICY_KEY, JSON.stringify(policy));
  await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'SYSTEM_CONTROL', recordId: repo.POLICY_KEY, result: 'SUCCESS', newValues: { settlementPolicy: policy } });
  return policy;
}

const iso = (d: Date) => d.toISOString();

async function toView(row: repo.SettlementRow): Promise<SettlementView> {
  const ids = [row.preparedBy, row.approvedBy, row.paidBy].filter((x): x is string => !!x);
  const names = await userNames([...new Set(ids)]);
  const name = (id: string | null) => (id ? names.get(id) ?? '—' : null);
  return {
    id: row.id,
    status: row.status as SettlementStatus,
    lines: row.lines as SettlementLine[],
    earnings: row.earnings,
    deductions: row.deductions,
    net: row.net,
    recovery: Number(row.net) < 0,
    taxSheet: (row.taxSheet as TaxSheet | null) ?? null,
    preparedByName: name(row.preparedBy) ?? '—',
    preparedAt: iso(row.preparedAt),
    approvedByName: name(row.approvedBy),
    approvedAt: row.approvedAt ? iso(row.approvedAt) : null,
    paidByName: name(row.paidBy),
    paidAt: row.paidAt ? iso(row.paidAt) : null,
    paymentRef: row.paymentRef,
  };
}

async function scopedCase(caseId: string, ctx: SettlementCtx) {
  const row = await exitRepo.findCase(caseId, buildEmployeeScopeCondition(ctx.scope));
  if (!row) throw new UserFacingError('Not found: this exit case is not in your scope.');
  return row;
}

async function refuseOwn(ctx: SettlementCtx, employeeId: string, caseId: string) {
  if (isOwnRecord(ctx.actorEmployeeId, employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'EDIT', module: 'EMPLOYEES', recordId: caseId, result: DENIED_SELF });
    throw new UserFacingError('Your own exit settlement must be handled by someone else.');
  }
}

export async function getSettlement(caseId: string, ctx: SettlementCtx, permissions: SettlementData['permissions']): Promise<SettlementData> {
  const c = await scopedCase(caseId, ctx);
  const [row, policy, facts] = await Promise.all([repo.findByCase(caseId), readPolicy(), exitRepo.exitFacts(c.employeeId, c.lastWorkingDayAd)]);
  return { settlement: row ? await toView(row) : null, policy, funds: facts.funds, permissions };
}

/** BS months still without a payslip, up to and including the last working day's month. */
function unpaidPeriods(lastDayAd: string, slips: { year: number; month: number }[]): SalaryPeriod[] {
  const last = adToBS(new Date(`${lastDayAd}T00:00:00`));
  const key = (y: number, m: number) => y * 100 + m;
  const target = key(last.year, last.month);
  const paid = new Set(slips.map((s) => key(s.year, s.month)));
  const latest = slips.reduce((max, s) => Math.max(max, key(s.year, s.month)), 0);
  const out: SalaryPeriod[] = [];
  let y = last.year;
  let m = last.month;
  // Walk back from the last working day's month to the month after the latest payslip (at most six).
  for (let i = 0; i < 6; i++) {
    if (paid.has(key(y, m)) || (latest && key(y, m) <= latest)) break;
    const monthDays = getDaysInBSMonth(y, m);
    out.unshift({ label: `${y}-${String(m).padStart(2, '0')}`, workedDays: key(y, m) === target ? last.day : monthDays, monthDays });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

async function leaveEncashments(employeeId: string, basicSalary: string): Promise<LeaveEncashment[]> {
  const [balances, types] = await Promise.all([leaveRepo.findLeaveBalancesByEmployee(employeeId), leaveRepo.findEncashableLeaveTypes()]);
  const out: LeaveEncashment[] = [];
  for (const t of types) {
    const balance = balances.find((b) => b.leaveTypeId === t.id)?.balance ?? 0;
    const days = t.accumulationCap !== null && t.accumulationCap !== undefined ? Math.min(balance, t.accumulationCap) : balance;
    if (days <= 0) continue;
    const pay = await payoutOf(t);
    const { perDayRate } = calculateLeaveSalary({ basicSalary, leaveDays: 1, encashmentRate: pay.encashmentRate, fixedDailyAmount: pay.fixedDailyAmount });
    out.push({ leaveType: t.name, days, perDayRate });
  }
  return out;
}

const dayGap = (fromAd: string, toAd: string) => Math.max(0, Math.round((new Date(`${toAd}T00:00:00Z`).getTime() - new Date(`${fromAd}T00:00:00Z`).getTime()) / 86_400_000));

export async function prepareSettlement(caseId: string, ctx: SettlementCtx): Promise<SettlementView> {
  const c = await scopedCase(caseId, ctx);
  await refuseOwn(ctx, c.employeeId, caseId);
  if (c.status === 'cancelled') throw new UserFacingError('A cancelled case has no settlement.');

  const existing = await repo.findByCase(caseId);
  if (existing && existing.status !== 'draft') throw new UserFacingError(`The settlement is already ${existing.status}; it cannot be prepared again.`);

  const [emp, mapping, policy, facts, slips, ssf, fy] = await Promise.all([
    repo.employeeFacts(c.employeeId),
    salaryRepo.findActiveSalaryMappingByEmployeeId(c.employeeId),
    readPolicy(),
    exitRepo.exitFacts(c.employeeId, c.lastWorkingDayAd),
    repo.slipMonths(c.employeeId),
    repo.paysSsf(c.employeeId),
    repo.fiscalYearOn(c.lastWorkingDayAd),
  ]);
  if (!emp) throw new UserFacingError('Employee not found.');
  if (!mapping) throw new UserFacingError('This employee has no salary structure; set one up before preparing the settlement.');
  if (!fy) throw new UserFacingError('No fiscal year covers the last working day.');

  const slabs = await taxRateRepo.findSlabsByFiscalYear(fy.id);
  if (!slabs.length) throw new UserFacingError('No tax slabs are set for the fiscal year of the last working day.');
  const slabInputs = slabs.map((s) => ({ id: s.id, category: s.category, amountFrom: s.amountFrom.toString(), amountTo: s.amountTo ? s.amountTo.toString() : null, ratePercent: s.ratePercent.toString(), fixedDeduction: s.fixedDeduction.toString() }));
  const systemControl = await systemControlRepo.findSettings();
  const employeeInput = { id: emp.id, category: emp.category, gender: emp.gender, isDisabled: emp.isDisabled, taxStatus: emp.taxStatus, joiningDate: String(emp.joiningDate) };

  const lastBs = adToBS(new Date(`${c.lastWorkingDayAd}T00:00:00`));
  const past = (await findEarlierTaxMonths([emp.id], fy.id, getFiscalMonthIndex(lastBs.month) + 1)).get(emp.id) ?? [];

  const basic = String(mapping.basicSalary);
  const settlement = buildSettlement({
    kind: c.kind,
    monthlyBasic: basic,
    monthlyGrade: String(mapping.gradeAmount ?? 0),
    periods: unpaidPeriods(c.lastWorkingDayAd, slips),
    leave: await leaveEncashments(emp.id, basic),
    noticeServedDays: c.noticeDate ? dayGap(String(c.noticeDate), c.lastWorkingDayAd) : null,
    yearsOfService: completedYears(String(emp.joiningDate), c.lastWorkingDayAd),
    loanOutstanding: facts.loanOutstanding,
    past,
    taxOn: (annual) => calculateAnnualTaxFromSlabs(annual, employeeInput, slabInputs, systemControl, ssf),
    policy,
  });

  const saved = await repo.saveDraft(
    caseId,
    emp.id,
    { lines: settlement.lines, earnings: settlement.earnings, deductions: settlement.deductions, net: settlement.net, taxSheet: settlement.taxSheet, policy },
    ctx.userId,
  );
  if (!saved) throw new UserFacingError('Someone already approved this settlement — refresh.');
  return toView(saved);
}

async function move(caseId: string, to: 'approved' | 'paid', paymentRef: string | null, ctx: SettlementCtx): Promise<SettlementView> {
  const c = await scopedCase(caseId, ctx);
  await refuseOwn(ctx, c.employeeId, caseId);
  const row = await repo.findByCase(caseId);
  if (!row) throw new UserFacingError('Prepare the settlement first.');
  const from = row.status as SettlementStatus;
  const refusal = canMove(from, to, row.preparedBy, ctx.userId);
  if (refusal) throw new UserFacingError(refusal);
  if (to === 'paid' && !paymentRef?.trim()) throw new UserFacingError('Enter the payment reference (cheque, voucher or transfer number).');
  const claimed = await repo.claim(row.id, from as 'draft' | 'approved', to, ctx.userId, paymentRef?.trim() || null);
  if (!claimed) throw new UserFacingError('Someone already moved this settlement — refresh.');
  return toView(claimed);
}

export const approveSettlement = (caseId: string, ctx: SettlementCtx) => move(caseId, 'approved', null, ctx);
export const markSettlementPaid = (caseId: string, paymentRef: string, ctx: SettlementCtx) => move(caseId, 'paid', typeof paymentRef === 'string' ? paymentRef.slice(0, 100) : null, ctx);
