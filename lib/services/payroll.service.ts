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
  roles
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
import { calculatePayslip, NegativeNetPayableError, MissingStatutoryHeadError } from "@/lib/engines/payroll.engine";
import { getBSMonthRange } from "@/lib/utils/bs-calendar";
import { isAshadh } from "@/lib/utils/fiscal-year.utils";
import Decimal from "decimal.js";
import type { 
  PayrollRun, 
  PayrollSlip, 
  PayrollSlipHead, 
  PayrollRunStatus,
  PayrollRunSetupPayload,
  PayrollSlipOverridePayload
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
    throw new PayrollRunAlreadyExistsError(payPeriodMonth, payPeriodYear);
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
      missingSalaryMappings.push(`${emp.firstName} ${emp.lastName} (${emp.employeeCode})`);
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

    // MULTI-LOAN FIX: Sum ALL active loan installments, not just the first
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
    }

    // Load salary heads assignments
    const assignedHeads = salaryMap.salaryHeads.map((h: { payHeadId: string; payHeadName: string; payHeadType: string; amount: string | number }) => ({
      id: h.payHeadId,
      payHeadId: h.payHeadId,
      code: h.payHeadId, // Fallback
      name: h.payHeadName,
      type: h.payHeadType as "allowance" | "deduction",
      effectOnTax: true, // Standard fallback
      isFestivalAllowance: h.payHeadName.toLowerCase().includes("festival") || h.payHeadName.toLowerCase().includes("dashain"),
      isAbsentDeduct: false,
      isOtHead: false,
      isLeaveHead: false,
      isTdsHead: false,
      isPfHead: h.payHeadName.toLowerCase().includes("provident") || h.payHeadName.toLowerCase().includes("pf"),
      isSsfHead: h.payHeadName.toLowerCase().includes("social") || h.payHeadName.toLowerCase().includes("ssf"),
      isRemoteAllowance: h.payHeadName.toLowerCase().includes("remote"),
      isCitHead: h.payHeadName.toLowerCase().includes("cit") || h.payHeadName.toLowerCase().includes("citizen"),
      calcBasis: "None",
      calcParameter: "FixedAmount",
      calcPercent: "0",
      amount: h.amount.toString()
    }));

    // Ensure all statutory heads are present in assignedHeads so they get real UUIDs from db
    const statutoryChecks: Array<{ key: 'isPfHead' | 'isSsfHead' | 'isCitHead' | 'isTdsHead' }> = [
      { key: 'isPfHead' },
      { key: 'isSsfHead' },
      { key: 'isCitHead' },
      { key: 'isTdsHead' }
    ];

    for (const check of statutoryChecks) {
      const hasHead = assignedHeads.some((h: Record<string, any>) => h[check.key]);
      if (!hasHead) {
        const masterHead = allPayHeads.find((h: typeof payHeads.$inferSelect) => h[check.key]);
        if (masterHead) {
          assignedHeads.push({
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
            isSsfHead: masterHead.isSsfHead,
            isRemoteAllowance: masterHead.isRemoteAllowance,
            isCitHead: masterHead.isCitHead,
            calcBasis: masterHead.calcBasis,
            calcParameter: masterHead.calcParameter,
            calcPercent: masterHead.calcPercent?.toString() || "0",
            amount: "0"
          });
        }
      }
    }

    for (const head of assignedHeads) {
      const dbHead = allPayHeads.find((h) => h.id === head.payHeadId);
      if (dbHead) {
        head.effectOnTax = dbHead.effectOnTax;
        head.isFestivalAllowance = dbHead.isFestivalAllowance;
        head.isAbsentDeduct = dbHead.isAbsentDeduct;
        head.isOtHead = dbHead.isOtHead;
        head.isLeaveHead = dbHead.isLeaveHead;
        head.isTdsHead = dbHead.isTdsHead;
        head.isPfHead = dbHead.isPfHead;
        head.isSsfHead = dbHead.isSsfHead;
        head.isRemoteAllowance = dbHead.isRemoteAllowance;
        head.isCitHead = dbHead.isCitHead;
        head.calcBasis = dbHead.calcBasis;
        head.calcParameter = dbHead.calcParameter;
        head.calcPercent = dbHead.calcPercent.toString();
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
        gradeAmount: salaryMap.gradeAmount.toString()
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

    totalGrossSum = totalGrossSum.plus(new Decimal(calcResult.grossEarnings));
    totalDeductionsSum = totalDeductionsSum.plus(new Decimal(calcResult.totalDeductions));
    totalNetSum = totalNetSum.plus(new Decimal(calcResult.netPayable));
    totalTdsSum = totalTdsSum.plus(new Decimal(calcResult.tdsThisMonth));
    totalPfSum = totalPfSum.plus(new Decimal(calcResult.pfEmployee));
    totalSsfSum = totalSsfSum.plus(new Decimal(calcResult.ssfEmployee));

    // Use batch-loaded bank details
    const empBank = bankByEmployeeId.get(emp.id);
    const bankAccountNumber = empBank ? empBank.accountNumber : "N/A";
    const bankName = empBank ? empBank.bankName : "N/A";

    slipsWithHeads.push({
      slip: {
        payrollRunId: "", // Will populate inside repository transaction
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        departmentName: deptMap.get(emp.departmentId) || "Unknown Department",
        designationName: desigMap.get(emp.designationId) || "Unknown Designation",
        basicSalary: calcResult.basicSalary,
        gradeAmount: calcResult.gradeAmount || "0",
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
      heads: calcResult.heads
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
        code: sh.payHeadId,
        name: sh.payHeadName,
        type: sh.headType,
        effectOnTax: dbHead?.effectOnTax ?? true,
        isFestivalAllowance: dbHead?.isFestivalAllowance ?? false,
        isAbsentDeduct: dbHead?.isAbsentDeduct ?? false,
        isOtHead: dbHead?.isOtHead ?? false,
        isLeaveHead: dbHead?.isLeaveHead ?? false,
        isTdsHead: dbHead?.isTdsHead ?? false,
        isPfHead: dbHead?.isPfHead ?? false,
        isSsfHead: dbHead?.isSsfHead ?? false,
        isRemoteAllowance: dbHead?.isRemoteAllowance ?? false,
        isCitHead: dbHead?.isCitHead ?? false,
        calcBasis: dbHead?.calcBasis ?? "None",
        calcParameter: dbHead?.calcParameter ?? "FixedAmount",
        calcPercent: dbHead?.calcPercent?.toString() ?? "0",
        amount: baseAmt
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
    name: `${e.firstName} ${e.lastName}`,
    employeeCode: e.employeeCode,
    branchId: e.branchId,
    departmentId: e.departmentId,
    designationId: e.designationId,
    category: e.category
  }));
  const occasionalAllowances = payHeadsList
    .filter(ph => ph.flags.isFestivalAllowance || ph.flags.isRemoteAllowance)
    .map(ph => ({
      id: ph.id,
      name: ph.name,
      isFestivalAllowance: !!ph.flags.isFestivalAllowance,
      isRemoteAllowance: !!ph.flags.isRemoteAllowance
    }));

  return {
    runs,
    branches: mappedBranches,
    departments: mappedDepts,
    designations: mappedDesignations,
    employees: mappedEmployees,
    occasionalAllowances,
    userRole,
  };
}
