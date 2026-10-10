import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  payrollRuns,
  payrollSlips,
  payrollSlipHeads,
  leaveOtCalculations,
  employees,
  loans,
  loanRepayments,
  leaveApplications,
  auditLogs,
  employeeBank,
  departments,
  designations,
  payHeads,
  fiscalYears,
  attendanceRecords
} from "@/lib/db/schema";
import { eq, and, inArray, sql, gte, lte, asc } from "drizzle-orm";
import * as repository from "@/lib/repositories/payroll.repository";
import * as feedsRepository from "@/lib/repositories/payroll-feeds.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import * as loanService from "@/lib/services/loan.service";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as roleRepository from "@/lib/repositories/role.repository";
import { auth } from "@/lib/auth";
import { calculatePayslip, isSsfEmployerHead, isSsfDeductionHead } from "@/lib/engines/payroll.engine";
import { BS_MONTHS_EN, getBSMonthRange } from "@/lib/utils/bs-calendar";
import { isAshadh, getFiscalMonthIndex } from "@/lib/utils/fiscal-year.utils";
import Decimal from "decimal.js";
import { attendanceForPayroll } from "@/lib/services/attendance.service";
import { assertCanMove, assertNotOwnSlip } from "@/lib/services/payroll-control.service";
import * as arrearsService from "@/lib/services/arrears.service";
import * as offCycleService from "@/lib/services/off-cycle.service";
import { isOffCycle } from "@/lib/engines/off-cycle.engine";
import { UserFacingError } from "@/lib/errors/action-error";
import { refreshRunBankDetails } from "@/lib/repositories/employee-detail.repository";
import * as openingRepository from "@/lib/repositories/opening-balance.repository";
import * as payrollFeedService from "@/lib/services/payroll-feed.service";
import { FEED_SOURCE, isFeedHeadCode } from "@/lib/constants/payroll-feeds";
import { coveredByOpeningMessage, openingAsYearEndSlip } from "@/lib/engines/opening-balance.engine";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeSlipHeads<T extends { payHeadId: string; payHeadName: string; headType: any; amount: string; calculatedAmount: string }>(
  heads: T[],
  allPayHeads: Array<{ id: string; name: string; type: string; code?: string | null; isSsfEmployerHead?: boolean; isSsfHead?: boolean }>
): T[] {
  return heads.map(h => {
    if (UUID_REGEX.test(h.payHeadId)) {
      return h;
    }
    // Attempt fallback resolution for synthetic IDs
    if (h.payHeadId === 'head-ssf-er') {
      const match = allPayHeads.find(dbH => isSsfEmployerHead(dbH as any));
      if (match) return { ...h, payHeadId: match.id, payHeadName: match.name };
    }
    if (h.payHeadId === 'head-ssf') {
      const match = allPayHeads.find(dbH => isSsfDeductionHead(dbH as any));
      if (match) return { ...h, payHeadId: match.id, payHeadName: match.name };
    }
    return h;
  }).filter(h => UUID_REGEX.test(h.payHeadId));
}
import type { 
  PayrollRun, 
  PayrollSlip, 
  PayrollSlipHead, 
  PayrollRunStatus,
  PayrollRunSetupPayload,
  PayrollSlipOverridePayload,
  AddSlipHeadPayload
} from "@/lib/types/payroll";

// -----------------------------------------------------------------------------
// Custom Errors
// -----------------------------------------------------------------------------

export class LeaveOtCalculationNotLockedError extends Error {
  constructor(public bsMonth: number, public year: number) {
    super(`Leave/OT calculation for month ${bsMonth}, year ${year} has not been locked. Complete it before generating payroll.`);
    this.name = "LeaveOtCalculationNotLockedError";
  }
}

export class SalaryMappingMissingError extends Error {
  constructor(public employeeNames: string[]) {
    super(`No salary structure for employees: ${employeeNames.join(", ")}`);
    this.name = "SalaryMappingMissingError";
  }
}

export class PendingLeaveApplicationsError extends Error {
  constructor(public count: number) {
    super(`Cannot generate payroll: There are ${count} unapproved leave applications for employees in scope for this period.`);
    this.name = "PendingLeaveApplicationsError";
  }
}

export class PayrollRunAlreadyExistsError extends Error {
  constructor(public bsMonth: number, public year: number) {
    super(`A payroll run already exists for BS period ${year}-${String(bsMonth).padStart(2, '0')} and the selected branches.`);
    this.name = "PayrollRunAlreadyExistsError";
  }
}

export class SeparationOfDutiesError extends Error {
  constructor() {
    super("Separation of duties violation: The user who triggers or generates the payroll run cannot be the same user who performs the final approval/lock.");
    this.name = "SeparationOfDutiesError";
  }
}

export class PayrollLockedError extends Error {
  constructor() {
    super("The payroll run is locked. No edits or status reversions are allowed.");
    this.name = "PayrollLockedError";
  }
}

// -----------------------------------------------------------------------------
// Read Methods
// -----------------------------------------------------------------------------

export async function getPayrollHistory(): Promise<PayrollRun[]> {
  return repository.findAllPayrollRuns();
}

export async function getPayrollRunDetails(runId: string): Promise<{
  payrollRun: PayrollRun;
  slips: PayrollSlip[];
}> {
  const run = await repository.findPayrollRunById(runId);
  if (!run) throw new Error("Payroll run not found");
  const slips = await repository.findSlipsByRunId(runId);
  return { payrollRun: run, slips };
}

export async function getPayslipWithHeads(slipId: string): Promise<{
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
}> {
  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new Error("Payslip not found");
  const heads = await repository.findSlipHeadsBySlipId(slipId);
  return { slip, heads };
}

// -----------------------------------------------------------------------------
// Generation (Stage 1)
// -----------------------------------------------------------------------------

