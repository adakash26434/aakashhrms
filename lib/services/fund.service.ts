import { randomUUID } from 'node:crypto';
import * as repo from '@/lib/repositories/fund.repository';
import { findEmployeeOptions } from '@/lib/repositories/letter.repository';
import {
  contributionRef,
  fundBalance,
  monthlyContribution,
  normalizeFundTypeForm,
  normalizePostingForm,
  postingAmounts,
  previousBsMonth,
  validateFundTypeForm,
  validatePosting,
} from '@/lib/engines/fund.engine';
import { buildEmployeeScopeCondition, type ScopeFilter } from '@/lib/auth/scope-filter';
import { DENIED_SELF, isOwnRecord } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { UserFacingError } from '@/lib/errors/action-error';
import { adToBS } from '@/lib/utils/bs-calendar';
import { nepalToday } from '@/lib/utils/nepal-time';
import type { FundBalanceRow, FundLineView, FundTypeView, FundsPageData } from '@/lib/types/fund';

// Welfare funds (G9): orchestration. The ledger is append-only; postings are
// idempotent by ref; payouts never take a share below zero; S33 (the S21
// pattern): nobody posts openings, payouts or adjustments to their own fund.

export class FundValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'FundValidationError';
  }
}

export interface FundCtx {
  userId: string;
  actorEmployeeId: string | null;
  scope: ScopeFilter;
}

export async function fundsPage(ctx: FundCtx, permissions: FundsPageData['permissions']): Promise<FundsPageData> {
  const scopeCondition = buildEmployeeScopeCondition(ctx.scope);
  const [types, balanceRows, totals, employees] = await Promise.all([
    repo.listFundTypes(),
    repo.balances(scopeCondition),
    repo.fundTotals(scopeCondition),
    findEmployeeOptions(scopeCondition),
  ]);
  const totalByFund = new Map(totals.map((t) => [t.fundTypeId, t]));
  const nameByFund = new Map(types.map((t) => [t.id, t.name]));
  return {
    funds: types.map((t): FundTypeView => {
      const total = totalByFund.get(t.id);
      const sums = fundBalance([{ employeeAmount: total?.employeeSum ?? 0, employerAmount: total?.employerSum ?? 0 }]);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        nameNp: t.nameNp,
        contributionMode: t.contributionMode === 'percent_basic' ? 'percent_basic' : 'fixed',
        employeeValue: Number(t.employeeValue),
        employerValue: Number(t.employerValue),
        note: t.note,
        isActive: t.isActive,
        members: total?.members ?? 0,
        employeeSum: sums.employee,
        employerSum: sums.employer,
        total: sums.total,
      };
    }),
    balances: balanceRows.map((b): FundBalanceRow => {
      const sums = fundBalance([{ employeeAmount: b.employeeSum, employerAmount: b.employerSum }]);
      return {
        fundTypeId: b.fundTypeId,
        fundName: nameByFund.get(b.fundTypeId) ?? '—',
        employeeId: b.employeeId,
        employeeName: b.employeeName,
        employeeCode: b.employeeCode,
        branch: b.branch,
        employeeShare: sums.employee,
        employerShare: sums.employer,
        total: sums.total,
      };
    }),
    employees,
    permissions,
  };
}

