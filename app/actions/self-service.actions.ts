'use server';

import { ensureTenantContext } from '@/lib/db';
import * as selfService from '@/lib/services/self-service.service';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/services/audit.service';
import { LeaveValidationError } from '@/lib/services/leave.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import type { LeavePreview } from '@/lib/types/leave';

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getSelfServiceDashboardAction(): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getSelfServiceDashboard>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getSelfServiceDashboard();
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_DASHBOARD] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load dashboard';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// My Profile
// ---------------------------------------------------------------------------

export async function getMyProfileAction(): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyProfile>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyProfile();
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_PROFILE] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load profile';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// My Payslips
// ---------------------------------------------------------------------------

export async function getMyPayslipsAction(fiscalYearId?: string): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyPayslips>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyPayslips(fiscalYearId);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_PAYSLIPS] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load payslips';
    return { success: false, error: msg };
  }
}

export async function getMyPayslipDetailAction(payslipId: string): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyPayslipDetail>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyPayslipDetail(payslipId);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_PAYSLIP_DETAIL] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load payslip detail';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// My Leave
// ---------------------------------------------------------------------------

export async function getMyLeaveBalancesAction(): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyLeaveBalances>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyLeaveBalances();
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_LEAVE_BALANCES] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load leave balances';
    return { success: false, error: msg };
  }
}

export async function getMyLeaveApplicationsAction(): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyLeaveApplications>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyLeaveApplications();
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_LEAVE_APPLICATIONS] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load leave applications';
    return { success: false, error: msg };
  }
}

/** The server's count for a request (days counted / skipped, pay, balance, problems). */
export async function previewMyLeaveAction(input: unknown): Promise<{ success: true; data: LeavePreview } | { success: false; error: string }> {
  try {
    await ensureTenantContext();
    return { success: true, data: await selfService.previewMyLeave(input) };
  } catch (error: unknown) {
    if (error instanceof LeaveValidationError) return { success: false, error: Object.values(error.errors)[0] ?? 'Check the request.' };
    return toActionError(error, 'self-service.leavePreview');
  }
}

/** S24: the employee comes from the session and the server counts the days. */
export async function applyForLeaveAction(input: unknown): Promise<{ success: true } | { success: false; error: string; validationErrors?: Record<string, string> }> {
  try {
    await ensureTenantContext();
    const r = await selfService.applyForLeave(input);
    await recordAuditLog({ userId: (await selfService.getSessionEmployeeId()).userId, action: 'ADD', module: 'LEAVE_APPLICATIONS', recordId: r.id, result: 'SUCCESS', newValues: { selfService: true, days: r.days } });
    revalidatePath('/self-service/my-leave');
    revalidatePath('/timeAndLeave/leaves');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof LeaveValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
    return toActionError(error, 'self-service.applyLeave');
  }
}

/** Withdraw your own waiting request. */
export async function withdrawMyLeaveAction(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await ensureTenantContext();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new UserFacingError('That leave request was not found.');
    await selfService.withdrawMyLeave(id);
    await recordAuditLog({ userId: (await selfService.getSessionEmployeeId()).userId, action: 'EDIT', module: 'LEAVE_APPLICATIONS', recordId: id, result: 'SUCCESS', newValues: { withdrawn: true, selfService: true } });
    revalidatePath('/self-service/my-leave');
    revalidatePath('/timeAndLeave/leaves');
    return { success: true };
  } catch (error: unknown) {
    return toActionError(error, 'self-service.withdrawLeave');
  }
}

// ---------------------------------------------------------------------------
// My Attendance
// ---------------------------------------------------------------------------

export async function getMyAttendanceSummaryAction(fiscalYearId?: string): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyAttendanceSummary>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyAttendanceSummary(fiscalYearId);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_ATTENDANCE] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load attendance';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// My Loans
// ---------------------------------------------------------------------------

export async function getMyLoansAction(): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyLoans>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyLoans();
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_LOANS] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load loans';
    return { success: false, error: msg };
  }
}

export async function getMyLoanRepaymentsAction(loanId: string): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyLoanRepayments>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyLoanRepayments(loanId);
    return { success: true, data };
  } catch (error: unknown) {
    console.error('[SELF_SERVICE_LOAN_REPAYMENTS] Failed:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load loan repayments';
    return { success: false, error: msg };
  }
}
