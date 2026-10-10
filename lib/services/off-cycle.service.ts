import Decimal from 'decimal.js';
import { getDb } from '@/lib/db';
import { auditLogs, payHeads, payrollSlipHeads, payrollSlips } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import * as repository from '@/lib/repositories/payroll.repository';
import * as feedsRepository from '@/lib/repositories/payroll-feeds.repository';
import * as employeeRepository from '@/lib/repositories/employee.repository';
import * as salaryMappingRepository from '@/lib/repositories/salary-mapping.repository';
import * as systemControlRepository from '@/lib/repositories/system-control.repository';
import * as taxRateRepository from '@/lib/repositories/tax-rate.repository';
import * as fiscalYearRepository from '@/lib/repositories/fiscal-year.repository';
import * as arrearsService from '@/lib/services/arrears.service';
import * as openingRepository from '@/lib/repositories/opening-balance.repository';
import * as payrollFeedService from '@/lib/services/payroll-feed.service';
import { coveredByOpeningMessage } from '@/lib/engines/opening-balance.engine';
import { calculateAnnualTaxFromSlabs, isSsfDeductionHead, isSsfEmployerHead, occasionalHeadAmount, type TaxSlabInput } from '@/lib/engines/payroll.engine';
import { asRunType, calculateOffCycleSlip, festivalShare, projectedBefore, RUN_TYPE_LABEL, type OffCycleLine } from '@/lib/engines/off-cycle.engine';
import { getFiscalMonthIndex } from '@/lib/utils/fiscal-year.utils';
import { BS_MONTHS_EN, getBSMonthRange } from '@/lib/utils/bs-calendar';
import { toIsoDate } from '@/lib/utils/nepal-time';
import { UserFacingError } from '@/lib/errors/action-error';
import { logger } from '@/lib/logger';
import type { Employee } from '@/lib/types/employee';
import type { PayrollRun, PayrollRunSetupPayload, PayrollSlipOverridePayload } from '@/lib/types/payroll';
import type { SalaryMapping } from '@/lib/types/salary-mapping';
import type { SystemControlData } from '@/lib/types/system-control';

// Off-cycle pay runs (4.8 / F6): FESTIVAL and ARREARS runs in a pay month, next to the regular
// salary. They pay only their own lines and withhold the marginal tax (off-cycle.engine); the
// lifecycle (review → approve → lock → publish, maker-checker) is the regular one. Locking an
// off-cycle run seals its payslips only: no attendance, loans or salary-structure changes.

type PayHeadRow = typeof payHeads.$inferSelect;

interface TaxContext {
  fiscalYearId: string;
  fiscalMonthIndex: number;
  slabs: TaxSlabInput[];
  control: SystemControlData;
}

async function taxContext(fiscalYearId: string, payPeriodMonth: number): Promise<TaxContext> {
  const [slabs, control] = await Promise.all([taxRateRepository.findSlabsByFiscalYear(fiscalYearId), systemControlRepository.findSettings()]);
  return {
    fiscalYearId,
    fiscalMonthIndex: getFiscalMonthIndex(payPeriodMonth),
    slabs: slabs.map((s) => ({ id: s.id, category: s.category, amountFrom: s.amountFrom.toString(), amountTo: s.amountTo ? s.amountTo.toString() : null, ratePercent: s.ratePercent.toString(), fixedDeduction: s.fixedDeduction.toString() })),
    control,
  };
}

const isoDate = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : toIsoDate(d));

/** SSF contributors are exempt from the 1% band, as in the regular engine. */
function paysSsf(map: SalaryMapping | undefined, heads: Map<string, PayHeadRow>): boolean {
  return !!map?.salaryHeads.some((h) => {
    const head = heads.get(h.payHeadId);
    return !!head && (head.isSsfHead || head.isSsfEmployerHead || isSsfDeductionHead(head) || isSsfEmployerHead(head));
  });
}

/**
 * Projected annual taxable income before this run's payment, per employee: the year's final
 * payslips so far (this month's other runs included) plus the regular monthly taxable income for
 * the months still to come (this month's too when its regular salary is not final yet).
 */
