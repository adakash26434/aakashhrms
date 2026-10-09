import Decimal from "decimal.js";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attendanceRecords, fundLedger, leaveOtCalculations, leaveSalaryRuns, loanRepayments, loans, payrollSlips } from "@/lib/db/schema";
import * as exitRepo from "@/lib/repositories/exit.repository";
import * as repo from "@/lib/repositories/settlement.repository";
import * as payrollRepo from "@/lib/repositories/payroll.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as fundRepository from "@/lib/repositories/fund.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import { getPayCalendar } from "@/lib/repositories/pay-calendar.repository";
import { recomputeTotals } from "@/lib/repositories/payroll-run.repository";
import { attendanceForPayroll } from "@/lib/services/attendance.service";
import { leaveYearOf, myBalances } from "@/lib/services/leave.service";
import { ruleTypes } from "@/lib/services/leave-rule-types.service";
import { taxInputsFor } from "@/lib/services/payroll.service";
import { assignedHeadsFor, findMasterHeads } from "@/lib/services/arrears.service";
import { calculatePayslip, isSsfDeductionHead, isSsfEmployerHead, projectTds } from "@/lib/engines/payroll.engine";
import { encashmentAmount, gratuityAmount, monthsServed, settlementFigures, settlementShortfall } from "@/lib/engines/settlement.engine";
import { fundBalance } from "@/lib/engines/fund.engine";
import { capOf } from "@/lib/engines/leave.engine";
import { payoutRate } from "@/lib/engines/leave-type.engine";
import { exitKind } from "@/lib/engines/exit.engine";
import { runLabel } from "@/lib/engines/pay-calendar.engine";
import { datesIn, periodContaining, type PeriodCalendar } from "@/lib/engines/pay-period.engine";
import { buildEmployeeScopeCondition, type ScopeFilter } from "@/lib/auth/scope-filter";
import { isOwnRecord } from "@/lib/auth/self-action";
import { UserFacingError } from "@/lib/errors/action-error";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { NewRunInput, PayrollRunsPageData, SettlementDetail, SettlementPreview } from "@/lib/types/payroll-run";
import type { PayrollRun } from "@/lib/types/payroll";

// 4.8b-3 Final settlement: one person's last pay from a closed exit case. The preview and the
// run are worked out the same way on the server (the screen's figures are never trusted); the
// LOCK posts what the slip settled (loans closed, fund paid out, leave paid out, attendance
// sealed) inside the lock transaction.

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];
type Ctx = { scope: ScopeFilter; userId: string };

/** Refused by name when the acting user settles their own exit (S21 / S31). */
export class OwnSettlementError extends UserFacingError {
  constructor() {
    super("Your own final settlement must be prepared by someone else.");
  }
}

const iso = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Closed exit cases in scope, with the run settling them when one exists. */
export async function closedCases(scope: ScopeFilter): Promise<PayrollRunsPageData["exitCases"]> {
  const cases = await exitRepo.listCases({ status: "closed" }, buildEmployeeScopeCondition(scope));
  const runs = await repo.findRunsByExitCases(cases.map((c) => c.id));
  return cases
    .sort((a, b) => b.lastWorkingDayAd.localeCompare(a.lastWorkingDayAd))
    .map((c) => ({
      id: c.id,
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      employeeCode: c.employeeCode,
      lastWorkingDay: iso(c.lastWorkingDayAd),
      kindName: exitKind(c.kind)?.name ?? c.kind,
      runId: runs.get(c.id)?.id ?? null,
    }));
}

/**
 * The settlement for a closed exit case: the last month's pay (pro rata from
 * attendance, unless that month is already locked), the leave encashment at
 * the last basic salary, the gratuity, the welfare fund balances, the loans
 * closed out, the notice recovery, and the income tax reconciled for the year.
 */
