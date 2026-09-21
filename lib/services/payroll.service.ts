import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { 
  payrollRuns, 
  payrollSlips, 
  payrollSlipHeads, 
  leaveOtCalculations, 
  employees, 
  taxRateSlabs, 
  loans, 
  loanRepayments, 
  leaveApplications,
  auditLogs,
  rolePermissionChangeLog,
  employeeBank,
  departments,
  designations,
  payHeads,
  fiscalYears,
  userRoles,
  roles,
  employeeSalaryMap,
  employeeSalaryHeads
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import * as repository from "@/lib/repositories/payroll.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as systemControlRepository from "@/lib/repositories/system-control.repository";
import * as taxRateRepository from "@/lib/repositories/tax-rate.repository";
import * as loanRepository from "@/lib/repositories/loan.repository";
import * as branchRepository from "@/lib/repositories/branch.repository";
import * as departmentRepository from "@/lib/repositories/department.repository";
import * as designationRepository from "@/lib/repositories/designation.repository";
import * as payHeadRepository from "@/lib/repositories/pay-head.repository";
import * as roleRepository from "@/lib/repositories/role.repository";
import { auth } from "@/lib/auth";
import { calculatePayslip, NegativeNetPayableError, MissingStatutoryHeadError, isSsfEmployerHead, isSsfDeductionHead } from "@/lib/engines/payroll.engine";
import { calculateNetSalary } from "@/lib/engines/salary-mapping.engine";
import { getBSMonthRange } from "@/lib/utils/bs-calendar";
import { isAshadh } from "@/lib/utils/fiscal-year.utils";
import Decimal from "decimal.js";

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
    super(`Salary mapping is missing for employees: ${employeeNames.join(", ")}`);
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
    branchIds
  });
  if (existingRuns.length > 0) {
    const hasLocked = existingRuns.some(r => r.status === 'LOCKED');
    if (hasLocked) {
      throw new PayrollLockedError();
    }

    if (payload.recreateIfExists) {
      for (const run of existingRuns) {
        await repository.deletePayrollRun(run.id);
        await getDb().insert(auditLogs).values({
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
  const activeFys = await getDb().select().from(fiscalYears).where(eq(fiscalYears.status, 'Active'));
  if (!activeFys.length) throw new Error("No active fiscal year found in system");
  const activeFy = activeFys[0] as { id: string; label: string };

  // 3. Load all active employees in scoped branches/departments
  const allEmployees = await employeeRepository.findAll({
    search: "",
    branchId: branchIds.length === 1 ? branchIds[0] : "all",
    departmentId: departmentIds && departmentIds.length === 1 ? departmentIds[0] : "all",
    category: "all",
    status: "Active"
  });

  // Filter in memory for multi-select branches/departments/designations/categories/employees
  const scopedEmployees = allEmployees.filter(emp => {
    const matchesBranch = branchIds.includes(emp.branchId);
    const matchesDept = !departmentIds || departmentIds.length === 0 || departmentIds.includes(emp.departmentId);
    const matchesDesig = !designationIds || designationIds.length === 0 || designationIds.includes(emp.designationId);
    const matchesCategory = !employeeCategories || employeeCategories.length === 0 || employeeCategories.includes(emp.category);
    const matchesEmployee = !employeeIds || employeeIds.length === 0 || employeeIds.includes(emp.id);
    return matchesBranch && matchesDept && matchesDesig && matchesCategory && matchesEmployee;
  });

  if (scopedEmployees.length === 0) {
    throw new Error("No active employees found in the selected scope.");
  }

  // 4. Validate that every employee in scope has a salary mapping
  // BATCH PREFETCH: Load all salary mappings in a single query instead of N+1 per-employee
  const missingSalaryMappings: string[] = [];
  const salaryMapByEmployeeId = await salaryMappingRepository.findActiveByEmployeeIds(
    scopedEmployees.map(e => e.id)
  );

  for (const emp of scopedEmployees) {
    if (!salaryMapByEmployeeId.has(emp.id)) {
      missingSalaryMappings.push(`${emp.fullName} (${emp.employeeCode})`);
    }
  }

  if (missingSalaryMappings.length > 0) {
    throw new SalaryMappingMissingError(missingSalaryMappings);
  }

  // 5. Batch-load Leave/OT calculations for all employees at once (performance fix)
  const empIds = scopedEmployees.map(e => e.id);
  const allLeaveOtCalcs = await getDb().select().from(leaveOtCalculations).where(
    and(
      inArray(leaveOtCalculations.employeeId, empIds),
      eq(leaveOtCalculations.bsMonth, payPeriodMonth),
      eq(leaveOtCalculations.fiscalYearId, activeFy.id)
    )
  );

  // Build lookup map and validate all are locked
  const leaveOtByEmployeeId = new Map<string, typeof allLeaveOtCalcs[0]>();
  for (const calc of allLeaveOtCalcs) {
    leaveOtByEmployeeId.set(calc.employeeId, calc);
  }

  for (const emp of scopedEmployees) {
    const calc = leaveOtByEmployeeId.get(emp.id);
    if (!calc || !calc.isLocked) {
      throw new LeaveOtCalculationNotLockedError(payPeriodMonth, payPeriodYear);
    }
  }

  // 6. Verify that there are no pending (unapproved) leave applications in the period
  const pendingLeaves = await getDb().select({ count: sql`count(*)` }).from(leaveApplications).where(
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

  // Load tax rate slabs
  const slabs = await taxRateRepository.findAllSlabs();
  const taxSlabInputs = slabs.map(s => ({
    id: s.id,
    category: s.category,
    amountFrom: s.amountFrom.toString(),
    amountTo: s.amountTo ? s.amountTo.toString() : null,
    ratePercent: s.ratePercent.toString(),
    fixedDeduction: s.fixedDeduction.toString()
  }));

  // Fetch detailed pay heads configurations to evaluate isFestivalAllowance / isRemoteAllowance
  const allPayHeads = await getDb().select().from(payHeads);
  const payHeadMap = new Map(allPayHeads.map((h) => [h.id, h]));

  const isFestivalChecked = occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find((dbH) => dbH.id === id);
    return h?.isFestivalAllowance;
  }) ?? false;

  const isRemoteChecked = occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find((dbH) => dbH.id === id);
    return h?.isRemoteAllowance;
  }) ?? false;

  // BATCH PREFETCH: Load all active loans for scoped employees at once
  const allActiveLoans = new Map<string, { installmentAmount: number; remainingAmount: number }[]>();
  for (const empId of empIds) {
    const empLoans = await loanRepository.findActiveLoansByEmployee(empId);
    if (empLoans.length > 0) {
      allActiveLoans.set(empId, empLoans.map(l => ({
        installmentAmount: l.installmentAmount,
        remainingAmount: l.remainingAmount
      })));
    }
  }

  // BATCH PREFETCH: Load all bank details for scoped employees
  const allBankDetails = await getDb().select().from(employeeBank).where(
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
  const deptList = await getDb().select().from(departments);
  const desigList = await getDb().select().from(designations);
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
    const allPastSlips = await getDb().select()
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
  }

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

    // Load salary heads assignments directly from DB pay heads master lookup
    const assignedHeads = salaryMap.salaryHeads.map((h: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }) => {
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
      historicalPayslips: historicalSlips
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
  const runRecord = await getDb().transaction(async (tx) => {
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

export async function overridePayslipAllowanceDeduction(
  payload: PayrollSlipOverridePayload,
  userId: string
): Promise<void> {
  const { 
    slipId, 
    headId, 
    amount, 
    reason,
    basicSalary,
    gradeAmount,
    otAmount,
    absentDeduction,
    bankName,
    bankAccountNumber
  } = payload;

  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status !== 'DRAFT') throw new PayrollLockedError();

  // Keep a snapshot of old values for forensic auditing
  const oldSlipSnapshot = { ...slip };

  // 1. Execute override & recalculation within an atomic transaction
  await getDb().transaction(async (tx) => {
    // Update basic fields on the slip directly if provided
    const updatedSlipFields: Record<string, any> = {};
    if (bankName !== undefined) updatedSlipFields.bankName = bankName;
    if (bankAccountNumber !== undefined) updatedSlipFields.bankAccountNumber = bankAccountNumber;
    if (basicSalary !== undefined) updatedSlipFields.basicSalary = basicSalary;
    if (gradeAmount !== undefined) updatedSlipFields.gradeAmount = gradeAmount;
    if (otAmount !== undefined) updatedSlipFields.otAmount = otAmount;
    if (absentDeduction !== undefined) updatedSlipFields.absentDeduction = absentDeduction;

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
    const slabs = await taxRateRepository.findAllSlabs();
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
      loanDeduction: currentSlip.loanDeduction,
      systemControl,
      taxSlabs: taxSlabInputs,
      isFestivalMonth: isFestivalChecked,
      isRemoteMonth: isRemoteChecked,
      isYearEnd,
      historicalPayslips: historicalSlips
    });

    // Save new values to the slip in the DB
    await tx.update(payrollSlips)
      .set({
        grossEarnings: calcResult.grossEarnings,
        totalDeductions: calcResult.totalDeductions,
        netPayable: calcResult.netPayable,
        taxableIncome: calcResult.taxableIncome,
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

    // Recalculate parent run totals
    const allSlips = await repository.findSlipsByRunId(run.id);
    let newGross = new Decimal(0);
    let newDeductions = new Decimal(0);
    let newNet = new Decimal(0);
    let newTds = new Decimal(0);
    let newPf = new Decimal(0);
    let newSsf = new Decimal(0);

    for (const s of allSlips) {
      newGross = newGross.plus(new Decimal(s.grossEarnings));
      newDeductions = newDeductions.plus(new Decimal(s.totalDeductions));
      newNet = newNet.plus(new Decimal(s.netPayable));
      newTds = newTds.plus(new Decimal(s.tdsThisMonth));
      newPf = newPf.plus(new Decimal(s.pfEmployee));
      newSsf = newSsf.plus(new Decimal(s.ssfEmployee));
    }

    await repository.updatePayrollRunTotals(run.id, {
      totalGross: newGross.toString(),
      totalDeductions: newDeductions.toString(),
      totalNetPayable: newNet.toString(),
      totalTds: newTds.toString(),
      totalPf: newPf.toString(),
      totalSsf: newSsf.toString()
    });

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
}

// -----------------------------------------------------------------------------
// Fallback, Revert & Recalculation Methods
// -----------------------------------------------------------------------------

export async function deletePayrollRun(runId: string, userId: string): Promise<void> {
  const run = await repository.findPayrollRunById(runId);
  if (!run) throw new Error("Payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  await repository.deletePayrollRun(runId);

  await getDb().insert(auditLogs).values({
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
  const slip = await repository.findSlipById(slipId);
  if (!slip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(slip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  // Delete slip (cascades to slip heads in DB)
  await repository.deletePayrollSlip(slipId);

  // Recalculate parent run totals
  const remainingSlips = await repository.findSlipsByRunId(run.id);
  let newGross = new Decimal(0);
  let newDeductions = new Decimal(0);
  let newNet = new Decimal(0);
  let newTds = new Decimal(0);
  let newPf = new Decimal(0);
  let newSsf = new Decimal(0);

  for (const s of remainingSlips) {
    newGross = newGross.plus(new Decimal(s.grossEarnings));
    newDeductions = newDeductions.plus(new Decimal(s.totalDeductions));
    newNet = newNet.plus(new Decimal(s.netPayable));
    newTds = newTds.plus(new Decimal(s.tdsThisMonth));
    newPf = newPf.plus(new Decimal(s.pfEmployee));
    newSsf = newSsf.plus(new Decimal(s.ssfEmployee));
  }

  await repository.updatePayrollRunTotals(run.id, {
    totalGross: newGross.toString(),
    totalDeductions: newDeductions.toString(),
    totalNetPayable: newNet.toString(),
    totalTds: newTds.toString(),
    totalPf: newPf.toString(),
    totalSsf: newSsf.toString(),
  });

  // Update employeeCount on the run
  await getDb().update(payrollRuns)
    .set({
      employeeCount: remainingSlips.length,
      updatedAt: new Date()
    })
    .where(eq(payrollRuns.id, run.id));

  await getDb().insert(auditLogs).values({
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
  const currentSlip = await repository.findSlipById(slipId);
  if (!currentSlip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(currentSlip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  const emp = await employeeRepository.findById(currentSlip.employeeId);
  if (!emp) throw new Error("Employee not found");

  const salaryMap = await salaryMappingRepository.findSalaryMappingByEmployeeId(emp.id);
  if (!salaryMap) {
    throw new SalaryMappingMissingError([emp.fullName]);
  }

  // Load Leave/OT calculation for this month
  const [leaveOtCalc] = await getDb().select().from(leaveOtCalculations).where(
    and(
      eq(leaveOtCalculations.employeeId, emp.id),
      eq(leaveOtCalculations.bsMonth, run.payPeriodMonth),
      eq(leaveOtCalculations.fiscalYearId, run.fiscalYearId)
    )
  );
  const attendCalc = {
    leaveDeductionAmount: leaveOtCalc?.leaveDeductionAmount || "0",
    otEarnedAmount: leaveOtCalc?.otEarnedAmount || "0"
  };

  // Resolve active loans
  const empLoans = await loanRepository.findActiveLoansByEmployee(emp.id);
  let totalInstallment = new Decimal(0);
  for (const loan of empLoans) {
    const installment = Decimal.min(
      new Decimal(loan.installmentAmount),
      new Decimal(loan.remainingAmount)
    );
    totalInstallment = totalInstallment.plus(installment);
  }
  const activeLoanDeduction = totalInstallment.toDecimalPlaces(2).toString();

  // Load tax slabs & system control
  const slabs = await taxRateRepository.findAllSlabs();
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
  const allPayHeads = await getDb().select().from(payHeads);

  const isFestivalChecked = run.occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find(dbH => dbH.id === id);
    return h?.isFestivalAllowance;
  }) ?? false;

  const isRemoteChecked = run.occasionalAllowanceHeadIds?.some(id => {
    const h = allPayHeads.find(dbH => dbH.id === id);
    return h?.isRemoteAllowance;
  }) ?? false;

  const calculatorHeadsInput = salaryMap.salaryHeads.map((ah: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }) => {
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
    const pastSlips = await getDb().select()
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
    historicalPayslips: historicalSlips
  });

  // Transactionally update slip and replace heads
  await getDb().transaction(async (tx) => {
    await tx.update(payrollSlips)
      .set({
        basicSalary: salaryMap.basicSalary.toString(),
        gradeAmount: (salaryMap.gradeAmount || 0).toString(),
        grossEarnings: calcResult.grossEarnings,
        totalDeductions: calcResult.totalDeductions,
        netPayable: calcResult.netPayable,
        taxableIncome: calcResult.taxableIncome,
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

    // Recalculate parent run totals
    const allSlips = await repository.findSlipsByRunId(run.id);
    let newGross = new Decimal(0);
    let newDeductions = new Decimal(0);
    let newNet = new Decimal(0);
    let newTds = new Decimal(0);
    let newPf = new Decimal(0);
    let newSsf = new Decimal(0);

    for (const s of allSlips) {
      const isThisSlip = s.id === slipId;
      const g = isThisSlip ? calcResult.grossEarnings : s.grossEarnings;
      const d = isThisSlip ? calcResult.totalDeductions : s.totalDeductions;
      const n = isThisSlip ? calcResult.netPayable : s.netPayable;
      const t = isThisSlip ? calcResult.tdsThisMonth : s.tdsThisMonth;
      const p = isThisSlip ? calcResult.pfEmployee : s.pfEmployee;
      const ss = isThisSlip ? calcResult.ssfEmployee : s.ssfEmployee;

      newGross = newGross.plus(new Decimal(g));
      newDeductions = newDeductions.plus(new Decimal(d));
      newNet = newNet.plus(new Decimal(n));
      newTds = newTds.plus(new Decimal(t));
      newPf = newPf.plus(new Decimal(p));
      newSsf = newSsf.plus(new Decimal(ss));
    }

    await repository.updatePayrollRunTotals(run.id, {
      totalGross: newGross.toString(),
      totalDeductions: newDeductions.toString(),
      totalNetPayable: newNet.toString(),
      totalTds: newTds.toString(),
      totalPf: newPf.toString(),
      totalSsf: newSsf.toString()
    });

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

  return getPayslipWithHeads(slipId);
}

export async function addPayHeadToPayslip(
  payload: AddSlipHeadPayload,
  userId: string
): Promise<{ slip: PayrollSlip; heads: PayrollSlipHead[] }> {
  const { slipId, payHeadId, amount, reason } = payload;
  const currentSlip = await repository.findSlipById(slipId);
  if (!currentSlip) throw new Error("Payslip not found");

  const run = await repository.findPayrollRunById(currentSlip.payrollRunId);
  if (!run) throw new Error("Parent payroll run not found");
  if (run.status === 'LOCKED') {
    throw new PayrollLockedError();
  }

  const allPayHeads = await getDb().select().from(payHeads);
  const targetHead = allPayHeads.find(h => h.id === payHeadId);
  if (!targetHead) throw new Error("Pay head not found");

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

  // 1. Separation of Duties Check for final LOCK
  //    System Admins are explicitly exempt — they can generate AND lock.
  if (toStatus === 'LOCKED' && run.generatedBy === actionByUserId) {
    const actorRoles = await getDb()
      .select({ slug: roles.slug })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, actionByUserId));

    const isAdmin = actorRoles.some((r: { slug: string }) => r.slug === 'system_admin' || r.slug === 'office_admin');
    if (!isAdmin) {
      throw new SeparationOfDutiesError();
    }
  }

  // Perform status transition
  const updatedRun = await repository.updatePayrollRunStatus(runId, toStatus, actionByUserId, notes);

  // 2. On LOCK: Atomic loan repayment amortisation across all active loans
  if (toStatus === 'LOCKED') {
    await getDb().transaction(async (tx) => {
      await repository.lockAllSlipsForRun(runId);

      const slips = await repository.findSlipsByRunId(runId);
      for (const slip of slips) {
        const loanAmt = new Decimal(slip.loanDeduction);
        if (loanAmt.gt(0)) {
          // Find all active loans for employee
          const activeLoans = await tx.select().from(loans).where(
            and(
              eq(loans.employeeId, slip.employeeId),
              eq(loans.status, 'ACTIVE')
            )
          );

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
                repaymentDate: new Date().toISOString().split('T')[0],
                amountPaid: portionToDeduct.toString(),
                paymentMethod: "SALARY_DEDUCTION",
                payrollSlipId: slip.id,
                createdBy: actionByUserId
              });

              remainingToDeduct = remainingToDeduct.minus(portionToDeduct);
            }
          }
        }
      }

      // 3. Synchronize newly added or overridden pay heads into master Salary Mapping
      const allDbPayHeads = await tx.select().from(payHeads);
      const payHeadById = new Map(allDbPayHeads.map(p => [p.id, p]));

      for (const slip of slips) {
        const slipHeads = await tx.select().from(payrollSlipHeads).where(eq(payrollSlipHeads.payrollSlipId, slip.id));

        // Filter for syncable heads: exclude dynamic runtime attendance/statutory calculations
        const syncableSlipHeads = slipHeads.filter(sh => {
          const ph = payHeadById.get(sh.payHeadId);
          if (!ph) return false;
          if (ph.isAbsentDeduct || ph.isLeaveHead || ph.isOtHead || ph.isTdsHead) return false;
          return true;
        });

        const activeMappingRows = await tx.select()
          .from(employeeSalaryMap)
          .where(and(
            eq(employeeSalaryMap.employeeId, slip.employeeId),
            eq(employeeSalaryMap.isActive, true)
          ));

        if (activeMappingRows.length > 0) {
          const mapping = activeMappingRows[0];
          const existingMappingHeads = await tx.select()
            .from(employeeSalaryHeads)
            .where(eq(employeeSalaryHeads.salaryMapId, mapping.id));

          let mappingModified = false;
          const updatedHeadsPayload: Array<{ payHeadId: string; amount: number; isChangeable?: boolean }> = [];
          const existingHeadMap = new Map(existingMappingHeads.map(eh => [eh.payHeadId, eh]));

          for (const sh of syncableSlipHeads) {
            const existingEh = existingHeadMap.get(sh.payHeadId);
            if (!existingEh) {
              // Newly added head on payslip! Sync to salary mapping
              mappingModified = true;
              updatedHeadsPayload.push({
                payHeadId: sh.payHeadId,
                amount: Number(sh.amount) || Number(sh.calculatedAmount) || 0,
                isChangeable: true
              });
            } else {
              // Existing head in mapping. If overridden on slip, update amount
              const slipAmount = Number(sh.amount);
              if (sh.isManualOverride && slipAmount !== Number(existingEh.amount)) {
                mappingModified = true;
                updatedHeadsPayload.push({
                  payHeadId: sh.payHeadId,
                  amount: slipAmount,
                  isChangeable: existingEh.isChangeable
                });
              } else {
                updatedHeadsPayload.push({
                  payHeadId: sh.payHeadId,
                  amount: Number(existingEh.amount),
                  isChangeable: existingEh.isChangeable
                });
              }
              existingHeadMap.delete(sh.payHeadId);
            }
          }

          // Retain any remaining mapping heads that were not on this slip
          for (const [_, remEh] of existingHeadMap) {
            updatedHeadsPayload.push({
              payHeadId: remEh.payHeadId,
              amount: Number(remEh.amount),
              isChangeable: remEh.isChangeable
            });
          }

          const slipBasic = Number(slip.basicSalary);
          const slipGrade = Number(slip.gradeAmount);
          if (slipBasic !== Number(mapping.basicSalary) || slipGrade !== Number(mapping.gradeAmount)) {
            mappingModified = true;
          }

          if (mappingModified) {
            const netAmount = calculateNetSalary({
              basicSalary: slipBasic,
              gradePercent: Number(mapping.gradePercent) || 0,
              gradeAmount: slipGrade,
              salaryHeads: updatedHeadsPayload.map(h => {
                const ph = payHeadById.get(h.payHeadId);
                return {
                  payHeadType: (ph?.type === 'deduction' ? 'deduction' : 'allowance') as 'allowance' | 'deduction',
                  amount: h.amount
                };
              }),
              loan1Deduction: Number(mapping.loan1Deduction) || 0,
              loan2Deduction: Number(mapping.loan2Deduction) || 0
            });

            await tx.update(employeeSalaryMap).set({
              basicSalary: slipBasic.toString(),
              gradeAmount: slipGrade.toString(),
              netAmount: netAmount.toString(),
              updatedAt: new Date()
            }).where(eq(employeeSalaryMap.id, mapping.id));

            await tx.delete(employeeSalaryHeads).where(eq(employeeSalaryHeads.salaryMapId, mapping.id));
            if (updatedHeadsPayload.length > 0) {
              await tx.insert(employeeSalaryHeads).values(
                updatedHeadsPayload.map(h => ({
                  salaryMapId: mapping.id,
                  payHeadId: h.payHeadId,
                  amount: h.amount.toString(),
                  isChangeable: h.isChangeable ?? true
                }))
              );
            }

            await tx.insert(auditLogs).values({
              userId: actionByUserId,
              action: 'EDIT',
              module: 'SALARY_MAPPING',
              recordId: mapping.id,
              result: 'SUCCESS',
              newValues: {
                syncedFromLockedPayrollRunId: runId,
                employeeId: slip.employeeId,
                updatedHeadsCount: updatedHeadsPayload.length
              }
            });
          }
        } else {
          // Employee had no prior active mapping: create active mapping from this locked slip
          const netAmount = calculateNetSalary({
            basicSalary: Number(slip.basicSalary),
            gradePercent: 0,
            gradeAmount: Number(slip.gradeAmount),
            salaryHeads: syncableSlipHeads.map(sh => {
              const ph = payHeadById.get(sh.payHeadId);
              return {
                payHeadType: (ph?.type === 'deduction' ? 'deduction' : 'allowance') as 'allowance' | 'deduction',
                amount: Number(sh.amount) || Number(sh.calculatedAmount) || 0
              };
            }),
            loan1Deduction: 0,
            loan2Deduction: 0
          });

          const [newMap] = await tx.insert(employeeSalaryMap).values({
            employeeId: slip.employeeId,
            fiscalYearId: run.fiscalYearId,
            effectiveFrom: run.payPeriodStartDate,
            basicSalary: slip.basicSalary,
            gradePercent: '0',
            gradeAmount: slip.gradeAmount,
            loan1Deduction: '0',
            loan2Deduction: '0',
            netAmount: netAmount.toString(),
            isActive: true,
            createdBy: actionByUserId
          }).returning({ id: employeeSalaryMap.id });

          if (syncableSlipHeads.length > 0) {
            await tx.insert(employeeSalaryHeads).values(
              syncableSlipHeads.map(sh => ({
                salaryMapId: newMap.id,
                payHeadId: sh.payHeadId,
                amount: (Number(sh.amount) || Number(sh.calculatedAmount) || 0).toString(),
                isChangeable: true
              }))
            );
          }

          await tx.insert(auditLogs).values({
            userId: actionByUserId,
            action: 'ADD',
            module: 'SALARY_MAPPING',
            recordId: newMap.id,
            result: 'SUCCESS',
            newValues: {
              syncedFromLockedPayrollRunId: runId,
              employeeId: slip.employeeId,
              headsCount: syncableSlipHeads.length
            }
          });
        }
      }
    });
  }

  // Log transition to audit_logs
  await getDb().insert(auditLogs).values({
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