async function projectionBases(employees: readonly Employee[], salaries: Map<string, SalaryMapping>, ctx: TaxContext, excludeRunId?: string): Promise<Map<string, Decimal>> {
  const ids = employees.map((e) => e.id);
  const [history, facts] = await Promise.all([
    repository.findEarlierTaxMonths(ids, ctx.fiscalYearId, ctx.fiscalMonthIndex, excludeRunId, 'all'),
    repository.offCycleProjectionFacts(ids, ctx.fiscalYearId, ctx.fiscalMonthIndex),
  ]);
  const out = new Map<string, Decimal>();
  for (const e of employees) {
    const ytd = (history.get(e.id) ?? []).reduce((s, m) => s.plus(m.taxableIncome || 0), new Decimal(0));
    const f = facts.get(e.id);
    // Without a regular payslip yet this year, basic + grade is the best estimate of a month.
    const map = salaries.get(e.id);
    const monthly = f?.latestRegularTaxable ?? (map ? new Decimal(map.basicSalary || 0).plus(map.gradeAmount || 0).toString() : '0');
    const monthsAhead = 12 - ctx.fiscalMonthIndex + (f?.regularFinalThisMonth ? 0 : 1);
    out.set(e.id, projectedBefore({ ytdTaxable: ytd, regularMonthlyTaxable: monthly, monthsAhead }));
  }
  return out;
}

function taxOnFor(e: Pick<Employee, 'id' | 'category' | 'gender' | 'isDisabled' | 'taxStatus' | 'joiningDate'>, ctx: TaxContext, ssf: boolean) {
  const employee = { id: e.id, category: e.category, gender: e.gender, isDisabled: e.isDisabled, taxStatus: e.taxStatus, joiningDate: isoDate(e.joiningDate) };
  return (annual: Decimal) => calculateAnnualTaxFromSlabs(annual, employee, ctx.slabs, ctx.control, ssf);
}

/** The lines an off-cycle run pays one employee. */
function festivalLines(e: Employee, map: SalaryMapping, chosen: PayHeadRow[], onAd: string, prorate: boolean, remoteLimit: number): OffCycleLine[] {
  const basic = new Decimal(map.basicSalary || 0);
  const bpg = basic.plus(map.gradeAmount || 0);
  const share = prorate ? festivalShare(isoDate(e.joiningDate), onAd) : new Decimal(1);
  return chosen.map((head) => {
    // The employee's own assignment of the head (an agreed amount) wins over the head's rule.
    const own = map.salaryHeads.find((h) => h.payHeadId === head.id);
    const amount =
      occasionalHeadAmount(
        { isFestivalAllowance: head.isFestivalAllowance, isRemoteAllowance: head.isRemoteAllowance, isManualOverride: false, calcBasis: head.calcBasis, calcPercent: head.calcPercent?.toString() ?? '0', amount: own ? String(own.amount) : '0' },
        basic,
        bpg,
        { festivalMonth: true, remoteMonth: true, remoteLimit },
      ) ?? new Decimal(0);
    return { payHeadId: head.id, payHeadName: head.name, amount: amount.times(share).toDecimalPlaces(2, Decimal.ROUND_HALF_UP), taxable: head.effectOnTax };
  });
}

