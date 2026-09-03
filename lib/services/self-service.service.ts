'use server';

import { getDbAsync } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  employees, employeePersonal, employeeFamily, employeeBank,
  payrollSlips, payrollSlipHeads, payrollRuns,
  leaveApplications, employeeLeaveBalances, leaveTypes,
  leaveOtCalculations,
  loans, loanRepayments, loanTypes,
  fiscalYears, departments, designations, branches,
} from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { calculateProRataLeaveDays } from '@/lib/engines/leave-type.engine';

// ---------------------------------------------------------------------------
// Session-Based Employee ID Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the current authenticated user's employeeId from the session.
 * This is the single source of truth for self-service data scoping.
 * NEVER trusts client-supplied parameters for employee identity.
 */
async function getSessionEmployeeId(): Promise<{ employeeId: string; userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not authenticated');
  }

  const employeeId = session.user.employeeId;
  if (!employeeId) {
    throw new Error('Self-Service unavailable: Your user account is not linked to an employee record. Please contact your HR administrator.');
  }

  return { employeeId, userId: session.user.id };
}

// ---------------------------------------------------------------------------
// My Profile
// ---------------------------------------------------------------------------

export async function getMyProfile() {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  const [profileResult] = await db
    .select({
      // Employee core
      id: employees.id,
      employeeCode: employees.employeeCode,
      attendanceCode: employees.attendanceCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      gender: employees.gender,
      dateOfBirth: employees.dateOfBirth,
      taxStatus: employees.taxStatus,
      isDisabled: employees.isDisabled,
      category: employees.category,
      shreni: employees.shreni,
      joiningDate: employees.joiningDate,
      confirmationDate: employees.confirmationDate,
      status: employees.status,
      salaryGrade: employees.salaryGrade,
      // Org
      departmentName: departments.name,
      designationName: designations.name,
      branchName: branches.name,
      // Personal
      citizenshipNo: employeePersonal.citizenshipNo,
      panNumber: employeePersonal.panNumber,
      mobileNo: employeePersonal.mobileNo,
      email: employeePersonal.email,
      companyEmail: employeePersonal.companyEmail,
      personalEmail: employeePersonal.personalEmail,
      permanentAddress: employeePersonal.permanentAddress,
      temporaryAddress: employeePersonal.temporaryAddress,
      // Family
      fatherName: employeeFamily.fatherName,
      motherName: employeeFamily.motherName,
      spouseName: employeeFamily.spouseName,
      grandfatherName: employeeFamily.grandfatherName,
    })
    .from(employees)
    .leftJoin(employeePersonal, eq(employees.id, employeePersonal.employeeId))
    .leftJoin(employeeFamily, eq(employees.id, employeeFamily.employeeId))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!profileResult) {
    throw new Error('Employee profile not found.');
  }

  // Get bank details
  const bankDetails = await db
    .select()
    .from(employeeBank)
    .where(eq(employeeBank.employeeId, employeeId));

  return { ...profileResult, bankDetails };
}

// ---------------------------------------------------------------------------
// My Payslips
// ---------------------------------------------------------------------------

export async function getMyPayslips(fiscalYearId?: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  const conditions = [eq(payrollSlips.employeeId, employeeId)];

  if (fiscalYearId) {
    conditions.push(eq(payrollRuns.fiscalYearId, fiscalYearId));
  }

  const slips = await db
    .select({
      id: payrollSlips.id,
      payrollRunId: payrollSlips.payrollRunId,
      employeeCode: payrollSlips.employeeCode,
      employeeName: payrollSlips.employeeName,
      departmentName: payrollSlips.departmentName,
      designationName: payrollSlips.designationName,
      basicSalary: payrollSlips.basicSalary,
      gradeAmount: payrollSlips.gradeAmount,
      grossEarnings: payrollSlips.grossEarnings,
      totalDeductions: payrollSlips.totalDeductions,
      netPayable: payrollSlips.netPayable,
      tdsThisMonth: payrollSlips.tdsThisMonth,
      pfEmployee: payrollSlips.pfEmployee,
      ssfEmployee: payrollSlips.ssfEmployee,
      citDeduction: payrollSlips.citDeduction,
      loanDeduction: payrollSlips.loanDeduction,
      otAmount: payrollSlips.otAmount,
      payslipMonth: payrollSlips.payslipMonth,
      payslipDate: payrollSlips.payslipDate,
      status: payrollSlips.status,
      bankAccountNumber: payrollSlips.bankAccountNumber,
      bankName: payrollSlips.bankName,
      createdAt: payrollSlips.createdAt,
      // From payroll run
      payPeriodMonth: payrollRuns.payPeriodMonth,
      payPeriodYear: payrollRuns.payPeriodYear,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(...conditions))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth));

  return slips;
}

