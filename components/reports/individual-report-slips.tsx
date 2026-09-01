"use client";

import type {
  SalarySheetRow,
  AttendanceReportRow,
  TDSReportRow,
  LeaveBalanceRow,
  LoanSummaryRow,
} from "@/lib/types/report";

// ─── 1. Salary Sheet Individual Slips Printable ──────────────────────────────
interface SalarySheetIndividualSlipsProps {
  rows: SalarySheetRow[];
  periodLabel: string;
}

export function SalarySheetIndividualSlips({
  rows,
  periodLabel,
}: SalarySheetIndividualSlipsProps) {
  return (
    <div className="space-y-8 print:space-y-0">
      {rows.map((row, idx) => (
        <div
          key={row.employeeCode || idx}
          className="w-full max-w-4xl mx-auto bg-white p-6 rounded-xl border border-[#d7e8d0] shadow-sm page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b-2 border-[#1b3a1f] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-[#1b3a1f] uppercase tracking-wider">
                AAKASHHRMS ENTERPRISE — OFFICIAL SALARY SLIP
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                Period: {periodLabel}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-[#1b3a1f] uppercase">
                CONFIDENTIAL RECORD
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Employee Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f6faf6] p-3 rounded-lg border border-[#d7e8d0] text-xs mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Employee Name
              </span>
              <span className="font-bold text-[#1b3a1f]">
                {row.employeeName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Code
              </span>
              <span className="font-mono font-bold text-[#1b3a1f]">
                {row.employeeCode}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Department
              </span>
              <span className="font-semibold text-[#1b3a1f]">
                {row.departmentName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Designation
              </span>
              <span className="font-semibold text-[#1b3a1f]">
                {row.designationName}
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Breakdown Table */}
          <div className="grid grid-cols-2 gap-4 text-xs mb-6">
            <div className="border border-[#d7e8d0] rounded-lg p-3">
              <h3 className="font-bold text-emerald-800 uppercase text-[11px] border-b border-[#d7e8d0] pb-1 mb-2">
                Earnings Summary
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Basic Salary:</span>
                  <span className="font-mono">
                    NPR {Number(row.basicSalary).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Grade Amount:</span>
                  <span className="font-mono">
                    NPR {Number(row.gradeAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OT Amount:</span>
                  <span className="font-mono">
                    NPR {Number(row.otAmount).toLocaleString()}
                  </span>
                </div>
                {row.allowanceHeads?.map((h, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{h.name}:</span>
                    <span className="font-mono">
                      NPR {Number(h.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t border-[#d7e8d0] pt-1 mt-2 text-emerald-800">
                  <span>Gross Earnings:</span>
                  <span className="font-mono">
                    NPR {Number(row.grossEarnings).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-[#d7e8d0] rounded-lg p-3">
              <h3 className="font-bold text-red-800 uppercase text-[11px] border-b border-[#d7e8d0] pb-1 mb-2">
                Deductions Summary
              </h3>
              <div className="space-y-1">
                {Number(row.absentDeduction) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Absent Deduction:</span>
                    <span className="font-mono">
                      NPR {Number(row.absentDeduction).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(row.pfEmployee) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PF Employee:</span>
                    <span className="font-mono">
                      NPR {Number(row.pfEmployee).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(row.tdsThisMonth) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">TDS Tax:</span>
                    <span className="font-mono">
                      NPR {Number(row.tdsThisMonth).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(row.citDeduction) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">CIT Contribution:</span>
                    <span className="font-mono">
                      NPR {Number(row.citDeduction).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(row.loanDeduction) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Recovery:</span>
                    <span className="font-mono">
                      NPR {Number(row.loanDeduction).toLocaleString()}
                    </span>
                  </div>
                )}
                {row.deductionHeads?.map((h, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">{h.name}:</span>
                    <span className="font-mono">
                      NPR {Number(h.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t border-[#d7e8d0] pt-1 mt-2 text-red-800">
                  <span>Total Deductions:</span>
                  <span className="font-mono">
                    NPR {Number(row.totalDeductions).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Payable & Bank Summary */}
          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs mb-8">
            <div>
              <span className="text-[10px] text-gray-500 block uppercase font-medium">
                Bank Transfer Details
              </span>
              <span className="font-bold text-[#1b3a1f]">
                {row.bankName || "Bank Transfer"} — {row.bankAccountNumberMasked || row.bankAccountNumberFull}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                NET PAYABLE AMOUNT
              </span>
              <span className="text-base font-black text-emerald-800 font-mono">
                NPR{" "}
                {Number(row.netPayable).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] text-gray-500 pt-6 border-t border-dashed border-gray-300">
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
          className="w-full max-w-4xl mx-auto bg-white p-6 rounded-xl border border-[#d7e8d0] shadow-sm page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b-2 border-[#1b3a1f] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-[#1b3a1f] uppercase tracking-wider">
                ATTENDANCE & OVERTIME LEDGER STATEMENT
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                Period: {periodLabel}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-[#1b3a1f] uppercase">
                NEPAL LABOUR ACT COMPLIANT
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Employee Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#f6faf6] p-3 rounded-lg border border-[#d7e8d0] text-xs mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Employee Name
              </span>
              <span className="font-bold text-[#1b3a1f]">
                {row.employeeName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Code
              </span>
              <span className="font-mono font-bold text-[#1b3a1f]">
                {row.employeeCode}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Department
              </span>
              <span className="font-semibold text-[#1b3a1f]">
                {row.departmentName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Position / Designation
              </span>
              <span className="font-semibold text-[#1b3a1f]">
                {row.designationName || "Staff"}
              </span>
            </div>
          </div>

          {/* Attendance Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs mb-6">
            <div className="p-3 border border-[#d7e8d0] rounded-lg bg-gray-50">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                Working Days
              </span>
              <span className="text-lg font-bold text-[#1b3a1f]">
                {row.totalWorkingDays}
              </span>
            </div>
            <div className="p-3 border border-emerald-200 rounded-lg bg-emerald-50">
              <span className="text-[10px] text-emerald-700 uppercase block font-bold">
                Present Days
              </span>
              <span className="text-lg font-bold text-emerald-700">
                {row.presentDays}
              </span>
            </div>
            <div className="p-3 border border-green-200 rounded-lg bg-green-50">
              <span className="text-[10px] text-green-700 uppercase block font-bold">
                Paid Leave
              </span>
              <span className="text-lg font-bold text-green-700">
                {row.payLeaveDays}
              </span>
            </div>
            <div className="p-3 border border-amber-200 rounded-lg bg-amber-50">
              <span className="text-[10px] text-amber-700 uppercase block font-bold">
                Non-Pay Leave
              </span>
              <span className="text-lg font-bold text-amber-700">
                {row.nonPayLeaveDays}
              </span>
            </div>
            <div className="p-3 border border-red-200 rounded-lg bg-red-50">
              <span className="text-[10px] text-red-700 uppercase block font-bold">
                Absent Days
              </span>
              <span className="text-lg font-bold text-red-700">
                {row.absentDays}
              </span>
            </div>
          </div>

          {/* Overtime & Deduction Particulars */}
          <div className="grid grid-cols-2 gap-4 text-xs mb-8">
            <div className="border border-[#d7e8d0] rounded-lg p-3 bg-emerald-50/40">
              <h3 className="font-bold text-emerald-800 uppercase text-[11px] border-b border-[#d7e8d0] pb-1 mb-2">
                Overtime Summary
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Office OT Hours:</span>
                  <span className="font-semibold">{row.totalOtHoursOffice} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Off-Day OT Hours:</span>
                  <span className="font-semibold">{row.totalOtHoursOff} hrs</span>
                </div>
                <div className="flex justify-between font-bold border-t border-[#d7e8d0] pt-1 text-emerald-800">
                  <span>OT Earned Amount:</span>
                  <span className="font-mono">
                    NPR {Number(row.otEarnedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-[#d7e8d0] rounded-lg p-3 bg-red-50/40">
              <h3 className="font-bold text-red-800 uppercase text-[11px] border-b border-[#d7e8d0] pb-1 mb-2">
                Leave Deduction Details
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Unpaid Days:</span>
                  <span className="font-semibold">{Number(row.nonPayLeaveDays) + Number(row.absentDays)} days</span>
                </div>
                <div className="flex justify-between font-bold border-t border-[#d7e8d0] pt-1 text-red-800">
                  <span>Leave Deduction Amount:</span>
                  <span className="font-mono">
                    NPR {Number(row.leaveDeductionAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] text-gray-500 pt-6 border-t border-dashed border-gray-300">
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
          className="w-full max-w-4xl mx-auto bg-white p-6 rounded-xl border border-[#d7e8d0] shadow-sm page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b-2 border-[#1b3a1f] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-[#1b3a1f] uppercase tracking-wider">
                GOVERNMENT OF NEPAL IRD — e-TDS TAX CREDIT CERTIFICATE
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                Tax Period: {periodLabel}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-[#1b3a1f] uppercase">
                INCOME TAX ACT COMPLIANT
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                PAN: {row.panNumber || "N/A"}
              </p>
            </div>
          </div>

          {/* Particulars Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f6faf6] p-3 rounded-lg border border-[#d7e8d0] text-xs mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Tax Payer Name
              </span>
              <span className="font-bold text-[#1b3a1f]">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                PAN Number
              </span>
              <span className="font-mono font-bold text-emerald-800">
                {row.panNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Tax Status
              </span>
              <span className="font-semibold text-[#1b3a1f]">{row.taxStatus}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Employee Code
              </span>
              <span className="font-mono font-semibold text-[#1b3a1f]">{row.employeeCode}</span>
            </div>
          </div>

          {/* Tax Breakdown Table */}
          <div className="border border-[#d7e8d0] rounded-lg p-4 text-xs mb-8 space-y-2 bg-white">
            <h3 className="font-bold text-[#1b3a1f] uppercase text-[11px] border-b pb-1">
              Taxable Income & Deductions Breakdown
            </h3>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Income:</span>
                  <span className="font-mono font-semibold">NPR {Number(row.grossIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PF Deduction (Retirement):</span>
                  <span className="font-mono">NPR {Number(row.pfDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CIT Deduction:</span>
                  <span className="font-mono">NPR {Number(row.citDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5 border-l border-[#d7e8d0] pl-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxable Net Income:</span>
                  <span className="font-mono font-semibold text-[#1b3a1f]">NPR {Number(row.taxableIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-red-700 pt-2 border-t text-sm">
                  <span>TDS Deducted & Remitted:</span>
                  <span className="font-mono">NPR {Number(row.tdsDeducted).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] text-gray-500 pt-6 border-t border-dashed border-gray-300">
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
          className="w-full max-w-4xl mx-auto bg-white p-6 rounded-xl border border-[#d7e8d0] shadow-sm page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b-2 border-[#1b3a1f] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-[#1b3a1f] uppercase tracking-wider">
                ANNUAL LEAVE LEDGER & BALANCE CERTIFICATE
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                Fiscal Year: {periodLabel}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-[#1b3a1f] uppercase">
                EMPLOYEE LEAVE RECORD
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                Code: {row.employeeCode}
              </p>
            </div>
          </div>

          {/* Particulars Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f6faf6] p-3 rounded-lg border border-[#d7e8d0] text-xs mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Employee Name
              </span>
              <span className="font-bold text-[#1b3a1f]">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Code
              </span>
              <span className="font-mono font-bold text-[#1b3a1f]">{row.employeeCode}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Department
              </span>
              <span className="font-semibold text-[#1b3a1f]">{row.departmentName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Leave Category
              </span>
              <span className="font-bold text-[#2e7d32]">{row.leaveTypeName}</span>
            </div>
          </div>

          {/* Balances Card */}
          <div className="grid grid-cols-4 gap-3 text-center text-xs mb-8">
            <div className="p-3 border border-[#d7e8d0] rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Allotted</span>
              <span className="text-base font-bold text-gray-800">{row.allotted} days</span>
            </div>
            <div className="p-3 border border-purple-200 rounded-lg bg-purple-50">
              <span className="text-[10px] text-purple-700 uppercase block font-bold">Taken</span>
              <span className="text-base font-bold text-purple-700">{row.taken} days</span>
            </div>
            <div className="p-3 border border-green-200 rounded-lg bg-green-50">
              <span className="text-[10px] text-green-700 uppercase block font-bold">Carried Fwd</span>
              <span className="text-base font-bold text-green-700">{row.carriedForward} days</span>
            </div>
            <div className="p-3 border border-green-200 rounded-lg bg-green-50">
              <span className="text-[10px] text-green-700 uppercase block font-bold">Remaining Balance</span>
              <span className="text-base font-black text-green-700">{row.balance} days</span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] text-gray-500 pt-6 border-t border-dashed border-gray-300">
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
          className="w-full max-w-4xl mx-auto bg-white p-6 rounded-xl border border-[#d7e8d0] shadow-sm page-break-after-always print-page-break print:p-0 print:border-none print:shadow-none mb-8 print:mb-0"
          style={{ pageBreakAfter: "always", breakAfter: "page" }}
        >
          {/* Header */}
          <div className="border-b-2 border-[#1b3a1f] pb-3 mb-4 flex justify-between items-start">
            <div>
              <h2 className="text-base font-black text-[#1b3a1f] uppercase tracking-wider">
                STAFF LOAN & REPAYMENT ACCOUNT STATEMENT
              </h2>
              <p className="text-xs text-gray-500 font-semibold">
                Scope: {periodLabel}
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="font-bold text-[#1b3a1f] uppercase">
                LOAN ACCOUNT STATEMENT
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                Loan ID: #{row.loanId ? row.loanId.slice(0, 8) : "N/A"}
              </p>
            </div>
          </div>

          {/* Particulars Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f6faf6] p-3 rounded-lg border border-[#d7e8d0] text-xs mb-4">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Borrower Name
              </span>
              <span className="font-bold text-[#1b3a1f]">{row.employeeName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Employee Code
              </span>
              <span className="font-mono font-bold text-[#1b3a1f]">{row.employeeCode}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Department
              </span>
              <span className="font-semibold text-[#1b3a1f]">{row.departmentName}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-medium block">
                Loan Category
              </span>
              <span className="font-bold text-[#2e7d32]">{row.loanTypeName}</span>
            </div>
          </div>

          {/* Loan Principal & Recovery Summary Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs mb-8">
            <div className="p-3 border border-[#d7e8d0] rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Disbursed Amount</span>
              <span className="text-base font-bold text-[#1b3a1f]">NPR {Number(row.loanAmount).toLocaleString()}</span>
            </div>
            <div className="p-3 border border-emerald-200 rounded-lg bg-emerald-50">
              <span className="text-[10px] text-emerald-700 uppercase block font-bold">Total Returned</span>
              <span className="text-base font-bold text-emerald-700">NPR {Number(row.totalReturned).toLocaleString()}</span>
            </div>
            <div className="p-3 border border-rose-200 rounded-lg bg-rose-50">
              <span className="text-[10px] text-rose-700 uppercase block font-bold">Remaining Principal</span>
              <span className="text-base font-black text-rose-700">NPR {Number(row.remainingAmount).toLocaleString()}</span>
            </div>
            <div className="p-3 border border-[#d7e8d0] rounded-lg">
              <span className="text-[10px] text-gray-500 uppercase block font-semibold">Monthly EMI</span>
              <span className="text-base font-bold text-[#1b3a1f]">NPR {Number(row.installmentAmount).toLocaleString()}</span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-3 gap-8 text-center text-[10px] text-gray-500 pt-6 border-t border-dashed border-gray-300">
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