export async function generateOffCycleRun(payload: PayrollRunSetupPayload, userId: string): Promise<PayrollRun> {
  const runType = asRunType(payload.runType);
  if (runType === 'REGULAR') throw new UserFacingError('Use the regular payroll run for the monthly salary.');
  const label = RUN_TYPE_LABEL[runType].en.toLowerCase();
  const { payPeriodMonth, payPeriodYear, branchIds } = payload;
  const { start, end } = getBSMonthRange(payPeriodYear, payPeriodMonth);
  const startStr = toIsoDate(start);
  const endStr = toIsoDate(end);

  // One run of each type per pay month and branch.
  const existing = await repository.findPayrollRunByPeriodAndBranch({ payPeriodMonth, payPeriodYear, branchIds, runType });
  if (existing.length) {
    if (existing.some((r) => r.status !== 'DRAFT') || !payload.recreateIfExists) {
      throw new UserFacingError(
        existing.some((r) => r.status === 'LOCKED')
          ? `A ${label} run for ${BS_MONTHS_EN[payPeriodMonth]} ${payPeriodYear} is already locked.`
          : `A ${label} run already exists for ${BS_MONTHS_EN[payPeriodMonth]} ${payPeriodYear}${existing.some((r) => r.status !== 'DRAFT') ? ' and is past draft — send it back to draft or delete it first.' : '.'}`,
      );
    }
    for (const run of existing) {
      await payrollFeedService.discardDraftRun(run.id);
      await (await getDb()).insert(auditLogs).values({ userId, action: 'DELETE', module: 'PAYROLL_GENERATE', recordId: run.id, result: 'SUCCESS', oldValues: { runId: run.id, runType, status: run.status, reason: 'Overwritten on regeneration' }, newValues: null });
    }
  }

  const fiscalYear = (await fiscalYearRepository.findAllFiscalYears()).find((y) => y.status === 'Active');
  if (!fiscalYear) throw new UserFacingError('No active fiscal year.');
  const people = await employeeRepository.findForPayrollScope(payload);
  if (!people.length) throw new UserFacingError('No active employees in the selected scope.');
  const ids = people.map((e) => e.id);

  const [salaries, allHeads, ctx] = await Promise.all([salaryMappingRepository.findInForceByEmployeeIds(ids, endStr), (await getDb()).select().from(payHeads), taxContext(fiscalYear.id, payPeriodMonth)]);
  const headById = new Map(allHeads.map((h) => [h.id, h]));
  const tdsHead = allHeads.find((h) => h.isTdsHead) ?? null;

  // What each employee is paid.
  const linesByEmployee = new Map<string, OffCycleLine[]>();
  let arrears: Awaited<ReturnType<typeof arrearsService.arrearsFor>> = new Map();
  if (runType === 'FESTIVAL') {
    const chosen = (payload.occasionalAllowanceHeadIds ?? []).map((id) => headById.get(id)).filter((h): h is PayHeadRow => !!h && h.isFestivalAllowance);
    if (!chosen.length) throw new UserFacingError('Choose the festival allowance head to pay.');
    const missing = people.filter((e) => !salaries.has(e.id));
    if (missing.length) throw new UserFacingError(`No salary structure in force for: ${missing.slice(0, 5).map((e) => `${e.fullName} (${e.employeeCode})`).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}.`);
    const prorate = payload.prorateFestival !== false;
    for (const e of people) linesByEmployee.set(e.id, festivalLines(e, salaries.get(e.id)!, chosen, endStr, prorate, Number(ctx.control.insuranceDiscounts.remoteAllowanceNpr) || 0));
  } else {
    const arrearsHead = (await feedsRepository.feedHeads()).arrears;
    if (!arrearsHead) throw new UserFacingError('The ARREARS pay head is missing — restart the server so the schema sync seeds it.');
    arrears = await arrearsService.arrearsFor(ids, startStr);
    for (const [employeeId, a] of arrears) {
      if (a.payable > 0) linesByEmployee.set(employeeId, [{ payHeadId: arrearsHead.id, payHeadName: arrearsHead.name, amount: a.payable.toFixed(2), taxable: arrearsHead.effectOnTax }]);
    }
  }
  const payees = people.filter((e) => (linesByEmployee.get(e.id) ?? []).some((l) => new Decimal(l.amount || 0).gt(0)));
  if (!payees.length) throw new UserFacingError(runType === 'ARREARS' ? 'Nobody in scope is owed arrears.' : `Nobody in scope has a ${label} to pay.`);
  // F15: a month an opening balance covers belongs to the old system; a payment in it here
  // would sit outside the opening balance's months in the tax history.
  const coveredByOpening = await openingRepository.openingsCovering(payees.map((e) => e.id), fiscalYear.id, getFiscalMonthIndex(payPeriodMonth));
  if (coveredByOpening.length) throw new UserFacingError(coveredByOpeningMessage(coveredByOpening, BS_MONTHS_EN[payPeriodMonth]));

  const [bases, payee] = await Promise.all([projectionBases(payees, salaries, ctx), repository.slipPayeeFacts(payees)]);
  const slips = payees.map((e) => {
    const calc = calculateOffCycleSlip({
      category: e.category,
      lines: linesByEmployee.get(e.id)!,
      base: bases.get(e.id) ?? 0,
      taxOn: taxOnFor(e, ctx, paysSsf(salaries.get(e.id), headById)),
      tdsHead: tdsHead ? { id: tdsHead.id, name: tdsHead.name } : null,
    });
    const facts = payee.get(e.id)!;
    return {
      slip: {
        payrollRunId: '',
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.fullName,
        departmentName: facts.departmentName,
        designationName: facts.designationName,
        basicSalary: calc.basicSalary,
        gradeAmount: calc.gradeAmount,
        grossEarnings: calc.grossEarnings,
        totalDeductions: calc.totalDeductions,
        netPayable: calc.netPayable,
        taxableIncome: calc.taxableIncome,
        taxSheet: calc.marginal,
        tdsThisMonth: calc.tdsThisMonth,
        pfEmployee: '0',
        pfEmployer: '0',
        ssfEmployee: '0',
        ssfEmployer: '0',
        citDeduction: '0',
        loanDeduction: '0',
        absentDeduction: '0',
        otAmount: '0',
        bankAccountNumber: facts.bankAccountNumber,
        bankName: facts.bankName,
        payslipMonth: payload.payslipMonth,
        payslipDate: payload.payslipDate,
        status: 'DRAFT',
        isYearEndReconciliation: false,
        warnings: null,
      } satisfies typeof payrollSlips.$inferInsert,
      heads: calc.heads,
    };
  });
  const sum = (f: (s: (typeof slips)[number]['slip']) => string | null | undefined) => slips.reduce((t, s) => t.plus(f(s.slip) || 0), new Decimal(0)).toFixed(2);

  const run = await (await getDb()).transaction(async (tx) => {
    const created = await repository.createPayrollRun(
      {
        fiscalYearId: fiscalYear.id,
        payPeriodMonth,
        payPeriodYear,
        runType,
        payPeriodStartDate: startStr,
        payPeriodEndDate: endStr,
        branchIds,
        departmentIds: payload.departmentIds || [],
        designationIds: payload.designationIds || [],
        employeeCategories: payload.employeeCategories || [],
        employeeIds: payload.employeeIds || [],
        occasionalAllowanceHeadIds: runType === 'FESTIVAL' ? payload.occasionalAllowanceHeadIds || [] : [],
        payslipMonth: payload.payslipMonth,
        payslipDate: payload.payslipDate,
        status: 'DRAFT',
        totalGross: sum((s) => s.grossEarnings),
        totalDeductions: sum((s) => s.totalDeductions),
        totalNetPayable: sum((s) => s.netPayable),
        totalTds: sum((s) => s.tdsThisMonth),
        totalPf: '0.00',
        totalSsf: '0.00',
        employeeCount: slips.length,
        generatedBy: userId,
      },
      tx,
    );
    for (const s of slips) s.slip.payrollRunId = created.id;
    await repository.createPayrollSlips(slips, tx);
    // The arrears this run pays are recorded against their source months with the payslips (4.8 fix).
    if (runType === 'ARREARS') await payrollFeedService.settleRunFeedsTx(tx, created.id, [], new Map([...arrears].filter(([, a]) => a.payable > 0)));
    await tx.insert(auditLogs).values({ userId, action: 'ADD', module: 'PAYROLL_GENERATE', recordId: created.id, result: 'SUCCESS', newValues: { runType, period: `${payPeriodYear}-${payPeriodMonth}`, payslips: slips.length } });
    return created;
  });

  logger.info('Off-cycle payroll run generated', { runId: run.id, runType, payPeriodMonth, payPeriodYear, userId });
  return run;
}