export async function getMyPayslipDetail(payslipId: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Verify the payslip belongs to this employee
  const [slip] = await db
    .select()
    .from(payrollSlips)
    .where(and(eq(payrollSlips.id, payslipId), eq(payrollSlips.employeeId, employeeId)))
    .limit(1);

  if (!slip) {
    throw new Error('Payslip not found or you do not have access to view it.');
  }

  // Get payslip heads (allowances & deductions breakdown)
  const heads = await db
    .select()
    .from(payrollSlipHeads)
    .where(eq(payrollSlipHeads.payrollSlipId, payslipId));

  return { slip, heads };
}

// ---------------------------------------------------------------------------
// My Leave
// ---------------------------------------------------------------------------

export async function getMyLeaveBalances(fiscalYearId?: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Get active fiscal year if not provided
  let activeFyRecord;
  if (fiscalYearId) {
    const [fy] = await db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.id, fiscalYearId))
      .limit(1);
    activeFyRecord = fy;
  } else {
    const [fy] = await db
      .select()
      .from(fiscalYears)
      .where(eq(fiscalYears.status, 'Active'))
      .limit(1);
    activeFyRecord = fy;
  }

  if (!activeFyRecord) {
    return { balances: [], fiscalYearId: undefined };
  }

  const fyId = activeFyRecord.id;

  const [emp] = await db
    .select({ joiningDate: employees.joiningDate })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  const rawBalances = await db
    .select({
      id: employeeLeaveBalances.id,
      leaveTypeId: employeeLeaveBalances.leaveTypeId,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
      leavePayType: leaveTypes.leaveType,
      statutoryCode: leaveTypes.statutoryCode,
      noOfDays: leaveTypes.noOfDays,
      proRataForNewJoinees: leaveTypes.proRataForNewJoinees,
      allotted: employeeLeaveBalances.allotted,
      taken: employeeLeaveBalances.taken,
      carriedForward: employeeLeaveBalances.carriedForward,
      balance: employeeLeaveBalances.balance,
    })
    .from(employeeLeaveBalances)
    .innerJoin(leaveTypes, eq(employeeLeaveBalances.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.fiscalYearId, fyId)
      )
    );

  // Self-heal any under-allotted balances caused by previous 1-month pro-rata bug
  if (emp && rawBalances.length > 0) {
    const fyStart = new Date(activeFyRecord.startDateAD);
    const fyEnd = new Date(activeFyRecord.endDateAD);
    const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : fyStart;

    for (const b of rawBalances) {
      const isEventBased =
        ['MOURNING', 'PATERNITY', 'MATERNITY'].includes(b.leaveTypeCode.toUpperCase()) ||
        ['MOURNING', 'PATERNITY', 'MATERNITY'].includes(b.statutoryCode?.toUpperCase() || '');

      let correctAllotted = Number(b.noOfDays);
      if (!isEventBased && b.proRataForNewJoinees && joinDate > fyStart) {
        correctAllotted = calculateProRataLeaveDays(Number(b.noOfDays), joinDate, fyStart, fyEnd);
      }

      const currentAllotted = Number(b.allotted);
      const currentTaken = Number(b.taken);
      const currentCarried = Number(b.carriedForward);

      // If existing balance was under-allocated due to the 1-month bug, heal it to the true entitlement
      if (currentAllotted < correctAllotted && currentTaken === 0) {
        const newBalance = correctAllotted + currentCarried;
        await db
          .update(employeeLeaveBalances)
          .set({
            allotted: correctAllotted.toString(),
            balance: newBalance.toString(),
          })
          .where(eq(employeeLeaveBalances.id, b.id));

        b.allotted = correctAllotted.toString();
        b.balance = newBalance.toString();
      }
    }
  }

  const balances = rawBalances.map((b) => ({
    id: b.id,
    leaveTypeId: b.leaveTypeId,
    leaveTypeName: b.leaveTypeName,
    leaveTypeCode: b.leaveTypeCode,
    leavePayType: b.leavePayType,
    allotted: b.allotted,
    taken: b.taken,
    carriedForward: b.carriedForward,
    balance: b.balance,
  }));

  return { balances, fiscalYearId: fyId };
}