export async function saveFundType(id: string | null, raw: unknown, ctx: FundCtx) {
  const form = normalizeFundTypeForm(raw);
  const errors = validateFundTypeForm(form);
  if (Object.keys(errors).length) throw new FundValidationError(errors);
  const write = {
    name: form.name,
    nameNp: form.nameNp,
    contributionMode: form.contributionMode,
    employeeValue: form.employeeValue.toFixed(2),
    employerValue: form.employerValue.toFixed(2),
    note: form.note || null,
    isActive: form.isActive,
  };
  if (id) {
    // The code never changes: contribution refs embed it.
    const row = await repo.updateFundType(id, write, ctx.userId);
    if (!row) throw new UserFacingError('Not found: this fund no longer exists.');
    return row;
  }
  try {
    return await repo.insertFundType({ code: form.code, ...write }, ctx.userId);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      throw new FundValidationError({ code: 'A fund with this code already exists.' });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Postings
// ---------------------------------------------------------------------------

export async function memberBalance(fundTypeId: string, employeeId: string, ctx: FundCtx) {
  const inScope = (await findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).some((e) => e.id === employeeId);
  if (!inScope) throw new UserFacingError('Not found: this employee is not in your scope.');
  const lines = await repo.linesFor(fundTypeId, employeeId, 10000);
  return fundBalance(lines.map((l) => ({ employeeAmount: l.employeeAmount, employerAmount: l.employerAmount })));
}

export async function memberLines(fundTypeId: string, employeeId: string, ctx: FundCtx): Promise<FundLineView[]> {
  const inScope = (await findEmployeeOptions(buildEmployeeScopeCondition(ctx.scope))).some((e) => e.id === employeeId);
  if (!inScope) throw new UserFacingError('Not found: this employee is not in your scope.');
  const lines = await repo.linesFor(fundTypeId, employeeId);
  return lines.map((l) => ({
    id: l.id,
    kind: l.kind,
    employeeAmount: Number(l.employeeAmount).toFixed(2),
    employerAmount: Number(l.employerAmount).toFixed(2),
    ref: l.ref,
    note: l.note,
    postedAt: l.postedAt.toISOString(),
  }));
}

export async function postFundEntry(raw: unknown, ctx: FundCtx) {
  const form = normalizePostingForm(raw);

  // S33: nobody posts to their own fund.
  if (isOwnRecord(ctx.actorEmployeeId, form.employeeId)) {
    await recordAuditLog({ userId: ctx.userId, action: 'ADD', module: 'WELFARE_FUNDS', recordId: form.employeeId, result: DENIED_SELF });
    throw new UserFacingError('A posting to your own fund must be made by someone else.');
  }

  const fund = form.fundTypeId ? await repo.findFundType(form.fundTypeId) : null;
  if (!fund) throw new FundValidationError({ fundTypeId: 'Choose the fund.' });
  const balance = await memberBalance(form.fundTypeId, form.employeeId, ctx);
  const errors = validatePosting(form, balance);
  if (Object.keys(errors).length) throw new FundValidationError(errors);

  const amounts = postingAmounts(form);
  const ref = `${form.kind === 'opening' ? 'opening' : form.kind === 'payout' ? 'payout' : 'adjust'}:${randomUUID()}`;
  await repo.postLines([
    {
      fundTypeId: form.fundTypeId,
      employeeId: form.employeeId,
      kind: form.kind,
      employeeAmount: amounts.employeeAmount,
      employerAmount: amounts.employerAmount,
      ref,
      note: form.note || null,
      postedBy: ctx.userId,
    },
  ]);
  return { ref, ...amounts };
}

// ---------------------------------------------------------------------------
// Monthly contributions (the fund-contributions job, BS day 1)
// ---------------------------------------------------------------------------

/** Posts the previous BS month's contributions for every active fund and employee; idempotent by ref. */
export async function postMonthlyContributions(): Promise<{ posted: number; funds: number }> {
  const bs = adToBS(nepalToday());
  const { year, month } = previousBsMonth(bs.year, bs.month);
  const [types, members] = await Promise.all([repo.listFundTypes(), repo.contributionEmployees()]);
  const active = types.filter((t) => t.isActive);
  let posted = 0;
  for (const fund of active) {
    const ref = contributionRef(fund.code, year, month);
    const lines: Parameters<typeof repo.postLines>[0] = [];
    for (const member of members) {
      const amounts = monthlyContribution(
        { contributionMode: fund.contributionMode, employeeValue: fund.employeeValue, employerValue: fund.employerValue },
        member.basicSalary ?? 0,
      );
      if (amounts.employeeAmount === '0.00' && amounts.employerAmount === '0.00') continue;
      lines.push({
        fundTypeId: fund.id,
        employeeId: member.id,
        kind: 'contribution',
        employeeAmount: amounts.employeeAmount,
        employerAmount: amounts.employerAmount,
        ref,
        note: null,
        postedBy: null,
      });
    }
    posted += await repo.postLines(lines);
  }
  return { posted, funds: active.length };
}