export async function generatePayrollRun(
  payload: PayrollRunSetupPayload,
  userId: string
): Promise<PayrollRun> {
  // F6: festival allowance and arrears runs pay one thing on their own (off-cycle.service).
  if (isOffCycle(payload.runType)) return offCycleService.generateOffCycleRun(payload, userId);

  const { 
    payPeriodMonth, 
    payPeriodYear, 
    branchIds, 
    departmentIds, 
    designationIds, 
    employeeCategories, 
    employeeIds, 
    occasionalAllowanceHeadIds,
    payslipMonth,
    payslipDate
  } = payload;

  // Resolve BS Month start/end dates in AD
  const { start: startDateAD, end: endDateAD } = getBSMonthRange(payPeriodYear, payPeriodMonth);
  const startStr = startDateAD.toISOString().split('T')[0];
  const endStr = endDateAD.toISOString().split('T')[0];

  // 1. Verify duplicates
  const existingRuns = await repository.findPayrollRunByPeriodAndBranch({
    payPeriodMonth,
    payPeriodYear,
    branchIds,
    runType: 'REGULAR'
  });
  if (existingRuns.length > 0) {
    const hasLocked = existingRuns.some(r => r.status === 'LOCKED');
    if (hasLocked) {
      throw new PayrollLockedError();
    }

    if (payload.recreateIfExists) {
      for (const run of existingRuns) {
        // Its TA-DA claims are given back first, so the new run pays them (4.8 fix).
        await payrollFeedService.discardDraftRun(run.id);
        await (await getDb()).insert(auditLogs).values({
          userId,
          action: 'DELETE',
          module: 'PAYROLL_GENERATE',
          recordId: run.id,
          result: 'SUCCESS',
          oldValues: { runId: run.id, status: run.status, reason: 'Overwritten on regeneration' },
          newValues: null
        });
      }
    } else {
      throw new PayrollRunAlreadyExistsError(payPeriodMonth, payPeriodYear);
    }
  }

  // 2. Load system configurations & active FY
  const systemControl = await systemControlRepository.findSettings();
  
  // Find active fiscal year
  const activeFys = await (await getDb()).select().from(fiscalYears).where(eq(fiscalYears.status, 'Active'));
  if (!activeFys.length) throw new Error("No active fiscal year found in system");
  const activeFy = activeFys[0] as { id: string; label: string };

  // 3. Active employees in the run's scope (branches, departments, designations, categories, people)
  const scopedEmployees = await employeeRepository.findForPayrollScope({ branchIds, departmentIds, designationIds, employeeCategories, employeeIds });

  if (scopedEmployees.length === 0) {
    throw new Error("No active employees found in the selected scope.");
  }

  // 4. Validate that every employee in scope has a salary mapping
  // BATCH PREFETCH: Load all salary mappings in a single query instead of N+1 per-employee
  const missingSalaryMappings: string[] = [];
  // The salary revision in force for this month (4.4), not just the latest one.
  const salaryMapByEmployeeId = await salaryMappingRepository.findInForceByEmployeeIds(
    scopedEmployees.map(e => e.id),
    endStr
  );

  for (const emp of scopedEmployees) {
    if (!salaryMapByEmployeeId.has(emp.id)) {
      missingSalaryMappings.push(`${emp.fullName} (${emp.employeeCode})`);
    }
  }

  if (missingSalaryMappings.length > 0) {
    throw new SalaryMappingMissingError(missingSalaryMappings);
  }

  // 4b. F15: a month an opening balance covers was paid by the old system; paying it here too
  // would count it twice (tax, certificate).
  const coveredByOpening = await openingRepository.openingsCovering(scopedEmployees.map((e) => e.id), activeFy.id, getFiscalMonthIndex(payPeriodMonth));
  if (coveredByOpening.length) throw new UserFacingError(coveredByOpeningMessage(coveredByOpening, BS_MONTHS_EN[payPeriodMonth] ?? `month ${payPeriodMonth}`));

  // 5. Attendance for the month (4.5): the closed summary, or worked out now from the same
  // day rules without writing anything (the month stays as it is).
  const empIds = scopedEmployees.map(e => e.id);
  const leaveOtByEmployeeId = await attendanceForPayroll(empIds, { bsYear: payPeriodYear, bsMonth: payPeriodMonth, start: startStr, end: endStr });

  // 5b. Feeds from other modules (4.8): approved TA-DA claims whose trip ended in or before the
  // period are paid through this run (one TADA allowance line, not taxable — a reimbursement),
  // and the month's welfare-fund employee contributions are deducted (WELFARE_FUND). Both ride
  // as fixed one-off heads; the engine's statutory maths is untouched.
  const [feedHeadRows, claimsByEmployee, fundByEmployee, arrearsByEmployee] = await Promise.all([
    feedsRepository.feedHeads(),
    feedsRepository.approvedClaimsByEmployee(empIds, endStr),
    feedsRepository.fundContributionsByEmployee(empIds, payPeriodYear, payPeriodMonth),
    // F7: back pay for finalised months whose revision in force now pays more (ARREARS head, taxable).
    arrearsService.arrearsFor(empIds, startStr),
  ]);

  // 6. Verify that there are no pending (unapproved) leave applications in the period
  const pendingLeaves = await (await getDb()).select({ count: sql`count(*)` }).from(leaveApplications).where(
    and(
      inArray(leaveApplications.employeeId, empIds),
      eq(leaveApplications.status, 'Pending'),
      sql`leave_applications.effective_from <= ${endStr}::date`,
      sql`leave_applications.effective_to >= ${startStr}::date`
    )
  );

  const pendingCount = Number(pendingLeaves[0]?.count || 0);
  if (pendingCount > 0) {
    throw new PendingLeaveApplicationsError(pendingCount);
  }

  // Load the run's fiscal year's tax slabs (4.8 fix: every year's slabs stacked up before).
  const slabs = await taxRateRepository.findSlabsByFiscalYear(activeFy.id);
  const taxSlabInputs = slabs.map(s => ({
    id: s.id,
    category: s.category,
    amountFrom: s.amountFrom.toString(),
    amountTo: s.amountTo ? s.amountTo.toString() : null,
    ratePercent: s.ratePercent.toString(),
    fixedDeduction: s.fixedDeduction.toString()
  }));

  // Fetch detailed pay heads configurations to evaluate isFestivalAllowance / isRemoteAllowance
  const allPayHeads = await (await getDb()).select().from(payHeads);
  const payHeadMap = new Map(allPayHeads.map((h) => [h.id, h]));

  const isFestivalChecked = occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find((dbH) => dbH.id === id);
    return h?.isFestivalAllowance;
  }) ?? false;

  const isRemoteChecked = occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find((dbH) => dbH.id === id);
    return h?.isRemoteAllowance;
  }) ?? false;

  // BATCH PREFETCH: Load all active loans for scoped employees at once (disbursed on or before period end)
  const allActiveLoans = new Map<string, { installmentAmount: number; remainingAmount: number }[]>();
  const activeLoansRaw = await (await getDb())
    .select()
    .from(loans)
    .where(
      and(
        inArray(loans.employeeId, empIds),
        eq(loans.status, "ACTIVE"),
        lte(loans.givenDate, endStr)
      )
    )
    .orderBy(asc(loans.createdAt));

  for (const l of activeLoansRaw) {
    if (Number(l.remainingAmount) > 0) {
      if (!allActiveLoans.has(l.employeeId)) {
        allActiveLoans.set(l.employeeId, []);
      }
      allActiveLoans.get(l.employeeId)!.push({
        installmentAmount: Number(l.installmentAmount),
        remainingAmount: Number(l.remainingAmount)
      });
    }
  }

  // BATCH PREFETCH: Load all bank details for scoped employees
  const allBankDetails = await (await getDb()).select().from(employeeBank).where(
    and(
      inArray(employeeBank.employeeId, empIds),
      eq(employeeBank.isPrimary, true)
    )
  );
  const bankByEmployeeId = new Map<string, typeof allBankDetails[0]>();
  for (const bank of allBankDetails) {
    bankByEmployeeId.set(bank.employeeId, bank);
  }

  // BATCH PREFETCH: Load department and designation names upfront
  const deptList = await (await getDb()).select().from(departments);
  const desigList = await (await getDb()).select().from(designations);
  const deptMap = new Map(deptList.map(d => [d.id, d.name]));
  const desigMap = new Map(desigList.map(d => [d.id, d.name]));

  // Helper arrays for bulk insert
  const slipsWithHeads: Array<{
    slip: typeof payrollSlips.$inferInsert;
    heads: Array<{
      payHeadId: string;
      payHeadName: string;
      headType: 'allowance' | 'deduction';
      amount: string;
      calculatedAmount: string;
    }>;
  }> = [];
  let totalGrossSum = new Decimal(0);
  let totalDeductionsSum = new Decimal(0);
  let totalNetSum = new Decimal(0);
  let totalTdsSum = new Decimal(0);
  let totalPfSum = new Decimal(0);
  let totalSsfSum = new Decimal(0);

  // Determine if year-end (Ashadh/Asar = month 3 in BS 1-indexed convention)
  const isYearEndMonth = isAshadh(payPeriodMonth);

  // BATCH PREFETCH: If year-end, load all historical slips for the FY at once
  let historicalSlipsByEmployee = new Map<string, Array<{
    grossEarnings: string;
    pfEmployee: string;
    citDeduction: string;
    tdsThisMonth: string;
  }>>();
  if (isYearEndMonth) {
    const allPastSlips = await (await getDb()).select()
      .from(payrollSlips)
      .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
      .where(
        and(
          inArray(payrollSlips.employeeId, empIds),
          eq(payrollRuns.fiscalYearId, activeFy.id),
          eq(payrollRuns.status, 'LOCKED')
        )
      );

    for (const s of allPastSlips) {
      const empId = s.payroll_slips.employeeId;
      if (!historicalSlipsByEmployee.has(empId)) {
        historicalSlipsByEmployee.set(empId, []);
      }
      historicalSlipsByEmployee.get(empId)!.push({
        grossEarnings: s.payroll_slips.grossEarnings,
        pfEmployee: s.payroll_slips.pfEmployee,
        citDeduction: s.payroll_slips.citDeduction,
        tdsThisMonth: s.payroll_slips.tdsThisMonth
      });
    }
    // F15: what an old system paid before payroll started here is one more past payslip.
    for (const [empId, opening] of await openingRepository.openingsFor(empIds, activeFy.id)) {
      historicalSlipsByEmployee.set(empId, [...(historicalSlipsByEmployee.get(empId) ?? []), openingAsYearEndSlip(opening)]);
    }
  }

  // F5: the earlier months of the year for the tax projection (months 1–11; the year-end month reconciles).
  const fiscalMonthIndex = getFiscalMonthIndex(payPeriodMonth);
  const earlierTaxMonths = isYearEndMonth ? new Map<string, { taxableIncome: string; tds: string }[]>() : await repository.findEarlierTaxMonths(empIds, activeFy.id, fiscalMonthIndex);

  // 7. Calculate payslips for each employee (all data pre-loaded — no per-employee queries)
  for (const emp of scopedEmployees) {
    const salaryMap = salaryMapByEmployeeId.get(emp.id);
    if (!salaryMap) continue;

    // Use batch-loaded leave/OT calculations
    const leaveOtCalc = leaveOtByEmployeeId.get(emp.id);
    const attendCalc = {
      leaveDeductionAmount: leaveOtCalc?.leaveDeductionAmount || "0",
      otEarnedAmount: leaveOtCalc?.otEarnedAmount || "0"
    };
    const slipWarnings = leaveOtCalc?.otWarnings || null;

    // Loan deduction resolution: active loans from ledger first, or fallback to mapped loan deductions
    let activeLoanDeduction = "0";
    const empLoans = allActiveLoans.get(emp.id);
    if (empLoans && empLoans.length > 0) {
      let totalInstallment = new Decimal(0);
      for (const loan of empLoans) {
        // Cap each loan's installment at its remaining amount
        const installment = Decimal.min(
          new Decimal(loan.installmentAmount),
          new Decimal(loan.remainingAmount)
        );
        totalInstallment = totalInstallment.plus(installment);
      }
      activeLoanDeduction = totalInstallment.toDecimalPlaces(2).toString();
    } else {
      // Fallback to loan deductions configured in employee salary mapping
      const mappedLoan = new Decimal(salaryMap.loan1Deduction || 0).plus(new Decimal(salaryMap.loan2Deduction || 0));
      if (mappedLoan.gt(0)) {
        activeLoanDeduction = mappedLoan.toDecimalPlaces(2).toString();
      }
    }

    // Load salary heads assignments directly from DB pay heads master lookup. Feed lines (TA-DA,
    // arrears, welfare fund) come only from their records, never from a salary structure.
    const assignedHeads = salaryMap.salaryHeads.filter((h: { payHeadId: string }) => !isFeedHeadCode(payHeadMap.get(h.payHeadId)?.code)).map((h: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }) => {
      const dbHead = payHeadMap.get(h.payHeadId);
      return {
        id: h.payHeadId,
        payHeadId: h.payHeadId,
        code: dbHead?.code || h.payHeadId,
        name: dbHead?.name || h.payHeadName,
        type: (dbHead?.type || h.payHeadType) as "allowance" | "deduction",
        effectOnTax: dbHead?.effectOnTax ?? true,
        isFestivalAllowance: dbHead?.isFestivalAllowance ?? false,
        isAbsentDeduct: dbHead?.isAbsentDeduct ?? false,
        isOtHead: dbHead?.isOtHead ?? false,
        isLeaveHead: dbHead?.isLeaveHead ?? false,
        isTdsHead: dbHead?.isTdsHead ?? false,
        isPfHead: dbHead?.isPfHead ?? false,
        isSsfHead: Boolean(dbHead?.isSsfHead || (dbHead && isSsfDeductionHead(dbHead as any))),
        isSsfEmployerHead: Boolean((dbHead as any)?.isSsfEmployerHead || (dbHead && isSsfEmployerHead(dbHead as any))),
        isRemoteAllowance: dbHead?.isRemoteAllowance ?? false,
        isCitHead: dbHead?.isCitHead ?? false,
        calcBasis: dbHead?.calcBasis ?? "None",
        calcParameter: dbHead?.calcParameter ?? "FixedAmount",
        calcPercent: dbHead?.calcPercent?.toString() || "0",
        amount: h.amount.toString(),
        isManualOverride: false,
      };
    });

    const toPayHeadObj = (masterHead: typeof payHeads.$inferSelect) => ({
      id: masterHead.id,
      payHeadId: masterHead.id,
      code: masterHead.code || masterHead.id,
      name: masterHead.name,
      type: masterHead.type as "allowance" | "deduction",
      effectOnTax: masterHead.effectOnTax,
      isFestivalAllowance: masterHead.isFestivalAllowance,
      isAbsentDeduct: masterHead.isAbsentDeduct,
      isOtHead: masterHead.isOtHead,
      isLeaveHead: masterHead.isLeaveHead,
      isTdsHead: masterHead.isTdsHead,
      isPfHead: masterHead.isPfHead,
      isSsfHead: Boolean(masterHead.isSsfHead || isSsfDeductionHead(masterHead as any)),
      isSsfEmployerHead: Boolean((masterHead as any).isSsfEmployerHead || isSsfEmployerHead(masterHead as any)),
      isRemoteAllowance: masterHead.isRemoteAllowance,
      isCitHead: masterHead.isCitHead,
      calcBasis: masterHead.calcBasis,
      calcParameter: masterHead.calcParameter,
      calcPercent: masterHead.calcPercent?.toString() || "0",
      amount: "0",
      isManualOverride: false,
    });

    // 0. One-off feeds for this employee (4.8): TA-DA reimbursement and the welfare-fund deduction.
    const claimFeed = claimsByEmployee.get(emp.id);
    if (claimFeed && feedHeadRows.tada && Number(claimFeed.payable) !== 0) {
      assignedHeads.push({ ...toPayHeadObj(feedHeadRows.tada), amount: claimFeed.payable, isManualOverride: true });
    }
    const arrearsFeed = arrearsByEmployee.get(emp.id);
    if (arrearsFeed && arrearsFeed.payable > 0 && feedHeadRows.arrears) {
      assignedHeads.push({ ...toPayHeadObj(feedHeadRows.arrears), amount: arrearsFeed.payable.toFixed(2), isManualOverride: true });
    }
    const fundFeed = fundByEmployee.get(emp.id);
    if (fundFeed && feedHeadRows.welfare) {
      assignedHeads.push({ ...toPayHeadObj(feedHeadRows.welfare), amount: fundFeed, isManualOverride: true });
    }

    // 1. TDS is required for every employee
    if (!assignedHeads.some((h) => h.isTdsHead)) {
      const tdsMaster = allPayHeads.find((h) => h.isTdsHead);
      if (tdsMaster) assignedHeads.push(toPayHeadObj(tdsMaster));
    }

    // 2. SSF: Only ensure SSF master heads if this employee actually has SSF assigned in salary mapping
    const hasSsfAssigned = assignedHeads.some((h) => h.isSsfHead || h.isSsfEmployerHead || isSsfEmployerHead(h) || isSsfDeductionHead(h) || h.name.toLowerCase().includes('ssf'));
    if (hasSsfAssigned) {
      if (!assignedHeads.some((h) => isSsfEmployerHead(h))) {
        const ssfErMaster = allPayHeads.find((h) => isSsfEmployerHead(h as any));
        if (ssfErMaster) assignedHeads.push(toPayHeadObj(ssfErMaster));
      }
      if (!assignedHeads.some((h) => isSsfDeductionHead(h))) {
        const ssfDedMaster = allPayHeads.find((h) => isSsfDeductionHead(h as any));
        if (ssfDedMaster) assignedHeads.push(toPayHeadObj(ssfDedMaster));
      }
    }

    // Use batch-loaded historical slips for year-end reconciliation
    const historicalSlips = isYearEndMonth
      ? (historicalSlipsByEmployee.get(emp.id) || [])
      : [];

    const calcResult = calculatePayslip({
      employee: {
        id: emp.id,
        category: emp.category,
        gender: emp.gender,
        isDisabled: emp.isDisabled,
        taxStatus: emp.taxStatus,
        joiningDate: typeof emp.joiningDate === 'string' ? emp.joiningDate : (emp.joiningDate as any).toISOString().split('T')[0]
      },
      salaryMap: {
        basicSalary: salaryMap.basicSalary.toString(),
        gradePercent: salaryMap.gradePercent.toString(),
        gradeAmount: (salaryMap.gradeAmount || 0).toString(),
      },
      assignedHeads,
      attendanceCalc: attendCalc,
      loanDeduction: activeLoanDeduction,
      systemControl,
      taxSlabs: taxSlabInputs,
      isFestivalMonth: isFestivalChecked,
      isRemoteMonth: isRemoteChecked,
      isYearEnd: isYearEndMonth,
      historicalPayslips: historicalSlips,
      fiscalMonthIndex,
      projectionHistory: earlierTaxMonths.get(emp.id) ?? [],
    });

    // Accumulate batch run totals
    totalGrossSum = totalGrossSum.plus(calcResult.grossEarnings);
    totalDeductionsSum = totalDeductionsSum.plus(calcResult.totalDeductions);
    totalNetSum = totalNetSum.plus(calcResult.netPayable);
    totalTdsSum = totalTdsSum.plus(calcResult.tdsThisMonth);
    totalPfSum = totalPfSum.plus(calcResult.pfEmployee);
    totalSsfSum = totalSsfSum.plus(calcResult.ssfEmployee);

    // Use batch-loaded bank details
    const empBank = bankByEmployeeId.get(emp.id);
    const bankAccountNumber = empBank ? empBank.accountNumber : "N/A";
    const bankName = empBank ? empBank.bankName : "N/A";
    const departmentName = deptMap.get(emp.departmentId) || "Unknown Department";
    const designationName = desigMap.get(emp.designationId) || "Unknown Designation";

    slipsWithHeads.push({
      slip: {
        payrollRunId: "", // Will populate inside repository transaction
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        departmentName,
        designationName,
        basicSalary: salaryMap.basicSalary.toString(),
        gradeAmount: (salaryMap.gradeAmount || 0).toString(),
        grossEarnings: calcResult.grossEarnings,
        totalDeductions: calcResult.totalDeductions,
        netPayable: calcResult.netPayable,
        taxableIncome: calcResult.taxableIncome,
        taxSheet: calcResult.taxSheet ?? null,
        tdsThisMonth: calcResult.tdsThisMonth,
        pfEmployee: calcResult.pfEmployee,
        pfEmployer: calcResult.pfEmployer,
        ssfEmployee: calcResult.ssfEmployee,
        ssfEmployer: calcResult.ssfEmployer,
        citDeduction: calcResult.citDeduction,
        loanDeduction: calcResult.loanDeduction,
        absentDeduction: calcResult.absentDeduction,
        otAmount: calcResult.otAmount,
        bankAccountNumber,
        bankName,
        payslipMonth,
        payslipDate,
        status: 'DRAFT',
        isYearEndReconciliation: isYearEndMonth,
        warnings: slipWarnings,
      },
      heads: sanitizeSlipHeads(calcResult.heads, allPayHeads)
    });
  }

  // Department/designation names already resolved via batch-loaded maps above

  // Create the top-level batch record, slips and audit logs in a single atomic transaction
  const runRecord = await (await getDb()).transaction(async (tx) => {
    const run = await repository.createPayrollRun({
      fiscalYearId: activeFy.id,
      payPeriodMonth,
      payPeriodYear,
      payPeriodStartDate: startStr,
      payPeriodEndDate: endStr,
      branchIds,
      departmentIds: departmentIds || [],
      designationIds: designationIds || [],
      employeeCategories: employeeCategories || [],
      employeeIds: employeeIds || [],
      occasionalAllowanceHeadIds: occasionalAllowanceHeadIds || [],
      payslipMonth,
      payslipDate,
      status: 'DRAFT',
      totalGross: totalGrossSum.toDecimalPlaces(2).toString(),
      totalDeductions: totalDeductionsSum.toDecimalPlaces(2).toString(),
      totalNetPayable: totalNetSum.toDecimalPlaces(2).toString(),
      totalTds: totalTdsSum.toDecimalPlaces(2).toString(),
      totalPf: totalPfSum.toDecimalPlaces(2).toString(),
      totalSsf: totalSsfSum.toDecimalPlaces(2).toString(),
      employeeCount: scopedEmployees.length,
      generatedBy: userId,
    }, tx);

    // Assign the generated runId to each slip
    for (const item of slipsWithHeads) {
      item.slip.payrollRunId = run.id;
    }

    // Bulk save slips and slip heads in the transaction
    await repository.createPayrollSlips(slipsWithHeads, tx);

    // What the payslips pay from other modules is settled with them (claim-first): a claim that
    // changed meanwhile stops the run instead of being paid without being settled (4.8 fix).
    await payrollFeedService.settleRunFeedsTx(
      tx,
      run.id,
      [...claimsByEmployee.values()].flatMap((c) => c.ids),
      new Map([...arrearsByEmployee].filter(([, a]) => a.payable > 0))
    );

    // Log to audit trail in the transaction
    await tx.insert(auditLogs).values({
      userId,
      action: 'ADD',
      module: 'PAYROLL_GENERATE',
      recordId: run.id,
      result: 'SUCCESS',
      newValues: run,
    });

    return run;
  });

  logger.info('Payroll run generated', {
    runId: runRecord.id,
    payPeriodMonth,
    payPeriodYear,
    userId,
  });

  return runRecord;
}