export async function preview(exitCaseId: string | null | undefined, noticeRecovery: string | undefined, ctx: Ctx): Promise<SettlementPreview> {
  if (!exitCaseId) throw new UserFacingError("Choose the closed exit case to settle.");
  const c = await exitRepo.findCase(exitCaseId, buildEmployeeScopeCondition(ctx.scope));
  if (!c) throw new UserFacingError("Not found: this exit case is not in your scope.");
  if (c.status !== "closed") throw new UserFacingError("Only a closed exit case is settled: complete the clearance first.");
  if (isOwnRecord(ctx.scope.employeeId, c.employeeId)) throw new OwnSettlementError();
  const lastDay = iso(c.lastWorkingDayAd);
  const [people, calendar, settings, existing, systemControl, heads, slabsAll] = await Promise.all([
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "all" }),
    getPayCalendar() as Promise<PeriodCalendar>,
    repo.getSettlementSettings(),
    repo.findRunByExitCase(exitCaseId),
    systemControlRepository.findSettings(),
    findMasterHeads(),
    taxRateRepository.findAllSlabs(),
  ]);
  const emp = people.find((e) => e.id === c.employeeId);
  if (!emp) throw new UserFacingError("The employee of this exit case no longer exists.");
  const maps = await salaryMappingRepository.findInForceByEmployeeIds([emp.id], lastDay);
  const map = maps.get(emp.id);
  if (!map) throw new UserFacingError(`${emp.fullName} has no salary structure in force on ${lastDay}: nothing to settle.`);
  const period = periodContaining(calendar, lastDay);
  const fy = await fiscalYearRepository.findFiscalYearForDate(lastDay);
  if (!fy) throw new UserFacingError(`No fiscal year covers ${period.label}. Add it in Company setup → Fiscal years.`);
  const slabs = slabsAll
    .filter((x) => x.fiscalYearId === fy.id)
    .map((s) => ({ id: s.id, category: s.category, amountFrom: s.amountFrom.toString(), amountTo: s.amountTo ? s.amountTo.toString() : null, ratePercent: s.ratePercent.toString(), fixedDeduction: s.fixedDeduction.toString() }));
  const assigned = assignedHeadsFor(map, heads);
  const ssfMember = assigned.some((h) => isSsfDeductionHead(h) || isSsfEmployerHead(h) || h.isSsfHead || h.isSsfEmployerHead);
  const basic = String(map.basicSalary);

  // 1. The last month: pro rata from attendance, unless a locked regular run already paid it.
  const locked = await repo.findLockedRegularSlip(emp.id, calendar, period.year, period.month);
  const attendance = locked ? null : (await attendanceForPayroll([emp.id], period)).get(emp.id) ?? null;
  const employee = { id: emp.id, category: emp.category, gender: emp.gender, isDisabled: emp.isDisabled, taxStatus: emp.taxStatus, joiningDate: iso(emp.joiningDate) };
  const month = locked
    ? null
    : calculatePayslip({
        employee,
        salaryMap: { basicSalary: basic, gradePercent: String(map.gradePercent || 0), gradeAmount: String(map.gradeAmount || 0) },
        assignedHeads: assigned,
        attendanceCalc: { leaveDeductionAmount: attendance?.leaveDeductionAmount ?? "0", otEarnedAmount: attendance?.otEarnedAmount ?? "0" },
        loanDeduction: "0", // the loans are closed out below, not instalment by instalment
        fundDeduction: "0",
        systemControl,
        taxSlabs: [],
        isFestivalMonth: false,
        isRemoteMonth: false,
        tax: { ytd: { taxableGross: "0", retirement: "0", cit: "0", tds: "0", months: 0 }, monthsRemaining: 12 },
      });
  const statutoryDeductions = month
    ? month.heads
        .filter((h) => h.headType === "deduction" && !assigned.find((a) => a.id === h.payHeadId)?.isTdsHead && new Decimal(h.calculatedAmount).gt(0))
        .map((h) => ({ label: h.payHeadName, amount: h.calculatedAmount }))
    : [];

  // 2. Leave encashment at the last basic salary (§49: home and sick leave; company types marked encashable).
  const [{ balances }, types] = await Promise.all([myBalances(emp.id), ruleTypes()]);
  const encashment: SettlementDetail["encashment"] = [];
  for (const b of balances) {
    const t = types.find((x) => x.id === b.leaveTypeId);
    if (!t || !(t.statutoryCode === "HOME" || t.statutoryCode === "SICK" || (!t.isStatutory && t.isEncashable))) continue;
    const cap = capOf(t);
    const days = Math.max(0, cap === null ? b.balance : Math.min(b.balance, cap));
    if (days <= 0) continue;
    const record = await leaveRepository.findLeaveTypeById(t.id);
    const rate = record ? payoutRate(record, null) : { rate: "BASIC_DAILY" as const, fixed: null };
    const e = encashmentAmount({ days, basic, rate: rate.rate, fixed: rate.fixed });
    encashment.push({ leaveTypeId: t.id, leaveTypeName: t.name, days, perDay: e.perDay, amount: e.amount });
  }

  // 3. Gratuity, 4. welfare funds, 5. loans.
  const months = monthsServed(employee.joiningDate, lastDay);
  const g = gratuityAmount({ basic, months, ssfMember, settings });
  const fundTypes = (await fundRepository.listFundTypes()).filter((f) => f.isActive);
  const funds: SettlementDetail["funds"] = [];
  for (const f of fundTypes) {
    const bal = fundBalance((await fundRepository.linesFor(f.id, emp.id, 10000)).map((l) => ({ employeeAmount: l.employeeAmount, employerAmount: l.employerAmount })));
    if (new Decimal(bal.total).gt(0)) funds.push({ fundTypeId: f.id, code: f.code, name: f.name, employee: bal.employee, employer: bal.employer });
  }
  const activeLoans = await loanRepository.findActiveLoansByEmployee(emp.id);
  const loanLines = activeLoans.filter((l) => l.remainingAmount > 0).map((l) => ({ loanId: l.id, name: l.loanTypeName, remaining: new Decimal(l.remainingAmount).toDecimalPlaces(2).toString() }));
  const notice = (() => {
    const n = Number(noticeRecovery ?? 0);
    return Number.isFinite(n) && n > 0 ? new Decimal(n).toDecimalPlaces(2).toString() : "0";
  })();

  const figures = settlementFigures({
    month: month ? { label: period.label, grossEarnings: month.grossEarnings, statutoryDeductions, taxableGross: month.taxableIncome } : null,
    encashment: encashment.map((e) => ({ label: `${e.leaveTypeName} encashment (${e.days} days)`, amount: e.amount })),
    gratuity: { amount: g.amount, withholdingPct: settings.gratuityWithholdingPct },
    funds: funds.map((f) => ({ label: f.name, employee: f.employee, employer: f.employer })),
    loans: loanLines.map((l) => ({ label: l.name, remaining: l.remaining })),
    noticeRecovery: notice,
  });

  // 6. Income tax reconciled for the year: everything taxable now, nothing after.
  const tax = await taxInputsFor([emp.id], fy.id, period, calendar);
  const projected = projectTds({
    employee,
    taxSlabs: slabs,
    systemControl,
    monthlyGross: new Decimal(figures.grossEarnings),
    taxableMonthlyGross: new Decimal(figures.taxableGross),
    oneOffTaxable: new Decimal(figures.oneOffTaxable),
    retirementThisMonth: month ? new Decimal(month.pfEmployee).plus(month.pfEmployer).plus(month.ssfEmployee).plus(month.ssfEmployer) : new Decimal(0),
    citThisMonth: month ? new Decimal(month.citDeduction) : new Decimal(0),
    insuranceAnnual: new Decimal(0),
    ssfEnrolled: ssfMember,
    ytd: tax.ytdOf(emp.id),
    monthsRemaining: 1,
  });
  const tds = projected.tdsThisMonth.toDecimalPlaces(2);
  const net = new Decimal(figures.grossEarnings).minus(figures.totalDeductions).minus(tds).toDecimalPlaces(2);
  const blocked = existing ? `Already settled: ${runLabel(existing)} (${existing.status.toLowerCase().replace("_", " ")})` : settlementShortfall(figures, tds.toString());
  return {
    ...figures,
    exitCaseId,
    employeeId: emp.id,
    employeeName: emp.fullName,
    employeeCode: emp.employeeCode,
    lastWorkingDay: lastDay,
    monthsServed: months,
    month: month ? { label: period.label, calendar, year: period.year, month: period.month, unpaidDays: attendance?.unpaidDays ?? 0, closed: attendance?.closed ?? false } : null,
    encashment,
    gratuity: { basic, months, pct: settings.gratuityPctPerMonth, amount: g.amount, reason: g.reason },
    funds,
    loans: loanLines,
    noticeRecovery: notice,
    tds: tds.toString(),
    net: net.toString(),
    blocked,
    // kept for the slip: the month's figures the LOCK and the pane need
    ...(month ? { monthCalc: month } : {}),
  } as SettlementPreview & { monthCalc?: ReturnType<typeof calculatePayslip> };
}

