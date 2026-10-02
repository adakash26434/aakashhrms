"use client";

import type { LoanRepaymentLedgerRow } from "@/lib/types/report";
import { Receipt, Banknote, CreditCard } from "lucide-react";

interface LoanRepaymentTableProps {
  rows: LoanRepaymentLedgerRow[];
  loading?: boolean;
}

export function LoanRepaymentTable({ rows, loading }: LoanRepaymentTableProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center border-b border-zinc-100">
        <div className="flex items-center space-x-2.5 text-zinc-500 text-xs font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <span>Loading repayment transaction ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border-b border-zinc-100 p-6 text-center">
        <div className="rounded-full bg-zinc-100 p-2.5 text-zinc-500">
          <Receipt className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-xs font-semibold text-zinc-900">No Repayment Records</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          No loan repayment transactions recorded for the selected filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
          <tr>
            <th className="px-4 py-3 text-center w-12">SN</th>
            <th className="px-4 py-3 min-w-36">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Loan Type</th>
            <th className="px-4 py-3">Repayment Date</th>
            <th className="px-4 py-3 text-right">Amount Paid</th>
            <th className="px-4 py-3 text-center">Payment Method</th>
            <th className="px-4 py-3">Associated Payroll Batch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-xs">
          {rows.map((row, idx) => (
            <tr key={row.repaymentId || idx} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-4 py-3.5 text-center font-medium text-zinc-400">{idx + 1}</td>
              <td className="px-4 py-3.5">
                <div className="font-medium text-zinc-900">{row.employeeName}</div>
                <div className="text-2xs font-mono text-zinc-400">{row.employeeCode}</div>
              </td>
              <td className="px-4 py-3.5 text-zinc-600">{row.departmentName}</td>
              <td className="px-4 py-3.5 font-medium text-zinc-800">{row.loanTypeName}</td>
              <td className="px-4 py-3.5 text-zinc-600 font-mono">{row.repaymentDate}</td>
              <td className="px-4 py-3.5 text-right font-medium text-emerald-800 font-mono tabular-nums">
                NPR {Number(row.amountPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3.5 text-center">
                {row.paymentMethod === "SALARY_DEDUCTION" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <CreditCard className="h-3 w-3" /> Salary Deduction
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-teal-200/50 bg-teal-50/70 px-2 py-0.5 text-xs font-medium text-teal-800">
                    <Banknote className="h-3 w-3" /> Direct Cash / Cheque
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-zinc-600">
                {row.payrollRunLabel ? (
                  <span className="rounded border border-zinc-200/70 bg-zinc-50 px-2 py-0.5 font-mono text-2xs font-medium text-zinc-700">
                    {row.payrollRunLabel}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
