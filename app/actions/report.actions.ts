'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as reportService from '@/lib/services/report.service';

// Reports (4.11, S48): each report needs View on its own module and is built on the server
// within the viewer's employee scope; SELF-scoped roles are refused in the service (their own
// records are in self-service). Excel / CSV are made in the browser from the report on the
// page after authorizeExportAction (Export permission + audit) — never a second, wider query.

type ReportModule = 'REPORTS_SALARY_SHEET' | 'REPORTS_PAYSLIP' | 'REPORTS_ATTENDANCE' | 'REPORTS_LEAVE' | 'REPORTS_LOAN';

async function viewer(module: ReportModule): Promise<reportService.ReportCtx> {
  const scope = await checkPermissionWithScope('VIEW', module);
  return { userId: scope.userId, scope, canExport: await hasPermission('EXPORT', module) };
}

export async function salarySheetAction(params: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await viewer('REPORTS_SALARY_SHEET');
    return { success: true as const, data: await reportService.salarySheet(ctx, params) };
  } catch (error: unknown) {
    return toActionError(error, 'report.salary-sheet');
  }
}

export async function payslipReportAction(params: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await viewer('REPORTS_PAYSLIP');
    return { success: true as const, data: await reportService.payslipReport(ctx, params) };
  } catch (error: unknown) {
    return toActionError(error, 'report.payslips');
  }
}

export async function attendanceReportAction(params: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await viewer('REPORTS_ATTENDANCE');
    // OT pay and the absence deduction are pay: only for viewers who can see the salary sheet.
    const showAmounts = await hasPermission('VIEW', 'REPORTS_SALARY_SHEET');
    return { success: true as const, data: await reportService.attendanceReport(ctx, params, { showAmounts }) };
  } catch (error: unknown) {
    return toActionError(error, 'report.attendance');
  }
}

export async function leaveReportAction(params: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await viewer('REPORTS_LEAVE');
    return { success: true as const, data: await reportService.leaveReport(ctx, params) };
  } catch (error: unknown) {
    return toActionError(error, 'report.leave');
  }
}

export async function loanReportAction(params: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await viewer('REPORTS_LOAN');
    return { success: true as const, data: await reportService.loanReport(ctx, params) };
  } catch (error: unknown) {
    return toActionError(error, 'report.loan');
  }
}