// -----------------------------------------------------------------------------
// Interactive Slip Override (Stage 2)
// -----------------------------------------------------------------------------

/** A feed line (TA-DA, arrears, welfare fund) is what its records say: never typed on a payslip. */
async function assertNotFeedHead(payHeadId: string): Promise<void> {
  const [head] = await (await getDb()).select({ name: payHeads.name, code: payHeads.code }).from(payHeads).where(eq(payHeads.id, payHeadId)).limit(1);
  if (head && isFeedHeadCode(head.code)) throw new UserFacingError(`${head.name} comes from ${FEED_SOURCE[head.code!]}: change it there, then recalculate the payslip.`);
}

export async function overridePayslipAllowanceDeduction(
  payload: PayrollSlipOverridePayload,
  userId: string
): Promise<void> {
  // S21: nobody edits their own payslip.
  await assertNotOwnSlip(payload.slipId, userId, 'EDIT');
  // F13 (S43): a payslip's bank details come from the employee record, where a change needs a second
  // person's approval and reaches draft payslips by itself; they are never typed onto a payslip.
  if (payload && typeof payload === 'object' && ('bankName' in payload || 'bankAccountNumber' in payload)) {
    throw new UserFacingError('Bank details come from the employee record. Change them there (a second person approves); draft payslips take the new account when it is approved.');
  }
  const { 
    slipId, 
    headId, 
    amount, 
    reason,
    basicSalary,
    gradeAmount,
    otAmount,
    absentDeduction,
    loanDeduction,
  } = payload;

  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== 'DRAFT') throw new PayrollLockedError();
  // Feed lines (TA-DA, arrears, welfare fund) are what their records say; they change at the source.
  if (headId) await assertNotFeedHead(headId);

  // F6: an off-cycle payslip has only its own allowance lines; its TDS is re-worked on its own.
  if (isOffCycle(run.runType)) {
    if ([basicSalary, gradeAmount, otAmount, absentDeduction, loanDeduction].some((v) => v !== undefined)) {
      throw new UserFacingError('An off-cycle payslip has no basic, attendance or loan lines to change.');
    }
    await offCycleService.recalculateOffCycleSlip(slipId, userId, headId ? { headId, amount, reason } : undefined);
    return;
  }

  // Keep a snapshot of old values for forensic auditing
  const oldSlipSnapshot = { ...slip };

  // 1. Execute override & recalculation within an atomic transaction
  await (await getDb()).transaction(async (tx) => {
    // Update basic fields on the slip directly if provided
    const updatedSlipFields: Record<string, any> = {};
    if (basicSalary !== undefined) updatedSlipFields.basicSalary = basicSalary;
    if (gradeAmount !== undefined) updatedSlipFields.gradeAmount = gradeAmount;
    if (otAmount !== undefined) updatedSlipFields.otAmount = otAmount;
    if (absentDeduction !== undefined) updatedSlipFields.absentDeduction = absentDeduction;
    if (loanDeduction !== undefined) updatedSlipFields.loanDeduction = loanDeduction;

    if (Object.keys(updatedSlipFields).length > 0) {
      await tx.update(payrollSlips)
        .set({
          ...updatedSlipFields,
          updatedAt: new Date()
        })
        .where(eq(payrollSlips.id, slipId));
    }

    // Process pay head override if provided
    if (headId) {
      const slipHeads = await repository.findSlipHeadsBySlipId(slipId);
      const targetHead = slipHeads.find(h => h.payHeadId === headId);
      if (!targetHead) throw new Error("Assigned pay head not found on this payslip");

      await tx.update(payrollSlipHeads)
        .set({
          amount: amount || "0",
          isManualOverride: true,
          overrideReason: reason || "Manual Override"
        })
        .where(and(
          eq(payrollSlipHeads.payrollSlipId, slipId),
          eq(payrollSlipHeads.payHeadId, headId)
        ));
    }

    // Re-run calculatePayslip to ensure mathematical compliance of dynamic items (TDS, SSF, PF, CIT)
    const currentSlip = await repository.findSlipById(slipId);
    if (!currentSlip) throw new Error("Payslip reload failed");

    const emp = await tx.select().from(employees).where(eq(employees.id, currentSlip.employeeId)).then(r => r[0]);
    if (!emp) throw new Error("Employee not found");

    const currentSlipHeads = await repository.findSlipHeadsBySlipId(slipId);
    const allPayHeads = await tx.select().from(payHeads);
    const systemControl = await systemControlRepository.findSettings();
    const slabs = await taxRateRepository.findSlabsByFiscalYear(run.fiscalYearId);
    const taxSlabInputs = slabs.map(s => ({
      id: s.id,
      category: s.category,
      amountFrom: s.amountFrom.toString(),
      amountTo: s.amountTo ? s.amountTo.toString() : null,
      ratePercent: s.ratePercent.toString(),
      fixedDeduction: s.fixedDeduction.toString()
    }));

    // Map slip heads to assigned heads input format
    const calculatorHeadsInput = currentSlipHeads.map(sh => {
      const dbHead = allPayHeads.find((h) => h.id === sh.payHeadId);
      const baseAmt = sh.amount;
      return {
        id: sh.payHeadId,
        payHeadId: sh.payHeadId,
        code: dbHead?.code || sh.payHeadId,
        name: dbHead?.name || sh.payHeadName,
        type: (dbHead?.type || sh.headType) as "allowance" | "deduction",
        effectOnTax: dbHead?.effectOnTax ?? true,
        isFestivalAllowance: dbHead?.isFestivalAllowance ?? false,
        isAbsentDeduct: dbHead?.isAbsentDeduct ?? false,
        isOtHead: dbHead?.isOtHead ?? false,
        isLeaveHead: dbHead?.isLeaveHead ?? false,
        isTdsHead: dbHead?.isTdsHead ?? false,
        isPfHead: dbHead?.isPfHead ?? false,
        isSsfHead: Boolean(dbHead?.isSsfHead || (dbHead && isSsfDeductionHead(dbHead as any))),
        isSsfEmployerHead: Boolean((dbHead as any)?.isSsfEmployerHead || (dbHead && isSsfEmployerHead(dbHead as any))),
        isRemoteAllowance: dbHead?.isRemoteAllowance ?? false,
        isCitHead: dbHead?.isCitHead ?? false,
        calcBasis: dbHead?.calcBasis ?? "None",
        calcParameter: dbHead?.calcParameter ?? "FixedAmount",
        calcPercent: dbHead?.calcPercent?.toString() ?? "0",
        amount: baseAmt,
        isManualOverride: sh.isManualOverride,
      };
    });

    const isYearEnd = isAshadh(run.payPeriodMonth);
    let historicalSlips: Array<{ grossEarnings: string; pfEmployee: string; citDeduction: string; tdsThisMonth: string }> = [];
    if (isYearEnd) {
      const pastSlips = await tx.select()
        .from(payrollSlips)
        .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
        .where(
          and(
            eq(payrollSlips.employeeId, emp.id),
            eq(payrollRuns.fiscalYearId, run.fiscalYearId),
            eq(payrollRuns.status, 'LOCKED'),
            sql`payroll_slips.id != ${slipId}`
          )
        );

      historicalSlips = pastSlips.map(s => ({
        grossEarnings: s.payroll_slips.grossEarnings,
        pfEmployee: s.payroll_slips.pfEmployee,
        citDeduction: s.payroll_slips.citDeduction,
        tdsThisMonth: s.payroll_slips.tdsThisMonth
      }));
      // F15: an opening balance is one more past payslip.
      const opening = (await openingRepository.openingsFor([emp.id], run.fiscalYearId)).get(emp.id);
      if (opening) historicalSlips.push(openingAsYearEndSlip(opening));
    }

    const isFestivalChecked = run.occasionalAllowanceHeadIds?.some(id => {
      const h = allPayHeads.find((dbH: typeof allPayHeads[number]) => dbH.id === id);
      return h?.isFestivalAllowance;
    }) ?? false;

    const isRemoteChecked = run.occasionalAllowanceHeadIds?.some(id => {
      const h = allPayHeads.find((dbH: typeof allPayHeads[number]) => dbH.id === id);
      return h?.isRemoteAllowance;
    }) ?? false;

    const calcResult = calculatePayslip({
      employee: {
        id: emp.id,
        category: emp.category,
        gender: emp.gender,
        isDisabled: emp.isDisabled,
        taxStatus: emp.taxStatus,
        joiningDate: emp.joiningDate
      },
      salaryMap: {
        basicSalary: currentSlip.basicSalary,
        gradePercent: "0",
        gradeAmount: currentSlip.gradeAmount
      },
      assignedHeads: calculatorHeadsInput,
      attendanceCalc: {
        leaveDeductionAmount: currentSlip.absentDeduction,
        otEarnedAmount: currentSlip.otAmount
      },
      loanDeduction: loanDeduction !== undefined ? loanDeduction : currentSlip.loanDeduction,
      systemControl,
      taxSlabs: taxSlabInputs,
      isFestivalMonth: isFestivalChecked,
      isRemoteMonth: isRemoteChecked,
      isYearEnd,
      historicalPayslips: historicalSlips,
      fiscalMonthIndex: getFiscalMonthIndex(run.payPeriodMonth),
      projectionHistory: isYearEnd ? [] : ((await repository.findEarlierTaxMonths([emp.id], run.fiscalYearId, getFiscalMonthIndex(run.payPeriodMonth), run.id)).get(emp.id) ?? []),
    });

    // Save new values to the slip in the DB
    await tx.update(payrollSlips)
      .set({
        grossEarnings: calcResult.grossEarnings,
        totalDeductions: calcResult.totalDeductions,
        netPayable: calcResult.netPayable,
        taxableIncome: calcResult.taxableIncome,
        taxSheet: calcResult.taxSheet ?? null,
        tdsThisMonth: calcResult.tdsThisMonth,
        pfEmployee: calcResult.pfEmployee,
        pfEmployer: calcResult.pfEmployer,
        ssfEmployee: calcResult.ssfEmployee,
        ssfEmployer: calcResult.ssfEmployer,
        citDeduction: calcResult.citDeduction,
        loanDeduction: calcResult.loanDeduction,
        absentDeduction: calcResult.absentDeduction,
        otAmount: calcResult.otAmount,
        updatedAt: new Date()
      })
      .where(eq(payrollSlips.id, slipId));

    // Update computed values for non-overridden slip heads
    for (const head of calcResult.heads) {
      const existingHead = currentSlipHeads.find(sh => sh.payHeadId === head.payHeadId);
      if (existingHead && !existingHead.isManualOverride) {
        await tx.update(payrollSlipHeads)
          .set({
            calculatedAmount: head.calculatedAmount
          })
          .where(and(
            eq(payrollSlipHeads.payrollSlipId, slipId),
            eq(payrollSlipHeads.payHeadId, head.payHeadId)
          ));
      }
    }

    // Log to audit trail
    const finalUpdatedSlip = await repository.findSlipById(slipId);
    await tx.insert(auditLogs).values({
      userId,
      action: 'EDIT',
      module: 'PAYROLL_GENERATE',
      recordId: slipId,
      result: 'SUCCESS',
      oldValues: oldSlipSnapshot,
      newValues: finalUpdatedSlip
    });
  });

  // Totals from the committed payslips (4.8 fix: summing inside the transaction read the old slip).
  await repository.refreshRunTotals(run.id);
}