export async function getMyLeaveApplications() {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  const applications = await db
    .select({
      id: leaveApplications.id,
      leaveTypeName: leaveTypes.name,
      leaveTypeCode: leaveTypes.code,
      appliedDate: leaveApplications.appliedDate,
      effectiveFrom: leaveApplications.effectiveFrom,
      effectiveTo: leaveApplications.effectiveTo,
      duration: leaveApplications.duration,
      noOfDays: leaveApplications.noOfDays,
      reason: leaveApplications.reason,
      status: leaveApplications.status,
      reviewRemarks: leaveApplications.reviewRemarks,
      reviewedAt: leaveApplications.reviewedAt,
      createdAt: leaveApplications.createdAt,
    })
    .from(leaveApplications)
    .innerJoin(leaveTypes, eq(leaveApplications.leaveTypeId, leaveTypes.id))
    .where(eq(leaveApplications.employeeId, employeeId))
    .orderBy(desc(leaveApplications.createdAt));

  return applications;
}

export async function applyForLeave(data: {
  leaveTypeId: string;
  effectiveFrom: string;
  effectiveTo: string;
  duration: "Full Day" | "Half Day";
  noOfDays: number;
  reason: string;
}) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Find active fiscal year
  const [activeFy] = await db
    .select({ id: fiscalYears.id })
    .from(fiscalYears)
    .where(eq(fiscalYears.status, 'Active'))
    .limit(1);

  if (!activeFy?.id) {
    throw new Error('No active fiscal year configured. Please contact HR.');
  }

  // Validate leave balance if allotted
  const [balanceRow] = await db
    .select({ balance: employeeLeaveBalances.balance })
    .from(employeeLeaveBalances)
    .where(
      and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.leaveTypeId, data.leaveTypeId),
        eq(employeeLeaveBalances.fiscalYearId, activeFy.id)
      )
    )
    .limit(1);

  if (balanceRow && Number(balanceRow.balance) < data.noOfDays) {
    throw new Error(`Insufficient leave balance. You have ${balanceRow.balance} days remaining.`);
  }

  const [created] = await db
    .insert(leaveApplications)
    .values({
      employeeId,
      leaveTypeId: data.leaveTypeId,
      fiscalYearId: activeFy.id,
      appliedDate: new Date().toISOString().split('T')[0],
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
      duration: data.duration,
      noOfDays: data.noOfDays.toString(),
      reason: data.reason.trim(),
      status: 'Pending',
    })
    .returning();

  return created;
}

// ---------------------------------------------------------------------------
// My Attendance
// ---------------------------------------------------------------------------

export async function getMyAttendanceSummary(fiscalYearId?: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  let fyId = fiscalYearId;
  if (!fyId) {
    const [activeFy] = await db
      .select({ id: fiscalYears.id })
      .from(fiscalYears)
      .where(eq(fiscalYears.status, 'Active'))
      .limit(1);
    fyId = activeFy?.id;
  }

  if (!fyId) {
    return [];
  }

  const summaries = await db
    .select()
    .from(leaveOtCalculations)
    .where(
      and(
        eq(leaveOtCalculations.employeeId, employeeId),
        eq(leaveOtCalculations.fiscalYearId, fyId)
      )
    )
    .orderBy(leaveOtCalculations.bsMonth);

  return summaries;
}

// ---------------------------------------------------------------------------
// My Loans
// ---------------------------------------------------------------------------

