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
      <div className="flex h-48 items-center justify-center border-b border-zinc-100">
        <div className="flex items-center space-x-2.5 text-zinc-500 text-xs font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <span>Loading loan summary ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border-b border-zinc-100 p-6 text-center">
        <div className="rounded-full bg-zinc-100 p-2.5 text-zinc-500">
          <Banknote className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-xs font-semibold text-zinc-900">No Loans Found</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          No loan records match the selected filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr>
            <th className="px-4 py-3 text-center w-12">SN</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3 min-w-36">Employee Name</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Position</th>
            <th className="px-4 py-3">Loan Category</th>
            <th className="px-4 py-3">Disbursed Date</th>
            <th className="px-4 py-3 text-right">Disbursed Principal</th>
            <th className="px-4 py-3 text-right">Installment</th>
            <th className="px-4 py-3 text-center">Tenure</th>
            <th className="px-4 py-3 text-right font-medium text-emerald-800">Total Returned</th>
            <th className="px-4 py-3 text-right font-medium text-rose-700">Remaining Balance</th>
            <th className="px-4 py-3 text-center">Status</th>
            {onSingleEmployeeAction && (
              <th className="px-4 py-3 text-center print:hidden min-w-24">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-xs">
          {rows.map((row, idx) => (
            <tr key={row.loanId || idx} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-4 py-3.5 text-center font-medium text-zinc-400">{idx + 1}</td>
              <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-500">{row.employeeCode}</td>
              <td className="px-4 py-3.5 font-medium text-zinc-900">{row.employeeName}</td>
              <td className="px-4 py-3.5 text-zinc-600">{row.departmentName}</td>
              <td className="px-4 py-3.5 text-zinc-500">Staff</td>
              <td className="px-4 py-3.5 font-medium text-zinc-800">{row.loanTypeName}</td>
              <td className="px-4 py-3.5 font-mono text-zinc-600">{row.givenDate}</td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-zinc-900">
                NPR {Number(row.loanAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-600">
                NPR {Number(row.installmentAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3.5 text-center font-mono text-zinc-600">
                {row.noOfInstallments} mos
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-emerald-800">
                NPR {Number(row.totalReturned).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-rose-700">
                NPR {Number(row.remainingAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3.5 text-center">
                {row.status === "ACTIVE" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/50 bg-amber-50/70 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Clock className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" /> Closed
                  </span>
                )}
              </td>
              {onSingleEmployeeAction && (
                <td className="px-4 py-3.5 text-center print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSingleEmployeeAction(row, "preview")}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                      title={`Preview loan details for ${row.employeeName}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSingleEmployeeAction(row, "print")}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                      title={`Print loan statement for ${row.employeeName}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSingleEmployeeAction(row, "export")}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
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
  );
}
