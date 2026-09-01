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
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="flex items-center space-x-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <span className="text-sm font-medium">Loading repayment transaction ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-200/80 bg-white p-6 text-center">
        <div className="rounded-full bg-green-50 p-3 text-green-600">
          <Receipt className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-gray-900">No Repayment Records</h3>
        <p className="mt-1 text-xs text-gray-500">
          No loan repayment transactions recorded for the selected filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-700">
              <th className="px-4 py-3 font-semibold">SN</th>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Loan Type</th>
              <th className="px-4 py-3 font-semibold">Repayment Date</th>
              <th className="px-4 py-3 font-semibold text-right text-emerald-700">Amount Paid</th>
              <th className="px-4 py-3 font-semibold text-center">Payment Method</th>
              <th className="px-4 py-3 font-semibold">Associated Payroll Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => (
              <tr key={row.repaymentId || idx} className="transition-colors hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-500">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-gray-900">{row.employeeName}</div>
                  <div className="text-[11px] font-mono text-gray-400">{row.employeeCode}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{row.departmentName}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{row.loanTypeName}</td>
                <td className="px-4 py-2.5 text-gray-600">{row.repaymentDate}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                  NPR {Number(row.amountPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {row.paymentMethod === "SALARY_DEDUCTION" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                      <CreditCard className="h-3.5 w-3.5" /> Salary Deduction
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <Banknote className="h-3.5 w-3.5" /> Direct Cash / Cheque
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-600">
                  {row.payrollRunLabel ? (
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-800">
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
    </div>
  );
}
