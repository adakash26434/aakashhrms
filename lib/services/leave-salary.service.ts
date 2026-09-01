import Decimal from "decimal.js";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import * as repository from "@/lib/repositories/leave-salary.repository";
import * as employeeRepository from "@/lib/repositories/employee.repository";
import * as salaryMappingRepository from "@/lib/repositories/salary-mapping.repository";
import * as leaveRepository from "@/lib/repositories/leave.repository";
import * as leaveRuleRepository from "@/lib/repositories/leave-rule.repository";
import * as fiscalYearRepository from "@/lib/repositories/fiscal-year.repository";
import { calculateLeaveSalary, validateEncashmentRequest } from "@/lib/engines/leave-salary.engine";
import type { LeaveSalaryRun, LeaveSalaryRunStatus, LeaveSalarySetupPayload, PaymentMethod, EncashmentType } from "@/lib/types/payroll";
import type { EncashmentRate } from "@/lib/types/leave-rule";

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------

export class LeaveSalaryAlreadyExistsError extends Error {
  constructor(public employeeId: string, public leaveTypeId: string, public period: string) {
    super(`A leave salary run already exists for this employee and leave type for period ${period}.`);
    this.name = "LeaveSalaryAlreadyExistsError";
  }
}

export class InsufficientLeaveBalanceError extends Error {
  constructor(public leaveTypeId: string, public available: number, public requested: number) {
    super(`Insufficient leave balance. Available: ${available} days, Requested: ${requested} days.`);
    this.name = "InsufficientLeaveBalanceError";
  }
}

