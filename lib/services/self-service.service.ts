// SECURITY: this is a plain server module, not a 'use server' file. Clients
// reach it only through app/actions/self-service.actions.ts or server pages.
import { runLabel } from '@/lib/engines/pay-calendar.engine';
import { getDbAsync } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  users,
  employees, employeePersonal, employeeFamily, employeeBank,
  payrollSlips, payrollSlipHeads, payrollRuns,
  leaveApplications, employeeLeaveBalances, leaveTypes,
  leaveOtCalculations,
  loans, loanRepayments, loanTypes,
  fiscalYears, departments, designations, branches,
} from '@/lib/db/schema';
import { eq, and, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import * as leaveService from '@/lib/services/leave.service';
import * as homeLeaveService from '@/lib/services/home-leave.service';
import { assertSessionUsable } from '@/lib/auth/session-updates';
import { findPhotoIdFor } from "@/lib/repositories/employee-photo.repository";

// ---------------------------------------------------------------------------
// Session-Based Employee ID Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the current authenticated user's employeeId from the session.
 * This is the single source of truth for self-service data scoping.
 * NEVER trusts client-supplied parameters for employee identity.
 */
export async function getSessionEmployeeId(): Promise<{ employeeId: string; userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not authenticated');
  }
  assertSessionUsable(session.user);

  // S8: re-check the account on every call instead of trusting the JWT. A
  // deactivated or re-linked user loses access immediately.
  const db = await getDbAsync(session.user.tenantSlug);
  const [account] = await db
    .select({ isActive: users.isActive, employeeId: users.employeeId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!account || !account.isActive) {
    throw new Error('Unauthorized: User account is inactive or disabled');
  }

  if (!account.employeeId) {
    throw new Error('Self-Service unavailable: Your user account is not linked to an employee record. Please contact your HR administrator.');
  }

  return { employeeId: account.employeeId, userId: session.user.id };
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
      fullName: employees.fullName,
      gender: employees.gender,
      dateOfBirth: employees.dateOfBirth,
      taxStatus: employees.taxStatus,
      isDisabled: employees.isDisabled,
      category: employees.category,
      shreni: employees.shreni,
      joiningDate: employees.joiningDate,
      confirmationDate: employees.confirmationDate,
      status: employees.status,
      gradeAmount: employees.gradeAmount,
      isSupervisor: employees.isSupervisor,
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

  // Photo (4.2b): shown from /api/employees/photos/<id>, which lets an employee see their own.
  const photoId = await findPhotoIdFor(employeeId).catch(() => null);

  return { ...profileResult, bankDetails, photoId };
}

// ---------------------------------------------------------------------------
// My Payslips
// ---------------------------------------------------------------------------

/** F3: the conditions that make a payslip visible to its employee (see `slipVisibleToEmployee`). */
function visibleToEmployee() {
  return [eq(payrollRuns.status, 'LOCKED'), isNotNull(payrollRuns.publishedAt), isNull(payrollSlips.heldAt)];
}

export async function getMyPayslips(fiscalYearId?: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // F3: only payslips of locked, published runs, and not one held back (before this, any
  // payslip in any status — drafts included — was visible in the portal).
  const conditions = [eq(payrollSlips.employeeId, employeeId), ...visibleToEmployee()];

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
      pfEmployer: payrollSlips.pfEmployer,
      ssfEmployee: payrollSlips.ssfEmployee,
      ssfEmployer: payrollSlips.ssfEmployer,
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
      calendar: payrollRuns.calendar,
      runType: payrollRuns.runType,
    })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    // Only paid months reach the employee (4.8b): a draft or a run under review is not a payslip yet.
    .where(and(...conditions, eq(payrollRuns.status, 'LOCKED')))
    .orderBy(desc(payrollRuns.payPeriodYear), desc(payrollRuns.payPeriodMonth), desc(payrollRuns.lockedAt));

  return slips.map((s) => ({ ...s, label: runLabel(s) }));
}

export async function getMyPayslipDetail(payslipId: string) {
  const { employeeId } = await getSessionEmployeeId();
  const db = await getDbAsync();

  // Verify the payslip belongs to this employee, and that the employee may see it (locked, published, not held: visibleToEmployee)
  const [row] = await db
    .select({ slip: payrollSlips, run: { calendar: payrollRuns.calendar, runType: payrollRuns.runType, payPeriodYear: payrollRuns.payPeriodYear, payPeriodMonth: payrollRuns.payPeriodMonth, status: payrollRuns.status } })
    .from(payrollSlips)
    .innerJoin(payrollRuns, eq(payrollSlips.payrollRunId, payrollRuns.id))
    .where(and(eq(payrollSlips.id, payslipId), eq(payrollSlips.employeeId, employeeId), ...visibleToEmployee()))
    .limit(1);

  if (!row) {
    throw new Error('Payslip not found or you do not have access to view it.');
  }
  const slip = { ...row.slip, payPeriodYear: row.run.payPeriodYear, payPeriodMonth: row.run.payPeriodMonth, label: runLabel(row.run), runType: row.run.runType };

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

// 4.6: balances come from the leave ledger and requests go through the leave
// service, which counts the days on the server (the browser's count is never used).

export async function getMyLeaveBalances() {
  const { employeeId } = await getSessionEmployeeId();
  return leaveService.myBalances(employeeId);
}

/** The employee's own home leave this year, month by month (the employee comes from the session). */
export async function getMyHomeLeave() {
  const { employeeId } = await getSessionEmployeeId();
  return homeLeaveService.homeLeaveFor(employeeId, "checked");
}

export async function getMyLeaveTypes() {
  const { employeeId } = await getSessionEmployeeId();
  return leaveService.myRequestableTypes(employeeId);
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
      half: leaveApplications.half,
      noOfDays: leaveApplications.noOfDays,
      unpaidDays: leaveApplications.unpaidDays,
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

export async function previewMyLeave(input: unknown) {
  const { employeeId } = await getSessionEmployeeId();
  return leaveService.previewOwn(input, employeeId);
}

export async function applyForLeave(input: unknown) {
  const { employeeId, userId } = await getSessionEmployeeId();
  return leaveService.createRequest(input, { userId, source: 'self_service', selfEmployeeId: employeeId });
}

export async function withdrawMyLeave(id: string) {
  const { employeeId, userId } = await getSessionEmployeeId();
  await leaveService.withdrawOwn(id, employeeId, userId);
  return { id, employeeId };
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
      fullName: employees.fullName,
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