/** Generates the FINAL_SETTLEMENT run (one slip) from the preview worked out again now. */
export async function generateSettlementRun(input: NewRunInput, ctx: Ctx): Promise<PayrollRun> {
  const p = (await preview(input.exitCaseId, input.noticeRecovery, ctx)) as SettlementPreview & { monthCalc?: ReturnType<typeof calculatePayslip> };
  if (p.blocked) throw new UserFacingError(p.blocked);
  const [people, calendar, heads, sys, departments, designations] = await Promise.all([
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "all" }),
    getPayCalendar() as Promise<PeriodCalendar>,
    findMasterHeads(),
    repo.ensureSettlementPayHeads(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
  ]);
  const emp = people.find((e) => e.id === p.employeeId);
  if (!emp) throw new UserFacingError("The employee no longer exists.");
  const period = periodContaining(calendar, p.lastWorkingDay);
  const fy = await fiscalYearRepository.findFiscalYearForDate(p.lastWorkingDay);
  if (!fy) throw new UserFacingError(`No fiscal year covers ${period.label}.`);
  const tdsHead = heads.find((h) => h.isTdsHead);
  const month = p.monthCalc ?? null;
  const slipHeads: { payHeadId: string; payHeadName: string; headType: string; amount: string; calculatedAmount: string }[] = [];
  // The month's heads as the regular engine made them (its TDS head is replaced by the reconciled tax).
  for (const h of month?.heads ?? []) {
    if (h.payHeadId === tdsHead?.id || new Decimal(h.calculatedAmount).eq(0)) continue;
    slipHeads.push({ payHeadId: h.payHeadId, payHeadName: h.payHeadName, headType: h.headType, amount: "0", calculatedAmount: h.calculatedAmount });
  }
  const sum = (code: string, type: "earnings" | "deductions") => p[type].filter((l) => l.code === code).reduce((n, l) => n.plus(l.amount), new Decimal(0));
  const own = (head: (typeof sys)[keyof typeof sys], amount: Decimal) => {
    if (amount.gt(0)) slipHeads.push({ payHeadId: head.id, payHeadName: head.name, headType: head.type, amount: "0", calculatedAmount: amount.toDecimalPlaces(2).toString() });
  };
  own(sys.LEAVE_ENCASH, sum("ENCASHMENT", "earnings"));
  own(sys.GRATUITY, sum("GRATUITY", "earnings"));
  own(sys.FUND_PAYOUT, sum("FUND_PAYOUT", "earnings"));
  own(sys.LOAN_CLOSEOUT, sum("LOAN_CLOSEOUT", "deductions"));
  own(sys.NOTICE_RECOVERY, sum("NOTICE_RECOVERY", "deductions"));
  own(sys.GRATUITY_TDS, sum("GRATUITY_TDS", "deductions"));
  const tds = new Decimal(p.tds);
  if (tds.gt(0)) {
    if (!tdsHead) throw new UserFacingError("No pay head is marked as income tax (TDS). Add one in Setup → Pay heads.");
    slipHeads.push({ payHeadId: tdsHead.id, payHeadName: tdsHead.name, headType: "deduction", amount: "0", calculatedAmount: tds.toString() });
  }
  const { monthCalc: _calc, employeeId: _e, employeeName: _n, employeeCode: _c, tds: _t, net: _net, blocked: _b, ...detail } = p;
  void _calc; void _e; void _n; void _c; void _t; void _net; void _b;
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const desigName = new Map(designations.map((d) => [d.id, d.name]));
  return (await getDb()).transaction(async (tx) => {
    const created = await payrollRepo.createPayrollRun(
      {
        fiscalYearId: fy.id,
        calendar,
        runType: "FINAL_SETTLEMENT",
        exitCaseId: p.exitCaseId,
        payPeriodMonth: period.month,
        payPeriodYear: period.year,
        payPeriodStartDate: period.start,
        payPeriodEndDate: period.end,
        branchIds: [emp.branchId],
        departmentIds: [],
        designationIds: [],
        employeeCategories: [],
        employeeIds: [emp.id],
        occasionalAllowanceHeadIds: [],
        payslipMonth: period.month,
        payslipDate: input.payslipDate,
        status: "DRAFT",
        totalGross: "0",
        totalDeductions: "0",
        totalNetPayable: "0",
        totalTds: "0",
        totalPf: "0",
        totalSsf: "0",
        employeeCount: 1,
        generatedBy: ctx.userId,
      },
      tx
    );
    await payrollRepo.createPayrollSlips(
      [
        {
          slip: {
            payrollRunId: created.id,
            employeeId: emp.id,
            employeeCode: emp.employeeCode,
            employeeName: emp.fullName,
            departmentName: deptName.get(emp.departmentId) ?? "",
            designationName: desigName.get(emp.designationId) ?? "",
            basicSalary: month?.basicSalary ?? "0",
            gradeAmount: month?.gradeAmount ?? "0",
            grossEarnings: p.grossEarnings,
            totalDeductions: new Decimal(p.totalDeductions).plus(tds).toDecimalPlaces(2).toString(),
            netPayable: p.net,
            taxableIncome: p.taxableGross,
            tdsThisMonth: tds.toString(),
            pfEmployee: month?.pfEmployee ?? "0",
            pfEmployer: month?.pfEmployer ?? "0",
            ssfEmployee: month?.ssfEmployee ?? "0",
            ssfEmployer: month?.ssfEmployer ?? "0",
            citDeduction: month?.citDeduction ?? "0",
            loanDeduction: sum("LOAN_CLOSEOUT", "deductions").toDecimalPlaces(2).toString(),
            absentDeduction: month?.absentDeduction ?? "0",
            otAmount: month?.otAmount ?? "0",
            fundDeduction: "0",
            taxDetail: month?.taxDetail ?? null,
            settlementDetail: detail,
            bankAccountNumber: emp.bankAccountNumber || "N/A",
            bankName: emp.bankName || "N/A",
            payslipMonth: period.month,
            payslipDate: input.payslipDate,
            status: "DRAFT",
            isYearEndReconciliation: true,
            warnings: null,
          },
          heads: slipHeads,
        },
      ],
      tx
    );
    await recomputeTotals(created.id, tx);
    return created;
  });
}