export async function getMyLoans() {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  const myLoans = await db
    .select({
      id: loans.id,
      loanTypeName: loanTypes.name,
      givenDate: loans.givenDate,
      loanAmount: loans.loanAmount,
      installmentAmount: loans.installmentAmount,
      noOfInstallments: loans.noOfInstallments,
      totalReturned: loans.totalReturned,
      remainingAmount: loans.remainingAmount,
      status: loans.status,
      createdAt: loans.createdAt,
    })
    .from(loans)
    .innerJoin(loanTypes, eq(loans.loanTypeId, loanTypes.id))
    .where(eq(loans.employeeId, employeeId))
    .orderBy(desc(loans.createdAt));

  return myLoans;
}

export async function getMyLoanRepayments(loanId: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Verify the loan belongs to this employee
  const [loan] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.employeeId, employeeId)))
    .limit(1);

  if (!loan) {
    throw new Error('Loan not found or you do not have access to view it.');
  }

  const repayments = await db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, loanId))
    .orderBy(desc(loanRepayments.repaymentDate));

  return repayments;
}

// ---------------------------------------------------------------------------
// Self-Service Dashboard Summary
// ---------------------------------------------------------------------------

export async function getSelfServiceDashboard() {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Get active fiscal year
  const [activeFy] = await db
    .select({ id: fiscalYears.id, label: fiscalYears.label })
    .from(fiscalYears)
    .where(eq(fiscalYears.status, 'Active'))
    .limit(1);

  // Run all dashboard queries in parallel
  const [
    employeeInfo,
    latestPayslip,
    leaveBalancesResult,
    pendingLeaves,
    activeLoansResult,
  ] = await Promise.all([
    // Basic employee info
    db.select({
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeCode: employees.employeeCode,
      departmentName: departments.name,
      designationName: designations.name,
      branchName: branches.name,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .where(eq(employees.id, employeeId))
    .limit(1),

    // Latest payslip
    db.select({
      netPayable: payrollSlips.netPayable,
      payslipMonth: payrollSlips.payslipMonth,
      payslipDate: payrollSlips.payslipDate,
      payPeriodMonth: payrollRuns.payPeriodMonth,
      payPeriodYear: payrollRuns.payPeriodYear,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(eq(payrollSlips.employeeId, employeeId))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth))
    .limit(1),

    // Total leave balance
    activeFy?.id
      ? db.select({
          totalBalance: sql<string>`COALESCE(SUM(${employeeLeaveBalances.balance}::numeric), 0)`,
          totalAllotted: sql<string>`COALESCE(SUM(${employeeLeaveBalances.allotted}::numeric), 0)`,
          totalTaken: sql<string>`COALESCE(SUM(${employeeLeaveBalances.taken}::numeric), 0)`,
        })
        .from(employeeLeaveBalances)
        .where(
          and(
            eq(employeeLeaveBalances.employeeId, employeeId),
            eq(employeeLeaveBalances.fiscalYearId, activeFy.id)
          )
        )
      : Promise.resolve([{ totalBalance: '0', totalAllotted: '0', totalTaken: '0' }]),

    // Pending leave applications
    db.select({ count: sql<number>`count(*)::int` })
      .from(leaveApplications)
      .where(
        and(
          eq(leaveApplications.employeeId, employeeId),
          eq(leaveApplications.status, 'Pending')
        )
      ),

    // Active loans count + total remaining
    db.select({
      count: sql<number>`count(*)::int`,
      totalRemaining: sql<string>`COALESCE(SUM(${loans.remainingAmount}::numeric), 0)`,
    })
    .from(loans)
    .where(
      and(
        eq(loans.employeeId, employeeId),
        eq(loans.status, 'ACTIVE')
      )
    ),
  ]);

  return {
    employee: employeeInfo[0] || null,
    activeFiscalYear: activeFy || null,
    latestPayslip: latestPayslip[0] || null,
    leaveBalance: {
      totalBalance: Number(leaveBalancesResult[0]?.totalBalance || 0),
      totalAllotted: Number(leaveBalancesResult[0]?.totalAllotted || 0),
      totalTaken: Number(leaveBalancesResult[0]?.totalTaken || 0),
    },
    pendingLeaveCount: Number(pendingLeaves[0]?.count || 0),
    activeLoans: {
      count: Number(activeLoansResult[0]?.count || 0),
      totalRemaining: Number(activeLoansResult[0]?.totalRemaining || 0),
    },
  };
}
