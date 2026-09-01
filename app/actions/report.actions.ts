'use server';

import { ensureTenantContext } from '@/lib/db';
import { checkPermission } from "@/lib/auth/check-permission";
import { auth } from "@/lib/auth";
import * as reportService from "@/lib/services/report.service";
import * as reportEngine from "@/lib/engines/report.engine";
import type {
  SalarySheetFilter,
  PayslipFilter,
  AttendanceReportFilter,
  TDSReportFilter,
  LeaveReportFilter,
  LoanReportFilter,
} from "@/lib/types/report";

/**
 * Fetch filter lookups for report page filter bars.
 */
export async function getReportFilterLookupDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "EMPLOYEES");
    const data = await reportService.getReportFilterLookupData();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load lookup data";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Salary Sheet report data.
 */
export async function getSalarySheetReportAction(filter: SalarySheetFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_SALARY_SHEET");
    const data = await reportService.getSalarySheetData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load salary sheet";
    return { success: false, error: msg };
  }
}

/**
 * Export Salary Sheet as CSV.
 */
export async function exportSalarySheetCsvAction(filter: SalarySheetFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_SALARY_SHEET");
    const reportData = await reportService.getSalarySheetData(filter);
    const csvString = reportEngine.buildSalarySheetCSV(
      reportData.rows,
      reportData.allAllowanceHeadNames,
      reportData.allDeductionHeadNames,
      reportData.summary
    );
    const filename = `salary-sheet-${reportData.run.label.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export salary sheet CSV";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Payslip Print data.
 */
export async function getPayslipReportAction(filter: PayslipFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_PAYSLIP");
    const data = await reportService.getPayslipPrintData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load payslip data";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Payslip Head Summary breakdown.
 */
export async function getPayslipHeadSummaryAction(filter: SalarySheetFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_PAYSLIP");
    const data = await reportService.getPayslipHeadSummaryData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load payslip head summary";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Attendance Report data.
 */
export async function getAttendanceReportAction(filter: AttendanceReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_ATTENDANCE");
    const data = await reportService.getAttendanceReportData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load attendance report";
    return { success: false, error: msg };
  }
}

/**
 * Export Attendance Report as CSV.
 */
export async function exportAttendanceCsvAction(filter: AttendanceReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_ATTENDANCE");
    const reportData = await reportService.getAttendanceReportData(filter);
    const csvString = reportEngine.buildAttendanceCSV(
      reportData.rows,
      reportData.monthLabel
    );
    const filename = `attendance-report-${reportData.monthLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export attendance CSV";
    return { success: false, error: msg };
  }
}

/**
 * Fetch TDS / IRD Report data.
 */
export async function getTDSReportAction(filter: TDSReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_TAX_IRD");
    const data = await reportService.getTDSReportData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load TDS/IRD report";
    return { success: false, error: msg };
  }
}

/**
 * Export TDS / IRD Report as CSV.
 */
export async function exportTDSCsvAction(filter: TDSReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_TAX_IRD");
    const reportData = await reportService.getTDSReportData(filter);
    const csvString = reportEngine.buildTDSIRDCSV(reportData.rows, reportData.period);
    const filename = `tds-ird-report-${reportData.period.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export TDS/IRD CSV";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Leave Report data.
 */
export async function getLeaveReportAction(filter: LeaveReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_LEAVE");
    const data = await reportService.getLeaveReportData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load leave report";
    return { success: false, error: msg };
  }
}

/**
 * Export Leave Balances CSV.
 */
export async function exportLeaveBalancesCsvAction(filter: LeaveReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_LEAVE");
    const reportData = await reportService.getLeaveReportData(filter);
    const csvString = reportEngine.buildLeaveBalancesCSV(reportData.balanceRows);
    const filename = `leave-balances-${reportData.fiscalYearLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export leave balances CSV";
    return { success: false, error: msg };
  }
}

/**
 * Export Leave Applications CSV.
 */
export async function exportLeaveApplicationsCsvAction(filter: LeaveReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_LEAVE");
    const reportData = await reportService.getLeaveReportData(filter);
    const csvString = reportEngine.buildLeaveApplicationsCSV(reportData.applicationRows);
    const filename = `leave-applications-${reportData.fiscalYearLabel.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export leave applications CSV";
    return { success: false, error: msg };
  }
}

/**
 * Fetch Loan Report data.
 */
export async function getLoanReportAction(filter: LoanReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("VIEW", "REPORTS_LOAN");
    const data = await reportService.getLoanReportData(filter);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load loan report";
    return { success: false, error: msg };
  }
}

/**
 * Export Loan Summary CSV.
 */
export async function exportLoanSummaryCsvAction(filter: LoanReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_LOAN");
    const reportData = await reportService.getLoanReportData(filter);
    const csvString = reportEngine.buildLoanSummaryCSV(reportData.summaryRows);
    const filename = `loan-summary-report.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export loan summary CSV";
    return { success: false, error: msg };
  }
}

/**
 * Export Loan Repayments Ledger CSV.
 */
export async function exportLoanRepaymentsCsvAction(filter: LoanReportFilter) {
  await ensureTenantContext();
  try {
    await checkPermission("EXPORT", "REPORTS_LOAN");
    const reportData = await reportService.getLoanReportData(filter);
    const csvString = reportEngine.buildLoanRepaymentsCSV(reportData.repaymentRows);
    const filename = `loan-repayment-ledger.csv`;
    return { success: true, data: csvString, filename };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to export loan repayments CSV";
    return { success: false, error: msg };
  }
}