/**
 * On LOCK (inside payroll.service's lock transaction): the loans are closed
 * with a repayment each, the welfare funds paid out, the leave paid out in the
 * ledger with a PAID termination leave-salary row, and the last month's
 * attendance sealed for the employee.
 */
export async function applyLock(run: PayrollRun, tx: Tx, userId: string): Promise<void> {
  const slips = await tx.select().from(payrollSlips).where(eq(payrollSlips.payrollRunId, run.id));
  const label = runLabel(run);
  for (const slip of slips) {
    const d = slip.settlementDetail as SettlementDetail | null;
    if (!d) continue;
    for (const l of d.loans) {
      const [loan] = await tx.select().from(loans).where(eq(loans.id, l.loanId));
      if (!loan || loan.status !== "ACTIVE") continue;
      const paid = new Decimal(loan.remainingAmount).toDecimalPlaces(2);
      await tx
        .update(loans)
        .set({ totalReturned: new Decimal(loan.totalReturned).plus(paid).toDecimalPlaces(2).toString(), remainingAmount: "0", status: "CLOSED", updatedAt: new Date() })
        .where(eq(loans.id, loan.id));
      await tx.insert(loanRepayments).values({ loanId: loan.id, employeeId: slip.employeeId, repaymentDate: d.lastWorkingDay, amountPaid: paid.toString(), paymentMethod: "SETTLEMENT", payrollSlipId: slip.id, createdBy: userId });
    }
    for (const f of d.funds) {
      await tx
        .insert(fundLedger)
        .values({ fundTypeId: f.fundTypeId, employeeId: slip.employeeId, kind: "payout", employeeAmount: new Decimal(f.employee).negated().toString(), employerAmount: new Decimal(f.employer).negated().toString(), ref: `payout:settlement:${slip.id}`, note: `Final settlement · ${label}`, postedBy: userId })
        .onConflictDoNothing({ target: [fundLedger.fundTypeId, fundLedger.employeeId, fundLedger.ref] });
    }
    const year = (await leaveYearOf(d.lastWorkingDay)) ?? (await leaveYearOf(nepalDateIso()));
    for (const e of d.encashment) {
      if (e.days <= 0) continue;
      if (year) {
        await leaveRepository.postLedgerLines(
          [{ employeeId: slip.employeeId, leaveTypeId: e.leaveTypeId, fiscalYearId: year.id, entryDate: d.lastWorkingDay, kind: "paid_out", days: -e.days, note: `Final settlement · ${label}`, ref: `settlement:${slip.id}:${e.leaveTypeId}`, createdBy: userId }],
          tx
        );
      }
      await tx.insert(leaveSalaryRuns).values({
        payrollRunId: run.id,
        employeeId: slip.employeeId,
        leaveTypeId: e.leaveTypeId,
        leaveDays: String(e.days),
        perDayRate: e.perDay,
        totalAmount: e.amount,
        tdsAmount: "0",
        encashmentType: "TERMINATION",
        paymentPeriod: label,
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        createdBy: userId,
        approvedBy: userId,
      });
    }
    if (d.month) {
      const period = periodContaining(d.month.calendar, d.lastWorkingDay);
      const dates = datesIn(period);
      await tx
        .update(attendanceRecords)
        .set({ isLocked: true, updatedAt: new Date() })
        .where(and(eq(attendanceRecords.employeeId, slip.employeeId), gte(attendanceRecords.attendanceDate, dates[0]), lte(attendanceRecords.attendanceDate, dates[dates.length - 1])));
      await tx
        .update(leaveOtCalculations)
        .set({ isLocked: true, updatedAt: new Date() })
        .where(and(eq(leaveOtCalculations.employeeId, slip.employeeId), eq(leaveOtCalculations.calendar, d.month.calendar), eq(leaveOtCalculations.periodYear, d.month.year), eq(leaveOtCalculations.periodMonth, d.month.month)));
    }
  }
}
