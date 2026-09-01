import Decimal from "decimal.js";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import type {
  SalarySheetRow,
  SalarySheetSummary,
  TDSReportRow,
  AttendanceReportRow,
  LeaveBalanceRow,
  LeaveApplicationReportRow,
  LoanSummaryRow,
  LoanRepaymentLedgerRow,
} from "@/lib/types/report";

/**
 * 1. Aggregate salary sheet summary totals from rows using decimal.js
 */
export function aggregateSalarySheetSummary(
  rows: SalarySheetRow[]
): SalarySheetSummary {
  let gross = new Decimal(0);
  let deductions = new Decimal(0);
  let net = new Decimal(0);
  let tds = new Decimal(0);
  let pf = new Decimal(0);
  let ssf = new Decimal(0);
  let cit = new Decimal(0);
  let loan = new Decimal(0);

  for (const r of rows) {
    gross = gross.plus(r.grossEarnings || 0);
    deductions = deductions.plus(r.totalDeductions || 0);
    net = net.plus(r.netPayable || 0);
    tds = tds.plus(r.tdsThisMonth || 0);
    pf = pf.plus(r.pfEmployee || 0);
    ssf = ssf.plus(r.ssfEmployee || 0);
    cit = cit.plus(r.citDeduction || 0);
    loan = loan.plus(r.loanDeduction || 0);
  }

  return {
    totalEmployees: rows.length,
    totalGrossEarnings: gross.toFixed(2),
    totalDeductions: deductions.toFixed(2),
    totalNetPayable: net.toFixed(2),
    totalTds: tds.toFixed(2),
    totalPf: pf.toFixed(2),
    totalSsf: ssf.toFixed(2),
    totalCit: cit.toFixed(2),
    totalLoanDeductions: loan.toFixed(2),
  };
}

/**
 * 2. Mask bank account number — show only last 4 digits: "****2345"
 */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber || !accountNumber.trim()) return "N/A";
  const clean = accountNumber.trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return "*".repeat(Math.min(clean.length - 4, 8)) + last4;
}

/**
 * 3. Format BS month + year label (e.g. 8, 2081 -> "Mangsir 2081")
 */
export function formatBSMonthLabel(bsMonth: number, bsYear: number): string {
  const monthName = BS_MONTHS_EN[bsMonth] || `Month ${bsMonth}`;
  return `${monthName} ${bsYear}`;
}

/**
 * Helper to escape CSV cell value and prevent CSV Formula Injection
 */
function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize formula injection: if cell starts with formula trigger characters, prefix a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 4. Build salary sheet CSV string
 */