export class LeaveTypeNotEncashableError extends Error {
  constructor(public leaveTypeId: string) {
    super("The selected leave type is not marked as encashable.");
    this.name = "LeaveTypeNotEncashableError";
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getLeaveSalaryHistory(filter?: {
  employeeId?: string;
  status?: LeaveSalaryRunStatus;
  period?: string;
}): Promise<LeaveSalaryRun[]> {
  return repository.findAllLeaveSalaryRuns(filter);
}

/**
 * Service-layer lookup for page data (BUG-4 / ARCH fix).
 * Pages must only call services — never import repositories directly.
 * Returns encashable leave types, employees, and fiscal years.
 */
export async function getLeaveSalaryLookupData() {
  const [employees, leaveTypes, fiscalYears] = await Promise.all([
    employeeRepository.findAll({ search: "", status: "Active", category: "all", branchId: "all", departmentId: "all" }),
    leaveRepository.findEncashableLeaveTypes(),
    fiscalYearRepository.findAllFiscalYears(),
  ]);
  return { employees, leaveTypes, fiscalYears };
}

/**
 * Get employee's leave balance for a specific leave type (for UI preview).
 */
export async function getEmployeeLeaveBalanceForEncashment(employeeId: string, leaveTypeId: string) {
  const balances = await leaveRepository.findLeaveBalancesByEmployee(employeeId);
  const leaveType = await leaveRepository.findLeaveTypeById(leaveTypeId);
  const targetBalance = balances.find(b => b.leaveTypeId === leaveTypeId);

  return {
    allotted: targetBalance?.allotted ?? 0,
    taken: targetBalance?.taken ?? 0,
    balance: targetBalance?.balance ?? 0,
    carriedForward: targetBalance?.carriedForward ?? 0,
    accumulationCap: leaveType?.accumulationCap ?? null,
    maxPaidDays: leaveType?.maxPaidDays ?? null,
    isEncashable: leaveType?.isEncashable ?? false,
  };
}

// ---------------------------------------------------------------------------
// Create Leave Salary
// ---------------------------------------------------------------------------

export async function createLeaveSalary(
  payload: LeaveSalarySetupPayload,
  userId: string
): Promise<LeaveSalaryRun> {
  const { employeeId, leaveTypeId, leaveDays, paymentPeriod, encashmentType, paymentMethod } = payload;

  // 1. Validate leave type is encashable (GAP-1)
  const leaveType = await leaveRepository.findLeaveTypeById(leaveTypeId);
  if (!leaveType || !leaveType.isEncashable) {
    throw new LeaveTypeNotEncashableError(leaveTypeId);
  }

  // 2. Verify duplicates — 3-column check: employee + leaveType + period (BUG-5 fix)
  const existing = await repository.findLeaveSalaryRunByEmployeeLeaveTypeAndPeriod({
    employeeId,
    leaveTypeId,
    paymentPeriod
  });
  if (existing) {
    throw new LeaveSalaryAlreadyExistsError(employeeId, leaveTypeId, paymentPeriod);
  }

  // 3. Check leave balance (GAP-2)
  const balances = await leaveRepository.findLeaveBalancesByEmployee(employeeId);
  const targetBalance = balances.find(b => b.leaveTypeId === leaveTypeId);
  if (!targetBalance || targetBalance.balance < leaveDays) {
    throw new InsufficientLeaveBalanceError(
      leaveTypeId,
      targetBalance?.balance ?? 0,
      leaveDays
    );
  }

  // 4. Validate against caps (GAP-3)
  const validationError = validateEncashmentRequest({
    leaveDays,
    availableBalance: targetBalance.balance,
    accumulationCap: leaveType.accumulationCap,
    maxPaidDays: leaveType.maxPaidDays,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  // 5. Load salary mapping
  const salaryMap = await salaryMappingRepository.findByEmployeeId(employeeId);
  if (!salaryMap) {
    throw new Error("Cannot compute leave salary: No active salary mapping found for this employee.");
  }

  // 6. Load leave rule for encashment rate (ARCH-2 / GAP-4 fix)
  const leaveRule = await leaveRuleRepository.findLeaveRuleByLeaveTypeId(leaveTypeId);
  const encashmentRate = (leaveRule?.encashmentRate ?? 'BASIC_DAILY') as EncashmentRate;
  const fixedDailyAmount = leaveRule?.encashmentFixedAmount ?? 0;

  // 7. Compute totals via engine (B5: gradeAmount removed, B6: encashmentRate wired)
  const result = calculateLeaveSalary({
    basicSalary: salaryMap.basicSalary.toString(),
    leaveDays,
    workingDays: 30,
    encashmentRate,
    fixedDailyAmount: encashmentRate === 'FIXED_AMOUNT' ? fixedDailyAmount : undefined,
  });

  // Calculate 15% standard Nepal TDS on leave encashment per Income Tax Act Sec 88
  const totalAmtDec = new Decimal(result.totalAmount);
  const tdsAmount = totalAmtDec.times(0.15).toDecimalPlaces(2).toString();

  // 8. Save
  const record = await repository.createLeaveSalaryRun({
    payrollRunId: null,
    employeeId,
    leaveTypeId,
    leaveDays: leaveDays.toString(),
    perDayRate: result.perDayRate,
    totalAmount: result.totalAmount,
    tdsAmount,
    encashmentType: encashmentType ?? 'VOLUNTARY',
    paymentPeriod,
    paymentMethod: paymentMethod ?? 'BANK_TRANSFER',
    status: 'DRAFT',
    createdBy: userId
  });

  // Log to audit trail
  await getDb().insert(auditLogs).values({
    userId,
    action: 'ADD',
    module: 'LEAVE_SALARY',
    recordId: record.id,
    result: 'SUCCESS',
    newValues: record,
  });

  return record;
}

// ---------------------------------------------------------------------------
// Update Draft Leave Salary
// ---------------------------------------------------------------------------

export async function updateLeaveSalaryDraft(
  id: string,
  data: {
    leaveDays: number;
    paymentPeriod: string;
    paymentMethod: PaymentMethod;
    encashmentType: EncashmentType;
  },
  userId: string
): Promise<LeaveSalaryRun> {
  const existing = await repository.findLeaveSalaryRunById(id);
  if (!existing) throw new Error("Leave salary record not found");
  if (existing.status !== 'DRAFT') {
    throw new Error("Only DRAFT records can be updated.");
  }

  // Check leave balance & caps
  const balances = await leaveRepository.findLeaveBalancesByEmployee(existing.employeeId);
  const targetBalance = balances.find(b => b.leaveTypeId === existing.leaveTypeId);
  if (!targetBalance || targetBalance.balance < data.leaveDays) {
    throw new InsufficientLeaveBalanceError(
      existing.leaveTypeId,
      targetBalance?.balance ?? 0,
      data.leaveDays
    );
  }

  const leaveType = await leaveRepository.findLeaveTypeById(existing.leaveTypeId);
  const validationError = validateEncashmentRequest({
    leaveDays: data.leaveDays,
    availableBalance: targetBalance.balance,
    accumulationCap: leaveType?.accumulationCap ?? null,
    maxPaidDays: leaveType?.maxPaidDays ?? null,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  // Recompute with salary mapping & rate rules
  const salaryMap = await salaryMappingRepository.findByEmployeeId(existing.employeeId);
  if (!salaryMap) {
    throw new Error("Cannot compute leave salary: No active salary mapping found.");
  }

  const leaveRule = await leaveRuleRepository.findLeaveRuleByLeaveTypeId(existing.leaveTypeId);
  const encashmentRate = (leaveRule?.encashmentRate ?? 'BASIC_DAILY') as EncashmentRate;
  const fixedDailyAmount = leaveRule?.encashmentFixedAmount ?? 0;

  const result = calculateLeaveSalary({
    basicSalary: salaryMap.basicSalary.toString(),
    leaveDays: data.leaveDays,
    workingDays: 30,
    encashmentRate,
    fixedDailyAmount: encashmentRate === 'FIXED_AMOUNT' ? fixedDailyAmount : undefined,
  });

  const updated = await repository.updateLeaveSalaryRunDraft(id, {
    leaveDays: data.leaveDays.toString(),
    perDayRate: result.perDayRate,
    totalAmount: result.totalAmount,
    paymentPeriod: data.paymentPeriod,
    paymentMethod: data.paymentMethod,
    encashmentType: data.encashmentType,
  });

  await getDb().insert(auditLogs).values({
    userId,
    action: 'EDIT',
    module: 'LEAVE_SALARY',
    recordId: id,
    result: 'SUCCESS',
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Pay (Mark as Paid) — with balance deduction (BUG-2 fix)
// ---------------------------------------------------------------------------

export async function payLeaveSalary(
  id: string,
  userId: string
): Promise<LeaveSalaryRun> {
  const record = await repository.findLeaveSalaryRunById(id);
  if (!record) throw new Error("Leave salary record not found");
  if (record.status === 'PAID') throw new Error("This record has already been paid.");

  // P1 FIX: Separation of duties — creator cannot be the payer
  if (record.createdBy === userId) {
    throw new Error(
      "Separation of duties violation: The person who created this leave salary record cannot be the same person who approves payment. Please have another authorized user approve this payment."
    );
  }

  // P0 FIX: Atomic transaction — status update + balance deduction must succeed together
  const updated = await getDb().transaction(async (tx) => {
    // 1. Re-verify balance inside transaction to prevent race conditions
    const balances = await leaveRepository.findLeaveBalancesByEmployee(record.employeeId);
    const targetBalance = balances.find(b => b.leaveTypeId === record.leaveTypeId);
    const encashedDays = Number(record.leaveDays);
    
    if (targetBalance && targetBalance.balance < encashedDays) {
      throw new InsufficientLeaveBalanceError(
        record.leaveTypeId,
        targetBalance.balance,
        encashedDays
      );
    }

    // 2. Mark as PAID inside transaction
    const result = await repository.updateLeaveSalaryRunStatus(id, 'PAID', userId, tx);

    // 3. Deduct from leave balance inside transaction
    if (targetBalance) {
      const newTaken = targetBalance.taken + encashedDays;
      const newBalance = Math.max(0, targetBalance.balance - encashedDays);
      await leaveRepository.updateLeaveBalance(targetBalance.id, newTaken, newBalance, tx);
    }

    // 4. Audit log inside transaction
    await tx.insert(auditLogs).values({
      userId,
      action: 'EDIT',
      module: 'LEAVE_SALARY',
      recordId: id,
      result: 'SUCCESS',
      oldValues: { status: record.status },
      newValues: { status: 'PAID' }
    });

    return result;
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Delete Draft (FEAT-3)
// ---------------------------------------------------------------------------

export async function deleteLeaveSalaryDraft(
  id: string,
  userId: string
): Promise<void> {
  const record = await repository.findLeaveSalaryRunById(id);
  if (!record) throw new Error("Leave salary record not found");
  if (record.status !== 'DRAFT') {
    throw new Error("Only DRAFT records can be deleted. PAID records cannot be removed.");
  }

  await repository.deleteLeaveSalaryRun(id);

  // Log to audit trail
  await getDb().insert(auditLogs).values({
    userId,
    action: 'DELETE',
    module: 'LEAVE_SALARY',
    recordId: id,
    result: 'SUCCESS',
    oldValues: record,
  });
}