// -----------------------------------------------------------------------------
// Fallback, Revert & Recalculation Methods
// -----------------------------------------------------------------------------

/**
 * Synchronize and recalculate attendance for a draft payroll run.
 * Re-reads latest punches & leaves and refreshes payslip deductions and net amounts.
 */
export async function syncPayrollRunAttendance(
  runId: string,
  userId: string
): Promise<PayrollRun> {
  const run = await repository.findPayrollRunById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }
  if (isOffCycle(run.runType)) throw new UserFacingError('An off-cycle run does not read attendance.');

  const slips = await repository.findSlipsByRunId(runId);
  // Re-reads attendance for the month (closed summary, or worked out now); never unlocks anything (4.5).
  const attendance = await attendanceForPayroll(slips.map((x) => x.employeeId), {
    bsYear: run.payPeriodYear,
    bsMonth: run.payPeriodMonth,
    start: run.payPeriodStartDate,
    end: run.payPeriodEndDate,
  });
  for (const s of slips) {
    const calc = attendance.get(s.employeeId);
    await overridePayslipAllowanceDeduction({
      slipId: s.id,
      absentDeduction: calc?.leaveDeductionAmount ?? "0",
      otAmount: calc?.otEarnedAmount ?? "0",
    }, userId);
  }

  return (await repository.findPayrollRunById(runId))!;
}