/**
 * Re-works an off-cycle payslip from its own lines after an amount changed: the allowance lines
 * as they stand (a typed override wins) and a fresh marginal TDS. Only the head amounts of an
 * off-cycle payslip can change — it has no basic, attendance or loan lines.
 */
export async function recalculateOffCycleSlip(slipId: string, userId: string, override?: Pick<PayrollSlipOverridePayload, 'headId' | 'amount' | 'reason'>): Promise<void> {
  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new UserFacingError('Payslip not found.');
  const run = await repository.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new UserFacingError('Payroll run not found.');
  if (run.status !== 'DRAFT') throw new UserFacingError('Only a draft run can change.');
  const employee = await employeeRepository.findById(slip.employeeId);
  if (!employee) throw new UserFacingError('Employee not found.');

  const allHeads = await (await getDb()).select().from(payHeads);
  const headById = new Map(allHeads.map((h) => [h.id, h]));
  const tdsHead = allHeads.find((h) => h.isTdsHead) ?? null;
  const before = { ...slip };

  await (await getDb()).transaction(async (tx) => {
    if (override?.headId) {
      const line = (await tx.select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId))).find((h) => h.payHeadId === override.headId && h.headType === 'allowance');
      if (!line) throw new UserFacingError('Only the allowance lines of an off-cycle payslip can change.');
      const typed = String(override.amount ?? '0').trim() || '0';
      if (!/^\d+(\.\d{1,2})?$/.test(typed)) throw new UserFacingError('Enter an amount of zero or more (up to two decimals).');
      const amount = new Decimal(typed);
      await tx
        .update(payrollSlipHeads)
        .set({ amount: amount.toFixed(2), isManualOverride: true, overrideReason: override.reason || 'Manual override' })
        .where(eq(payrollSlipHeads.id, line.id));
    }
    const heads = await tx.select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
    const lines: OffCycleLine[] = heads
      .filter((h) => h.headType === 'allowance')
      .map((h) => ({ payHeadId: h.payHeadId, payHeadName: h.payHeadName, amount: h.isManualOverride ? h.amount : h.calculatedAmount, taxable: headById.get(h.payHeadId)?.effectOnTax ?? true }));

    const ctx = await taxContext(run.fiscalYearId, run.payPeriodMonth);
    const salaries = await salaryMappingRepository.findInForceByEmployeeIds([employee.id], run.payPeriodEndDate);
    const base = (await projectionBases([employee], salaries, ctx, run.id)).get(employee.id) ?? new Decimal(0);
    const calc = calculateOffCycleSlip({ category: employee.category, lines, base, taxOn: taxOnFor(employee, ctx, paysSsf(salaries.get(employee.id), headById)), tdsHead: tdsHead ? { id: tdsHead.id, name: tdsHead.name } : null });

    // Allowance lines keep their rows; the TDS line is written afresh.
    for (const h of calc.heads.filter((x) => x.headType === 'allowance')) {
      await tx.update(payrollSlipHeads).set({ calculatedAmount: h.calculatedAmount }).where(and(eq(payrollSlipHeads.payrollSlipId, slipId), eq(payrollSlipHeads.payHeadId, h.payHeadId)));
    }
    await tx.delete(payrollSlipHeads).where(and(eq(payrollSlipHeads.payrollSlipId, slipId), eq(payrollSlipHeads.headType, 'deduction')));
    const tds = calc.heads.find((x) => x.headType === 'deduction');
    if (tds) await tx.insert(payrollSlipHeads).values({ payrollSlipId: slipId, payHeadId: tds.payHeadId, payHeadName: tds.payHeadName, headType: 'deduction', amount: '0', calculatedAmount: tds.calculatedAmount, isManualOverride: false });

    await tx
      .update(payrollSlips)
      .set({ grossEarnings: calc.grossEarnings, totalDeductions: calc.totalDeductions, netPayable: calc.netPayable, taxableIncome: calc.taxableIncome, tdsThisMonth: calc.tdsThisMonth, taxSheet: calc.marginal, updatedAt: new Date() })
      .where(eq(payrollSlips.id, slipId));
    await tx.insert(auditLogs).values({ userId, action: 'EDIT', module: 'PAYROLL_GENERATE', recordId: slipId, result: 'SUCCESS', oldValues: { grossEarnings: before.grossEarnings, tdsThisMonth: before.tdsThisMonth }, newValues: { grossEarnings: calc.grossEarnings, tdsThisMonth: calc.tdsThisMonth, override: override?.headId ?? null } });
  });
  await repository.refreshRunTotals(run.id);
}
