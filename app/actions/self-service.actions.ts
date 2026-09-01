'use server';

import { ensureTenantContext } from '@/lib/db';
import * as selfService from '@/lib/services/self-service.service';

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

export async function getMyLeaveBalancesAction(fiscalYearId?: string): Promise<ActionResponse<Awaited<ReturnType<typeof selfService.getMyLeaveBalances>>>> {
  try {
    await ensureTenantContext();
    const data = await selfService.getMyLeaveBalances(fiscalYearId);
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