export async function deletePayrollRun(runId: string, userId: string): Promise<void> {
  const run = await repository.findPayrollRunById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  // A deleted draft gives its TA-DA claims back in the same transaction (arrears go with the run).
  await payrollFeedService.discardDraftRun(runId);

  await (await getDb()).insert(auditLogs).values({
    userId,
    action: 'DELETE',
    module: 'PAYROLL_GENERATE',
    recordId: runId,
    result: 'SUCCESS',
    oldValues: run,
    newValues: null
  });
}

export async function deleteEmployeePayslip(slipId: string, userId: string): Promise<{ remainingCount: number }> {
  await assertNotOwnSlip(slipId, userId, 'DELETE');
  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  // Delete slip (cascades to slip heads), giving back the TA-DA claims and arrears it paid (4.8 fix).
  await payrollFeedService.deleteSlipWithFeeds({ id: slip.id, payrollRunId: run.id, employeeId: slip.employeeId });

  // Totals and employee count from the remaining payslips (4.8 fix).
  await repository.refreshRunTotals(run.id);
  const remainingSlips = await repository.findSlipsByRunId(run.id);

  await (await getDb()).insert(auditLogs).values({
    userId,
    action: 'DELETE',
    module: 'PAYROLL_GENERATE',
    recordId: slipId,
    result: 'SUCCESS',
    oldValues: slip,
    newValues: { remainingCount: remainingSlips.length }
  });

  return { remainingCount: remainingSlips.length };
}

