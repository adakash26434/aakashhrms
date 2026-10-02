"use client";

import type { LeaveBalanceRow } from "@/lib/types/report";
import { CheckCircle2, XCircle, Award, Eye, Printer, Download } from "lucide-react";

interface LeaveBalanceTableProps {
  rows: LeaveBalanceRow[];
  loading?: boolean;
  onSingleEmployeeAction?: (row: LeaveBalanceRow, action: "preview" | "print" | "export") => void;
}

export function LeaveBalanceTable({ rows, loading, onSingleEmployeeAction }: LeaveBalanceTableProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center border-b border-zinc-100">
        <div className="flex items-center space-x-2.5 text-zinc-500 text-xs font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <span>Loading leave balance ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border-b border-zinc-100 p-6 text-center">
        <div className="rounded-full bg-zinc-100 p-2.5 text-zinc-500">
          <Award className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-xs font-semibold text-zinc-900">No Leave Balances Found</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          No leave balance records match the selected fiscal year or filter parameters.
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
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3 min-w-36">Employee Name</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Position</th>
            <th className="px-4 py-3">Leave Category</th>
            <th className="px-4 py-3 text-center">Statutory</th>
            <th className="px-4 py-3 text-right">Allotted</th>
            <th className="px-4 py-3 text-right">Taken</th>
            <th className="px-4 py-3 text-right">Carried Fwd</th>
            <th className="px-4 py-3 text-right text-emerald-800">Balance</th>
            <th className="px-4 py-3 text-center">Encashable</th>
            {onSingleEmployeeAction && (
              <th className="px-4 py-3 text-center print:hidden min-w-24">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 text-xs">
          {rows.map((row, idx) => {
            const balanceNum = Number(row.balance);
            const isLowBalance = balanceNum <= 2;

            return (
              <tr
                key={`${row.employeeCode}-${row.leaveTypeCode}-${idx}`}
                className="hover:bg-zinc-50/60 transition-colors"
              >
                <td className="px-4 py-3.5 text-center font-medium text-zinc-400">{idx + 1}</td>
                <td className="px-4 py-3.5 font-mono text-2xs text-zinc-500">{row.employeeCode}</td>
                <td className="px-4 py-3.5 font-medium text-zinc-900">{row.employeeName}</td>
                <td className="px-4 py-3.5 text-zinc-600">{row.departmentName}</td>
                <td className="px-4 py-3.5 text-zinc-500">Staff</td>
                <td className="px-4 py-3.5">
                  <span className="font-medium text-zinc-900">{row.leaveTypeName}</span>
                  <span className="ml-1.5 rounded border border-zinc-200/70 bg-zinc-50 px-1.5 py-0.5 text-2xs font-mono text-zinc-600">
                    {row.leaveTypeCode}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {row.isStatutory ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Statutory
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      Custom
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-700">
                  {row.allotted}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-purple-700 font-medium">
                  {row.taken}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-500">
                  {row.carriedForward}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                  <span
                    className={`font-semibold ${
                      isLowBalance ? "text-amber-700" : "text-emerald-800"
                    }`}
                  >
                    {row.balance}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {row.isEncashable ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-800 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Encashable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-zinc-400 text-xs">
                      <XCircle className="h-3.5 w-3.5" />
                      No
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
                        title={`Preview leave balance for ${row.employeeName}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSingleEmployeeAction(row, "print")}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                        title={`Print leave balance for ${row.employeeName}`}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