export function buildSalarySheetCSV(
  rows: SalarySheetRow[],
  allAllowanceHeadNames: string[],
  allDeductionHeadNames: string[],
  summary: SalarySheetSummary
): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Designation",
    "Basic Salary",
    "Grade Amount",
    "OT Amount",
    ...allAllowanceHeadNames,
    "Gross Earnings",
    "Absent Deduction",
    "PF (Employee)",
    "SSF (Employee)",
    "CIT",
    "TDS (Tax)",
    "Loan Deduction",
    ...allDeductionHeadNames,
    "Total Deductions",
    "Net Payable",
    "Bank Name",
    "Bank Account Number",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((row, idx) => {
    // Map dynamic allowance amounts
    const allowMap = new Map(row.allowanceHeads.map((h) => [h.name, h.amount]));
    const allowValues = allAllowanceHeadNames.map(
      (name) => allowMap.get(name) || "0.00"
    );

    // Map dynamic deduction amounts
    const dedMap = new Map(row.deductionHeads.map((h) => [h.name, h.amount]));
    const dedValues = allDeductionHeadNames.map(
      (name) => dedMap.get(name) || "0.00"
    );

    const line = [
      idx + 1,
      row.employeeCode,
      row.employeeName,
      row.departmentName,
      row.designationName,
      row.basicSalary,
      row.gradeAmount,
      row.otAmount,
      ...allowValues,
      row.grossEarnings,
      row.absentDeduction,
      row.pfEmployee,
      row.ssfEmployee,
      row.citDeduction,
      row.tdsThisMonth,
      row.loanDeduction,
      ...dedValues,
      row.totalDeductions,
      row.netPayable,
      row.bankName,
      row.bankAccountNumberFull, // Full account number for CSV export
    ];

    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  // Add Summary Total Row
  const summaryLine = [
    "TOTAL",
    "",
    `Total Employees: ${summary.totalEmployees}`,
    "",
    "",
    "",
    "",
    "",
    ...allAllowanceHeadNames.map(() => ""),
    summary.totalGrossEarnings,
    "",
    summary.totalPf,
    summary.totalSsf,
    summary.totalCit,
    summary.totalTds,
    summary.totalLoanDeductions,
    ...allDeductionHeadNames.map(() => ""),
    summary.totalDeductions,
    summary.totalNetPayable,
    "",
    "",
  ];
  csvRows.push(summaryLine.map(escapeCsvCell).join(","));

  return csvRows.join("\n");
}

/**
 * 5. Build TDS / IRD CSV string (IRD-compatible format)
 */
export function buildTDSIRDCSV(rows: TDSReportRow[], period: string): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "PAN Number",
    "Tax Status",
    "Period",
    "Gross Income",
    "PF Deducted",
    "CIT Deducted",
    "Taxable Income",
    "TDS Deducted",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((row, idx) => {
    const line = [
      idx + 1,
      row.employeeCode,
      row.employeeName,
      row.panNumber || "N/A",
      row.taxStatus,
      row.period || period,
      row.grossIncome,
      row.pfDeducted,
      row.citDeducted,
      row.taxableIncome,
      row.tdsDeducted,
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  // Calculate totals for CSV summary
  let totalGross = new Decimal(0);
  let totalPf = new Decimal(0);
  let totalCit = new Decimal(0);
  let totalTaxable = new Decimal(0);
  let totalTds = new Decimal(0);

  for (const r of rows) {
    totalGross = totalGross.plus(r.grossIncome || 0);
    totalPf = totalPf.plus(r.pfDeducted || 0);
    totalCit = totalCit.plus(r.citDeducted || 0);
    totalTaxable = totalTaxable.plus(r.taxableIncome || 0);
    totalTds = totalTds.plus(r.tdsDeducted || 0);
  }

  const summaryLine = [
    "TOTAL",
    "",
    `Employees: ${rows.length}`,
    "",
    "",
    "",
    totalGross.toFixed(2),
    totalPf.toFixed(2),
    totalCit.toFixed(2),
    totalTaxable.toFixed(2),
    totalTds.toFixed(2),
  ];
  csvRows.push(summaryLine.map(escapeCsvCell).join(","));

  return csvRows.join("\n");
}

/**
 * 6. Build attendance report CSV string
 */
export function buildAttendanceCSV(
  rows: AttendanceReportRow[],
  monthLabel: string
): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Total Working Days",
    "Present Days",
    "Pay Leave Days",
    "Non-Pay Leave Days",
    "Absent Days",
    "Office OT Hours",
    "Off-Day OT Hours",
    "OT Earned Amount",
    "Leave Deduction Amount",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((row, idx) => {
    const line = [
      idx + 1,
      row.employeeCode,
      row.employeeName,
      row.departmentName,
      row.totalWorkingDays,
      row.presentDays,
      row.payLeaveDays,
      row.nonPayLeaveDays,
      row.absentDays,
      row.totalOtHoursOffice,
      row.totalOtHoursOff,
      row.otEarnedAmount,
      row.leaveDeductionAmount,
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  return csvRows.join("\n");
}

/**
 * 7. Sum an array of decimal strings safely using Decimal.js
 */
export function sumDecimalStrings(values: (string | number | null | undefined)[]): string {
  let total = new Decimal(0);
  for (const v of values) {
    if (v !== null && v !== undefined && v !== "") {
      total = total.plus(v);
    }
  }
  return total.toFixed(2);
}

/**
 * 8. Build Leave Balances CSV string
 */
export function buildLeaveBalancesCSV(rows: LeaveBalanceRow[]): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Leave Type",
    "Code",
    "Statutory",
    "Allotted",
    "Taken",
    "Carried Forward",
    "Current Balance",
    "Encashable",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((r, idx) => {
    const line = [
      idx + 1,
      r.employeeCode,
      r.employeeName,
      r.departmentName,
      r.leaveTypeName,
      r.leaveTypeCode,
      r.isStatutory ? "Yes" : "No",
      r.allotted,
      r.taken,
      r.carriedForward,
      r.balance,
      r.isEncashable ? "Yes" : "No",
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  return csvRows.join("\n");
}

/**
 * 9. Build Leave Applications CSV string
 */
export function buildLeaveApplicationsCSV(rows: LeaveApplicationReportRow[]): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Leave Type",
    "Applied Date",
    "Effective From",
    "Effective To",
    "Duration",
    "Days",
    "Reason",
    "Status",
    "Reviewed By",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((r, idx) => {
    const line = [
      idx + 1,
      r.employeeCode,
      r.employeeName,
      r.departmentName,
      r.leaveTypeName,
      r.appliedDate,
      r.effectiveFrom,
      r.effectiveTo,
      r.duration,
      r.noOfDays,
      r.reason,
      r.status,
      r.reviewedBy || "—",
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  return csvRows.join("\n");
}

/**
 * 10. Build Loan Summary CSV string
 */
export function buildLoanSummaryCSV(rows: LoanSummaryRow[]): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Loan Type",
    "Given Date",
    "Disbursed Amount",
    "Monthly Installment",
    "No of Installments",
    "Total Returned",
    "Remaining Balance",
    "Status",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((r, idx) => {
    const line = [
      idx + 1,
      r.employeeCode,
      r.employeeName,
      r.departmentName,
      r.loanTypeName,
      r.givenDate,
      r.loanAmount,
      r.installmentAmount,
      r.noOfInstallments,
      r.totalReturned,
      r.remainingAmount,
      r.status,
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  return csvRows.join("\n");
}

/**
 * 11. Build Loan Repayments Ledger CSV string
 */
export function buildLoanRepaymentsCSV(rows: LoanRepaymentLedgerRow[]): string {
  const headers = [
    "SN",
    "Employee Code",
    "Employee Name",
    "Department",
    "Loan Type",
    "Repayment Date",
    "Amount Paid",
    "Payment Method",
    "Payroll Batch",
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(",")];

  rows.forEach((r, idx) => {
    const line = [
      idx + 1,
      r.employeeCode,
      r.employeeName,
      r.departmentName,
      r.loanTypeName,
      r.repaymentDate,
      r.amountPaid,
      r.paymentMethod,
      r.payrollRunLabel || "N/A",
    ];
    csvRows.push(line.map(escapeCsvCell).join(","));
  });

  return csvRows.join("\n");
}