export async function recalculateEmployeePayslip(slipId: string, userId: string): Promise<{
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
}> {
  await assertNotOwnSlip(slipId, userId, 'EDIT');
  const currentSlip = await repository.findSlipById(slipId);
  if (!currentSlip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(currentSlip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }
  // F6: an off-cycle payslip is re-worked from its own lines (fresh marginal TDS).
  if (isOffCycle(run.runType)) {
    await offCycleService.recalculateOffCycleSlip(slipId, userId);
    return getPayslipWithHeads(slipId);
  }

  const emp = await employeeRepository.findById(currentSlip.employeeId);
  if (!emp) throw new Error("Employee not found");

  // The salary revision in force for the run's month, as when the run was generated (4.4) — not
  // a later approved revision.
  const salaryMap = (await salaryMappingRepository.findInForceByEmployeeIds([emp.id], run.payPeriodEndDate)).get(emp.id) ?? null;
  if (!salaryMap) {
    throw new SalaryMappingMissingError([emp.fullName]);
  }

  // Attendance for this month (4.5): closed summary, or worked out now without saving.
  const leaveOtCalc = (await attendanceForPayroll([emp.id], { bsYear: run.payPeriodYear, bsMonth: run.payPeriodMonth, start: run.payPeriodStartDate, end: run.payPeriodEndDate })).get(emp.id);
  const attendCalc = {
    leaveDeductionAmount: leaveOtCalc?.leaveDeductionAmount || "0",
    otEarnedAmount: leaveOtCalc?.otEarnedAmount || "0"
  };

  // Resolve active loans (disbursed on or before period end)
  const empLoans = await (await getDb())
    .select()
    .from(loans)
    .where(
      and(
        eq(loans.employeeId, emp.id),
        eq(loans.status, "ACTIVE"),
        lte(loans.givenDate, run.payPeriodEndDate)
      )
    )
    .orderBy(asc(loans.createdAt));

  let activeLoanDeduction = "0";
  if (empLoans && empLoans.length > 0) {
    let totalInstallment = new Decimal(0);
    for (const loan of empLoans) {
      const installment = Decimal.min(
        new Decimal(loan.installmentAmount),
        new Decimal(loan.remainingAmount)
      );
      totalInstallment = totalInstallment.plus(installment);
    }
    activeLoanDeduction = totalInstallment.toDecimalPlaces(2).toString();
  } else {
    // Fallback to loan deductions configured in employee salary mapping
    const mappedLoan = new Decimal(salaryMap.loan1Deduction || 0).plus(new Decimal(salaryMap.loan2Deduction || 0));
    if (mappedLoan.gt(0)) {
      activeLoanDeduction = mappedLoan.toDecimalPlaces(2).toString();
    }
  }

  // Load the run's fiscal year's tax slabs & system control
  const slabs = await taxRateRepository.findSlabsByFiscalYear(run.fiscalYearId);
  const taxSlabInputs = slabs.map(s => ({
    id: s.id,
    category: s.category,
    amountFrom: s.amountFrom.toString(),
    amountTo: s.amountTo ? s.amountTo.toString() : null,
    ratePercent: s.ratePercent.toString(),
    fixedDeduction: s.fixedDeduction.toString()
  }));
  const systemControl = await systemControlRepository.findSettings();

  // Load all pay heads
  const allPayHeads = await (await getDb()).select().from(payHeads);

  const isFestivalChecked = run.occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find(dbH => dbH.id === id);
    return h?.isFestivalAllowance;
  }) ?? false;

  const isRemoteChecked = run.occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find(dbH => dbH.id === id);
    return h?.isRemoteAllowance;
  }) ?? false;

  const calculatorHeadsInput = salaryMap.salaryHeads.filter((ah: { payHeadId: string }) => !isFeedHeadCode(allPayHeads.find((h) => h.id === ah.payHeadId)?.code)).map((ah: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }) => {
    const dbHead = allPayHeads.find(h => h.id === ah.payHeadId);
    return {
      id: ah.payHeadId,
      payHeadId: ah.payHeadId,
      code: dbHead?.code || ah.payHeadId,
      name: dbHead?.name || ah.payHeadName,
      type: (dbHead?.type || ah.payHeadType) as "allowance" | "deduction",
      effectOnTax: dbHead?.effectOnTax ?? true,
      isFestivalAllowance: dbHead?.isFestivalAllowance ?? false,
      isAbsentDeduct: dbHead?.isAbsentDeduct ?? false,
      isOtHead: dbHead?.isOtHead ?? false,
      isLeaveHead: dbHead?.isLeaveHead ?? false,
      isTdsHead: dbHead?.isTdsHead ?? false,
      isPfHead: dbHead?.isPfHead ?? false,
      isSsfHead: Boolean(dbHead?.isSsfHead || (dbHead && isSsfDeductionHead(dbHead as any))),
      isSsfEmployerHead: Boolean((dbHead as any)?.isSsfEmployerHead || (dbHead && isSsfEmployerHead(dbHead as any))),
      isRemoteAllowance: dbHead?.isRemoteAllowance ?? false,
      isCitHead: dbHead?.isCitHead ?? false,
      calcBasis: dbHead?.calcBasis ?? "None",
      calcParameter: dbHead?.calcParameter ?? "FixedAmount",
      calcPercent: dbHead?.calcPercent?.toString() ?? "0",
      amount: ah.amount.toString(),
      isManualOverride: false,
    };
  });

  const toPayHeadObj = (masterHead: typeof payHeads.$inferSelect) => ({
    id: masterHead.id,
    payHeadId: masterHead.id,
    code: masterHead.code || masterHead.id,
    name: masterHead.name,
    type: masterHead.type as "allowance" | "deduction",
    effectOnTax: masterHead.effectOnTax,
    isFestivalAllowance: masterHead.isFestivalAllowance,
    isAbsentDeduct: masterHead.isAbsentDeduct,
    isOtHead: masterHead.isOtHead,
    isLeaveHead: masterHead.isLeaveHead,
    isTdsHead: masterHead.isTdsHead,
    isPfHead: masterHead.isPfHead,
    isSsfHead: Boolean(masterHead.isSsfHead || isSsfDeductionHead(masterHead as any)),
    isSsfEmployerHead: Boolean((masterHead as any).isSsfEmployerHead || isSsfEmployerHead(masterHead as any)),
    isRemoteAllowance: masterHead.isRemoteAllowance,
    isCitHead: masterHead.isCitHead,
    calcBasis: masterHead.calcBasis,
    calcParameter: masterHead.calcParameter,
    calcPercent: masterHead.calcPercent?.toString() || "0",
    amount: "0",
    isManualOverride: false,
  });

  // One-off feeds this run already pays stay on the payslip (4.8 fix): the TA-DA claims and
  // arrears settled with it, and the month's welfare-fund contribution.
  const [feedHeadRows, paidHere, fundHere] = await Promise.all([
    feedsRepository.feedHeads(),
    feedsRepository.paidThroughRun(run.id, emp.id),
    feedsRepository.fundContributionsByEmployee([emp.id], run.payPeriodYear, run.payPeriodMonth),
  ]);
  if (feedHeadRows.tada && Number(paidHere.tada) !== 0) calculatorHeadsInput.push({ ...toPayHeadObj(feedHeadRows.tada), amount: paidHere.tada, isManualOverride: true });
  if (feedHeadRows.arrears && Number(paidHere.arrears) > 0) calculatorHeadsInput.push({ ...toPayHeadObj(feedHeadRows.arrears), amount: paidHere.arrears, isManualOverride: true });
  const fundHereAmount = fundHere.get(emp.id);
  if (feedHeadRows.welfare && fundHereAmount) calculatorHeadsInput.push({ ...toPayHeadObj(feedHeadRows.welfare), amount: fundHereAmount, isManualOverride: true });

  // Ensure statutory master heads
  if (!calculatorHeadsInput.some((h) => h.isTdsHead)) {
    const tdsMaster = allPayHeads.find((h) => h.isTdsHead);
    if (tdsMaster) calculatorHeadsInput.push(toPayHeadObj(tdsMaster));
  }

  const hasSsfAssigned = calculatorHeadsInput.some((h) => h.isSsfHead || h.isSsfEmployerHead || isSsfEmployerHead(h) || isSsfDeductionHead(h) || h.name.toLowerCase().includes('ssf'));
  if (hasSsfAssigned) {
    if (!calculatorHeadsInput.some((h) => isSsfEmployerHead(h))) {
      const ssfErMaster = allPayHeads.find((h) => isSsfEmployerHead(h as any));
      if (ssfErMaster) calculatorHeadsInput.push(toPayHeadObj(ssfErMaster));
    }
    if (!calculatorHeadsInput.some((h) => isSsfDeductionHead(h))) {
      const ssfDedMaster = allPayHeads.find((h) => isSsfDeductionHead(h as any));
      if (ssfDedMaster) calculatorHeadsInput.push(toPayHeadObj(ssfDedMaster));
    }
  }

  const isYearEnd = isAshadh(run.payPeriodMonth);
  let historicalSlips: Array<{ grossEarnings: string; pfEmployee: string; citDeduction: string; tdsThisMonth: string }> = [];
  if (isYearEnd) {
    const pastSlips = await (await getDb()).select()
      .from(payrollSlips)
      .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
      .where(
        and(
          eq(payrollSlips.employeeId, emp.id),
          eq(payrollRuns.fiscalYearId, run.fiscalYearId),
          eq(payrollRuns.status, 'LOCKED'),
          sql`payroll_slips.id != ${slipId}`
        )
      );

    historicalSlips = pastSlips.map(s => ({
      grossEarnings: s.payroll_slips.grossEarnings,
      pfEmployee: s.payroll_slips.pfEmployee,
      citDeduction: s.payroll_slips.citDeduction,
      tdsThisMonth: s.payroll_slips.tdsThisMonth
    }));
    // F15: an opening balance is one more past payslip.
    const opening = (await openingRepository.openingsFor([emp.id], run.fiscalYearId)).get(emp.id);
    if (opening) historicalSlips.push(openingAsYearEndSlip(opening));
  }

  const calcResult = calculatePayslip({
    employee: {
      id: emp.id,
      category: emp.category,
      gender: emp.gender,
      isDisabled: emp.isDisabled,
      taxStatus: emp.taxStatus,
      joiningDate: typeof emp.joiningDate === 'string' ? emp.joiningDate : (emp.joiningDate as any).toISOString().split('T')[0]
    },
    salaryMap: {
      basicSalary: salaryMap.basicSalary.toString(),
      gradePercent: (salaryMap.gradePercent || 0).toString(),
      gradeAmount: (salaryMap.gradeAmount || 0).toString(),
    },
    assignedHeads: calculatorHeadsInput,
    attendanceCalc: attendCalc,
    loanDeduction: activeLoanDeduction,
    systemControl,
    taxSlabs: taxSlabInputs,
    isFestivalMonth: isFestivalChecked,
    isRemoteMonth: isRemoteChecked,
    isYearEnd,
    historicalPayslips: historicalSlips,
    fiscalMonthIndex: getFiscalMonthIndex(run.payPeriodMonth),
    projectionHistory: isYearEnd ? [] : ((await repository.findEarlierTaxMonths([emp.id], run.fiscalYearId, getFiscalMonthIndex(run.payPeriodMonth), run.id)).get(emp.id) ?? []),
  });

  // Transactionally update slip and replace heads
  await (await getDb()).transaction(async (tx) => {
    await tx.update(payrollSlips)
      .set({
        basicSalary: salaryMap.basicSalary.toString(),
        gradeAmount: (salaryMap.gradeAmount || 0).toString(),
        grossEarnings: calcResult.grossEarnings,
        totalDeductions: calcResult.totalDeductions,
        netPayable: calcResult.netPayable,
        taxableIncome: calcResult.taxableIncome,
        taxSheet: calcResult.taxSheet ?? null,
        tdsThisMonth: calcResult.tdsThisMonth,
        pfEmployee: calcResult.pfEmployee,
        pfEmployer: calcResult.pfEmployer,
        ssfEmployee: calcResult.ssfEmployee,
        ssfEmployer: calcResult.ssfEmployer,
        citDeduction: calcResult.citDeduction,
        loanDeduction: calcResult.loanDeduction,
        absentDeduction: calcResult.absentDeduction,
        otAmount: calcResult.otAmount,
        updatedAt: new Date()
      })
      .where(eq(payrollSlips.id, slipId));

    // Replace slip heads
    await tx.delete(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slipId));
    const sanitizedHeads = sanitizeSlipHeads(calcResult.heads, allPayHeads);
    if (sanitizedHeads.length > 0) {
      await tx.insert(payrollSlipHeads).values(
        sanitizedHeads.map(h => ({
          payrollSlipId: slipId,
          payHeadId: h.payHeadId,
          payHeadName: h.payHeadName,
          headType: h.headType,
          amount: h.amount,
          calculatedAmount: h.calculatedAmount,
          isManualOverride: false,
          overrideReason: null
        }))
      );
    }

    await tx.insert(auditLogs).values({
      userId,
      action: 'EDIT',
      module: 'PAYROLL_GENERATE',
      recordId: slipId,
      result: 'SUCCESS',
      oldValues: currentSlip,
      newValues: { action: 'Recalculated from master data' }
    });
  });

  // Totals from the committed payslips (4.8 fix).
  await repository.refreshRunTotals(run.id);

  return getPayslipWithHeads(slipId);
}

