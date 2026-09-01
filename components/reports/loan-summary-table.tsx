"use client";

import type { LoanSummaryRow } from "@/lib/types/report";
import { CheckCircle2, Clock, Banknote, Eye, Printer, Download } from "lucide-react";

interface LoanSummaryTableProps {
  rows: LoanSummaryRow[];
  loading?: boolean;
  onSingleEmployeeAction?: (row: LoanSummaryRow, action: "preview" | "print" | "export") => void;
}

export function LoanSummaryTable({ rows, loading, onSingleEmployeeAction }: LoanSummaryTableProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[#d7e8d0] bg-white">
        <div className="flex items-center space-x-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2e7d32] border-t-transparent" />
          <span className="text-sm font-medium text-[#1b3a1f]">Loading loan summary ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e8d0] bg-[#f6faf6] p-6 text-center">
        <div className="rounded-full bg-[#2e7d32]/10 p-3 text-[#2e7d32]">
          <Banknote className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-[#1b3a1f]">No Loans Found</h3>
        <p className="mt-1 text-xs text-gray-500">
          No loan records match the selected filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d7e8d0] bg-white shadow-payroll-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#d7e8d0] bg-[#f6faf6] text-[10px] font-bold uppercase tracking-wider text-gray-600">
              <th className="px-4 py-3 text-center">SN</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3 min-w-35">Employee Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Position / Designation</th>
              <th className="px-4 py-3">Loan Category</th>
              <th className="px-4 py-3">Disbursed Date</th>
              <th className="px-4 py-3 text-right">Disbursed Principal</th>
              <th className="px-4 py-3 text-right">Monthly Installment</th>
              <th className="px-4 py-3 text-center">Tenure</th>
              <th className="px-4 py-3 text-right font-bold text-emerald-800">Total Returned</th>
              <th className="px-4 py-3 text-right font-bold text-rose-800">Remaining Balance</th>
              <th className="px-4 py-3 text-center">Status</th>
              {onSingleEmployeeAction && (
                <th className="px-4 py-3 text-center print:hidden min-w-24">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d7e8d0]/60">
            {rows.map((row, idx) => (
              <tr key={row.loanId || idx} className="transition-colors hover:bg-[#f6faf6]/80">
                <td className="px-4 py-2.5 text-center font-medium text-gray-400">{idx + 1}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-gray-500">{row.employeeCode}</td>
                <td className="px-4 py-2.5 font-semibold text-[#1b3a1f]">{row.employeeName}</td>
                <td className="px-4 py-2.5 text-gray-600">{row.departmentName}</td>
                <td className="px-4 py-2.5 text-gray-600">Staff</td>
                <td className="px-4 py-2.5 font-semibold text-[#1b3a1f]">{row.loanTypeName}</td>
                <td className="px-4 py-2.5 font-mono text-gray-600">{row.givenDate}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-[#1b3a1f]">
                  NPR {Number(row.loanAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-700">
                  NPR {Number(row.installmentAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-gray-600">
                  {row.noOfInstallments} mos
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                  NPR {Number(row.totalReturned).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-700 border border-rose-200">
                    NPR {Number(row.remainingAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.status === "ACTIVE" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                      <Clock className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Closed
                    </span>
                  )}
                </td>
                {onSingleEmployeeAction && (
                  <td className="px-4 py-2.5 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "preview")}
                        className="p-1 rounded-md text-[#2e7d32] hover:bg-[#2e7d32]/10 transition-colors"
                        title={`Preview loan details for ${row.employeeName}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "print")}
                        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={`Print loan statement for ${row.employeeName}`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "export")}
                        className="p-1 rounded-md text-purple-600 hover:bg-purple-50 transition-colors"
                        title={`Export CSV for ${row.employeeName}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
