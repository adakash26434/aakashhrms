"use client";

import type {
  SalarySheetRow,
  AttendanceReportRow,
  TDSReportRow,
  LeaveBalanceRow,
  LoanSummaryRow,
  CompanyReportInfo,
} from "@/lib/types/report";
import { useWorkspaceContext } from "@/lib/contexts/workspace-context";

// ─── 1. Salary Sheet Individual Slips Printable ──────────────────────────────
interface SalarySheetIndividualSlipsProps {
  rows: SalarySheetRow[];
  periodLabel: string;
  company?: CompanyReportInfo;
}

export function SalarySheetIndividualSlips({
  rows,
  periodLabel,
  company,
}: SalarySheetIndividualSlipsProps) {
  const workspaceCtx = useWorkspaceContext();
  const activeCompany = company || workspaceCtx?.company;
  const companyLegalName =
    activeCompany?.legalName ||
    activeCompany?.displayName ||
    activeCompany?.name ||
    "OFFICIAL SALARY SLIP";

  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={row.employeeCode || idx}
          className="w-full max-w-4xl mx-auto bg-white p-8 border border-zinc-200 shadow-none page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b border-zinc-300 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                {companyLegalName} — Official Salary Slip
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Pay Period: <span className="font-semibold text-zinc-900">{periodLabel}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <span className="font-medium text-zinc-500 block">
                Confidential record
              </span>
              <p className="text-xs text-zinc-400 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Employee Details Grid: Clean 4-Column Flat Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Name
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.employeeName}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Code
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">
                {row.employeeCode}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Department
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.departmentName}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Position / Designation
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.designationName || "Staff"}
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Split Layout */}
          <div className="grid grid-cols-2 gap-12 text-xs mb-6 items-start">
            {/* Earnings Column */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Earnings & allowances
              </h3>
              <div className="space-y-0.5">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Basic Salary</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-900">
                    NPR {Number(row.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {Number(row.gradeAmount) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Grade Amount</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(row.otAmount) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Overtime (OT)</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {row.allowanceHeads?.map((h, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">{h.name}</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(h.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t border-zinc-200 pt-2.5 mt-2 text-zinc-900">
                  <span>Gross Earnings</span>
                  <span className="font-mono">
                    NPR {Number(row.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions Column */}
            <div className="border-l border-zinc-200/80 pl-12">
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Deductions
              </h3>
              <div className="space-y-0.5">
                {Number(row.absentDeduction) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Absent Deduction</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.absentDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(row.pfEmployee) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">PF Employee</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.pfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(row.tdsThisMonth) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">TDS Tax</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.tdsThisMonth).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(row.citDeduction) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">CIT Contribution</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.citDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(row.loanDeduction) > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">Loan Recovery</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(row.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {row.deductionHeads?.map((h, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-zinc-100">
                    <span className="text-zinc-600 font-medium">{h.name}</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-900">
                      NPR {Number(h.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t border-zinc-200 pt-2.5 mt-2 text-zinc-900">
                  <span>Total Deductions</span>
                  <span className="font-mono">
                    NPR {Number(row.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Payable Minimal Summary Callout */}
          <div className="py-6 my-6 border-t border-b border-zinc-300 text-center space-y-1">
            <span className="text-xs text-zinc-500 font-medium block">
              Net payable amount
            </span>
            <span className="text-3xl font-bold tracking-tight text-emerald-950 font-mono block">
              NPR{" "}
              {Number(row.netPayable).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-2xs text-zinc-400 font-normal block">
              Disbursement to {row.bankName || "Bank Transfer"} ({row.bankAccountNumberMasked || row.bankAccountNumberFull})
            </span>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-2xs text-gray-500 pt-6 border-t border-dashed border-gray-300">
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Employee Signature
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Prepared By (HR)
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Authorized Signature & Seal
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 2. Attendance Individual Slips Printable ─────────────────────────────
interface AttendanceIndividualSlipsProps {
  rows: AttendanceReportRow[];
  periodLabel: string;
}

export function AttendanceIndividualSlips({
  rows,
  periodLabel,
}: AttendanceIndividualSlipsProps) {
  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={row.employeeCode || idx}
          className="w-full max-w-4xl mx-auto bg-white p-8 border border-zinc-200 shadow-none page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b border-zinc-300 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                Attendance &amp; Overtime Ledger Statement
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Period: <span className="font-semibold text-zinc-900">{periodLabel}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <span className="font-medium text-zinc-500 block">
                Nepal Labour Act compliant
              </span>
              <p className="text-xs text-zinc-400 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Employee Details Grid: Clean 4-Column Flat Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Name
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.employeeName}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Code
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">
                {row.employeeCode}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Department
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.departmentName}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Position / Designation
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">
                {row.designationName || "Staff"}
              </span>
            </div>
          </div>

          {/* Attendance Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2 text-xs mb-6">
            <div className="py-2 px-3 sm:first:pl-0">
              <span className="text-2xs text-zinc-500 block font-medium">
                Working Days
              </span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">
                {row.totalWorkingDays}
              </span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">
                Present Days
              </span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">
                {row.presentDays}
              </span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">
                Paid Leave
              </span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">
                {row.payLeaveDays}
              </span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">
                Non-Pay Leave
              </span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">
                {row.nonPayLeaveDays}
              </span>
            </div>
            <div className="py-2 px-3 sm:last:pr-0">
              <span className="text-2xs text-zinc-500 block font-medium">
                Absent Days
              </span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">
                {row.absentDays}
              </span>
            </div>
          </div>

          {/* Overtime & Deduction Particulars */}
          <div className="grid grid-cols-2 gap-12 text-xs mb-8 items-start">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Overtime summary
              </h3>
              <div className="space-y-0.5">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Office OT Hours</span>
                  <span className="font-semibold text-zinc-900 font-mono">{row.totalOtHoursOffice} hrs</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Off-Day OT Hours</span>
                  <span className="font-semibold text-zinc-900 font-mono">{row.totalOtHoursOff} hrs</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-zinc-200 pt-2.5 text-zinc-900">
                  <span>OT Earned Amount</span>
                  <span className="font-mono">
                    NPR {Number(row.otEarnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-l border-zinc-200/80 pl-12">
              <h3 className="text-xs font-semibold text-zinc-900 pb-2 border-b border-zinc-300">
                Leave deduction details
              </h3>
              <div className="space-y-0.5">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Unpaid Days</span>
                  <span className="font-semibold text-zinc-900 font-mono">{Number(row.nonPayLeaveDays) + Number(row.absentDays)} days</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-zinc-200 pt-2.5 text-zinc-900">
                  <span>Leave Deduction Amount</span>
                  <span className="font-mono">
                    NPR {Number(row.leaveDeductionAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-2xs text-gray-500 pt-6 border-t border-dashed border-gray-300">
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Employee Signature
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              HR / Attendance Verifier
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Authorized Signature & Seal
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 3. TDS IRD Tax Individual Slips Printable ────────────────────────────
interface TDSIndividualSlipsProps {
  rows: TDSReportRow[];
  periodLabel: string;
}

export function TDSIndividualSlips({
  rows,
  periodLabel,
}: TDSIndividualSlipsProps) {
  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={row.employeeCode || idx}
          className="w-full max-w-4xl mx-auto bg-white p-8 border border-zinc-200 shadow-none page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b border-zinc-300 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                Government of Nepal IRD — e-TDS Tax Credit Certificate
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tax Period: <span className="font-semibold text-zinc-900">{periodLabel}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <span className="font-medium text-zinc-500 block">
                Income Tax Act compliant
              </span>
              <p className="text-xs text-zinc-400 font-mono">
                PAN: {row.panNumber || "N/A"}
              </p>
            </div>
          </div>

          {/* Particulars Grid: Clean 4-Column Flat Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
            <div>
              <span className="text-xs text-zinc-500 block">
                Tax Payer Name
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                PAN Number
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">
                {row.panNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Tax Status
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.taxStatus}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Code
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">{row.employeeCode}</span>
            </div>
          </div>

          {/* Tax Breakdown */}
          <div className="text-xs mb-8 space-y-2">
            <h3 className="font-semibold text-zinc-900 text-xs border-b border-zinc-300 pb-1.5">
              Taxable income &amp; deductions breakdown
            </h3>
            <div className="grid grid-cols-2 gap-12 pt-1 items-start">
              <div className="space-y-0.5">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Gross Income</span>
                  <span className="font-mono font-semibold text-zinc-900">NPR {Number(row.grossIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">PF Deduction (Retirement)</span>
                  <span className="font-mono font-semibold text-zinc-900">NPR {Number(row.pfDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">CIT Deduction</span>
                  <span className="font-mono font-semibold text-zinc-900">NPR {Number(row.citDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-0.5 border-l border-zinc-200/80 pl-12">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-600 font-medium">Taxable Net Income</span>
                  <span className="font-mono font-semibold text-zinc-900">NPR {Number(row.taxableIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-semibold text-zinc-900 pt-2.5 border-t border-zinc-200 text-xs">
                  <span>TDS Deducted & Remitted</span>
                  <span className="font-mono">NPR {Number(row.tdsDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-2xs text-gray-500 pt-6 border-t border-dashed border-gray-300">
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Tax Payer Signature
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Finance Accountant
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Withholding Agent Seal
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 4. Leave Ledger Individual Slips Printable ───────────────────────────
interface LeaveIndividualSlipsProps {
  rows: LeaveBalanceRow[];
  periodLabel: string;
}

export function LeaveIndividualSlips({
  rows,
  periodLabel,
}: LeaveIndividualSlipsProps) {
  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={`${row.employeeCode}-${idx}`}
          className="w-full max-w-4xl mx-auto bg-white p-8 border border-zinc-200 shadow-none page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b border-zinc-300 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                Annual Leave Ledger &amp; Balance Certificate
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Fiscal Year: <span className="font-semibold text-zinc-900">{periodLabel}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <span className="font-medium text-zinc-500 block">
                Employee leave record
              </span>
              <p className="text-xs text-zinc-400 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Particulars Grid: Clean 4-Column Flat Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Name
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Code
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">{row.employeeCode}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Department
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.departmentName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Leave Category
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.leaveTypeName}</span>
            </div>
          </div>

          {/* Balances Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2 text-xs mb-8">
            <div className="py-2 px-3 sm:first:pl-0">
              <span className="text-2xs text-zinc-500 block font-medium">Allotted</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">{row.allotted} days</span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">Taken</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">{row.taken} days</span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">Carried Forward</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">{row.carriedForward} days</span>
            </div>
            <div className="py-2 px-3 sm:last:pr-0">
              <span className="text-2xs text-zinc-500 block font-medium">Remaining Balance</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">{row.balance} days</span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-2xs text-gray-500 pt-6 border-t border-dashed border-gray-300">
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Employee Signature
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              HR Manager
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Authorized Stamp & Seal
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 5. Loan Ledger Individual Slips Printable ────────────────────────────
interface LoanIndividualSlipsProps {
  rows: LoanSummaryRow[];
  periodLabel: string;
}

export function LoanIndividualSlips({
  rows,
  periodLabel,
}: LoanIndividualSlipsProps) {
  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={row.loanId || idx}
          className="w-full max-w-4xl mx-auto bg-white p-8 border border-zinc-200 shadow-none page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b border-zinc-300 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">
                Staff Loan &amp; Repayment Account Statement
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Scope: <span className="font-semibold text-zinc-900">{periodLabel}</span>
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <span className="font-medium text-zinc-500 block">
                Loan account statement
              </span>
              <p className="text-xs text-zinc-400 font-mono">
                #{row.loanId ? row.loanId.slice(0, 8) : "N/A"}
              </p>
            </div>
          </div>

          {/* Particulars Grid: Clean 4-Column Flat Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-4 border-t border-b border-zinc-100 text-xs mb-6">
            <div>
              <span className="text-xs text-zinc-500 block">
                Borrower Name
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Employee Code
              </span>
              <span className="text-sm font-medium text-zinc-900 font-mono block mt-0.5">{row.employeeCode}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Department
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.departmentName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">
                Loan Category
              </span>
              <span className="text-sm font-medium text-zinc-900 block mt-0.5">{row.loanTypeName}</span>
            </div>
          </div>

          {/* Loan Principal & Recovery Summary Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2 text-xs mb-8">
            <div className="py-2 px-3 sm:first:pl-0">
              <span className="text-2xs text-zinc-500 block font-medium">Disbursed Amount</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">NPR {Number(row.loanAmount).toLocaleString()}</span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">Total Returned</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">NPR {Number(row.totalReturned).toLocaleString()}</span>
            </div>
            <div className="py-2 px-3">
              <span className="text-2xs text-zinc-500 block font-medium">Remaining Principal</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">NPR {Number(row.remainingAmount).toLocaleString()}</span>
            </div>
            <div className="py-2 px-3 sm:last:pr-0">
              <span className="text-2xs text-zinc-500 block font-medium">Monthly EMI</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-950 font-mono mt-0.5 block">NPR {Number(row.installmentAmount).toLocaleString()}</span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-2xs text-gray-500 pt-6 border-t border-dashed border-gray-300">
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Borrower Signature
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Loan Officer
            </div>
            <div>
              <div className="h-8 border-b border-gray-400 mb-1" />
              Authorized Stamp & Seal
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