export async function addPayHeadToPayslip(
  payload: AddSlipHeadPayload,
  userId: string
): Promise<{ slip: PayrollSlip; heads: PayrollSlipHead[] }> {
  const { slipId, payHeadId, amount, reason } = payload;
  await assertNotOwnSlip(slipId, userId, 'EDIT');
  const currentSlip = await repository.findSlipById(slipId);
  if (!currentSlip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(currentSlip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }
  if (isOffCycle(run.runType)) throw new UserFacingError('An off-cycle payslip pays only its own heads; add the line in a regular run.');

  const allPayHeads = await (await getDb()).select().from(payHeads);
  const targetHead = allPayHeads.find(h => h.id === payHeadId);
  if (!targetHead) throw new Error("Pay head not found");
  if (isFeedHeadCode(targetHead.code)) throw new UserFacingError(`${targetHead.name} comes from ${FEED_SOURCE[targetHead.code!]}; it is not added by hand.`);

  const existingHeads = await repository.findSlipHeadsBySlipId(slipId);
  const existingHead = existingHeads.find(h => h.payHeadId === payHeadId);

  if (existingHead) {
    throw new Error(`Pay head "${targetHead.name}" is already added to this payslip. Use the edit button to adjust existing amounts.`);
  }

  // Insert new head into slip heads
  await repository.addSlipHead(slipId, {
    payHeadId,
    payHeadName: targetHead.name,
    headType: targetHead.type as 'allowance' | 'deduction',
    amount,
    calculatedAmount: amount,
    isManualOverride: true,
    overrideReason: reason
  });

  // Re-run calculatePayslip with this new head included
  await overridePayslipAllowanceDeduction({
    slipId,
    headId: payHeadId,
    amount,
    reason
  }, userId);

  return getPayslipWithHeads(slipId);
}

// -----------------------------------------------------------------------------
// Approval & State Transitions
// -----------------------------------------------------------------------------

export async function transitionPayrollRun(
  runId: string,
  toStatus: PayrollRunStatus,
  actionByUserId: string,
  notes?: string
): Promise<PayrollRun> {
  const run = await repository.findPayrollRunById(runId);
  if (!run) throw new Error("Payroll run not found");

  // Enforce strict state machine: DRAFT → UNDER_REVIEW → APPROVED → LOCKED
  const VALID_TRANSITIONS: Record<string, string[]> = {
    'DRAFT': ['UNDER_REVIEW'],
    'UNDER_REVIEW': ['APPROVED', 'DRAFT'], // Can revert to DRAFT (rejection)
    'APPROVED': ['LOCKED', 'DRAFT'],       // Can revert to DRAFT (rejection)
    'LOCKED': [],                           // Terminal state
  };

  const allowedNextStatuses = VALID_TRANSITIONS[run.status] || [];
  if (!allowedNextStatuses.includes(toStatus)) {
    throw new Error(
      `Invalid status transition: ${run.status} → ${toStatus}. ` +
      `Allowed transitions from ${run.status}: ${allowedNextStatuses.join(', ') || 'none (locked)'}. ` +
      `Payroll runs must follow the workflow: DRAFT → UNDER_REVIEW → APPROVED → LOCKED.`
    );
  }

  // 1. Maker-checker (4.8 / F2): approving needs every variance flag acknowledged and someone other
  //    than the generator; locking needs someone other than the generator (strict mode: also not
  //    someone the run pays). Company administrators are exempt in the default mode only.
  await assertCanMove(run, toStatus, actionByUserId);

  // Perform status transition
  // Claim-first: the move happens only while the run still has the status it was read with.
  const updatedRun = await repository.updatePayrollRunStatus(runId, toStatus, actionByUserId, notes, run.status);

  // F13: a run sent back to draft takes the bank details now on the records (a change approved
  // while it was in review — the variance review flagged it — reaches its payslips).
  if (toStatus === 'DRAFT') {
    const refreshed = await refreshRunBankDetails(runId);
    if (refreshed) logger.info('Bank details refreshed from employee records', { runId, payslips: refreshed });
  }

  // 2. On LOCK: Atomic loan repayment amortisation and period sealing
  if (toStatus === 'LOCKED') {
    await (await getDb()).transaction(async (tx) => {
      await repository.lockAllSlipsForRun(runId);
      // F6: an off-cycle run seals its payslips only — no attendance, loan or salary-structure changes.
      if (isOffCycle(run.runType)) return;

      const slips = await repository.findSlipsByRunId(runId);
      const slipEmpIds = slips.map((s) => s.employeeId);

      // Atomically seal attendance punches and leave/OT calculations for this pay period
      if (slipEmpIds.length > 0 && run.payPeriodStartDate && run.payPeriodEndDate) {
        await tx.update(attendanceRecords)
          .set({ isLocked: true, updatedAt: new Date() })
          .where(
            and(
              inArray(attendanceRecords.employeeId, slipEmpIds),
              gte(attendanceRecords.attendanceDate, run.payPeriodStartDate),
              lte(attendanceRecords.attendanceDate, run.payPeriodEndDate)
            )
          );

        await tx.update(leaveOtCalculations)
          .set({ isLocked: true, updatedAt: new Date() })
          .where(
            and(
              inArray(leaveOtCalculations.employeeId, slipEmpIds),
              eq(leaveOtCalculations.bsMonth, run.payPeriodMonth),
              eq(leaveOtCalculations.fiscalYearId, run.fiscalYearId)
            )
          );
      }
      for (const slip of slips) {
        const loanAmt = new Decimal(slip.loanDeduction);
        if (loanAmt.gt(0)) {
          // Find all active loans for employee disbursed on or before period end
          const activeLoans = await tx.select().from(loans).where(
            and(
              eq(loans.employeeId, slip.employeeId),
              eq(loans.status, 'ACTIVE'),
              lte(loans.givenDate, run.payPeriodEndDate)
            )
          ).orderBy(asc(loans.createdAt));

          let remainingToDeduct = loanAmt;

          for (const loan of activeLoans) {
            if (remainingToDeduct.lte(0)) break;

            const installmentCap = Decimal.min(
              new Decimal(loan.installmentAmount),
              new Decimal(loan.remainingAmount)
            );
            const portionToDeduct = Decimal.min(remainingToDeduct, installmentCap);

            if (portionToDeduct.gt(0)) {
              const paid = new Decimal(loan.totalReturned).plus(portionToDeduct).toDecimalPlaces(2);
              const remaining = new Decimal(loan.remainingAmount).minus(portionToDeduct).toDecimalPlaces(2);
              const newStatus = remaining.lte(0) ? "CLOSED" : "ACTIVE";

              // Update loan record
              await tx.update(loans)
                .set({
                  totalReturned: paid.toString(),
                  remainingAmount: remaining.toString(),
                  status: newStatus,
                  updatedAt: new Date()
                })
                .where(eq(loans.id, loan.id));

              // Record repayment ledger entry
              await tx.insert(loanRepayments).values({
                loanId: loan.id,
                employeeId: slip.employeeId,
                repaymentDate: run.payPeriodEndDate || new Date().toISOString().split('T')[0],
                amountPaid: portionToDeduct.toString(),
                paymentMethod: "SALARY_DEDUCTION",
                payrollSlipId: slip.id,
                createdBy: actionByUserId
              });

              remainingToDeduct = remainingToDeduct.minus(portionToDeduct);
            }
          }

          // Synchronize updated active loan balances into employee salary mapping
          await loanService.syncActiveLoansToSalaryMapping(slip.employeeId, tx);
        }
      }

      // S45: locking never writes a payslip's heads into anyone's salary structure. A payslip's
      // one-off lines (TA-DA, arrears, welfare fund) and a reviewer's overrides are that month only;
      // pay changes go through Salary structure as dated, approved revisions (4.4).
    });
  }

  // Log transition to audit_logs
  await (await getDb()).insert(auditLogs).values({
    userId: actionByUserId,
    action: toStatus === 'LOCKED' ? 'LOCK' : 'APPROVE',
    module: 'PAYROLL_REVIEW',
    recordId: runId,
    result: 'SUCCESS',
    oldValues: { status: run.status },
    newValues: { status: toStatus, notes }
  });

  return updatedRun;
}

export async function getPayrollGeneratePageData() {
  const session = await auth();
  let userRole = "System Administrator"; // Default fallback
  if (session?.user?.roleId) {
    const roleRecord = await roleRepository.findRoleById(session.user.roleId);
    if (roleRecord) {
      userRole = roleRecord.name;
    }
  }

  const [runs, branches, departmentsList, designationsList, employeesList, payHeadsList] = await Promise.all([
    getPayrollHistory(),
    branchRepository.findAllBranches(),
    departmentRepository.findAllDepartments(),
    designationRepository.findAllDesignations(),
    employeeRepository.findAll({ search: "", branchId: "all", departmentId: "all", category: "all", status: "Active" }),
    payHeadRepository.findAllPayHeads(),
  ]);

  const mappedBranches = branches.map(b => ({ id: b.id, name: b.name }));
  const mappedDepts = departmentsList.map(d => ({ id: d.id, name: d.name }));
  const mappedDesignations = designationsList.map(d => ({ id: d.id, name: d.name }));
  const mappedEmployees = employeesList.map(e => ({
    id: e.id,
    name: e.fullName,
    employeeCode: e.employeeCode,
    branchId: e.branchId,
    departmentId: e.departmentId,
    designationId: e.designationId,
    category: e.category,
    hasBank: Boolean(e.bankAccountNumber && e.bankAccountNumber.trim() !== ""),
    bankName: e.bankName || null,
    bankAccountNumber: e.bankAccountNumber || null,
    panNumber: e.panNumber || null,
  }));
  const occasionalAllowances = payHeadsList
    .filter(ph => ph.flags.isFestivalAllowance || ph.flags.isRemoteAllowance)
    .map(ph => ({
      id: ph.id,
      name: ph.name,
      isFestivalAllowance: !!ph.flags.isFestivalAllowance,
      isRemoteAllowance: !!ph.flags.isRemoteAllowance
    }));

  const allPayHeadsMapped = payHeadsList.map(ph => ({
    id: ph.id,
    name: ph.name,
    code: ph.code,
    type: ph.type as 'allowance' | 'deduction',
  }));

  return {
    runs,
    branches: mappedBranches,
    departments: mappedDepts,
    designations: mappedDesignations,
    employees: mappedEmployees,
    occasionalAllowances,
    allPayHeads: allPayHeadsMapped,
    userRole,
  };
}

