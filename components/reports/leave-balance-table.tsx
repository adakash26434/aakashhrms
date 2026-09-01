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
      <div className="flex h-64 items-center justify-center rounded-xl border border-[#d7e8d0] bg-white">
        <div className="flex items-center space-x-3 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2e7d32] border-t-transparent" />
          <span className="text-sm font-medium text-[#1b3a1f]">Loading leave balance ledger...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e8d0] bg-[#f6faf6] p-6 text-center">
        <div className="rounded-full bg-[#2e7d32]/10 p-3 text-[#2e7d32]">
          <Award className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-[#1b3a1f]">No Leave Balances Found</h3>
        <p className="mt-1 text-xs text-gray-500">
          No leave balance records match the selected fiscal year or filter parameters.
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
              <th className="px-4 py-3">Leave Category</th>
              <th className="px-4 py-3 text-center">Statutory</th>
              <th className="px-4 py-3 text-right">Allotted</th>
              <th className="px-4 py-3 text-right">Taken</th>
              <th className="px-4 py-3 text-right">Carried Fwd</th>
              <th className="px-4 py-3 text-right font-bold text-[#2e7d32]">Balance</th>
              <th className="px-4 py-3 text-center">Encashable</th>
              {onSingleEmployeeAction && (
                <th className="px-4 py-3 text-center print:hidden min-w-24">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d7e8d0]/60">
            {rows.map((row, idx) => {
              const balanceNum = Number(row.balance);
              const isLowBalance = balanceNum <= 2;

              return (
                <tr
                  key={`${row.employeeCode}-${row.leaveTypeCode}-${idx}`}
                  className="transition-colors hover:bg-[#f6faf6]/80"
                >
                  <td className="px-4 py-2.5 text-center font-medium text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-gray-500">{row.employeeCode}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#1b3a1f]">{row.employeeName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.departmentName}</td>
                  <td className="px-4 py-2.5 text-gray-600">Staff</td>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-[#1b3a1f]">{row.leaveTypeName}</span>
                    <span className="ml-1.5 rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">
                      {row.leaveTypeCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.isStatutory ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Statutory
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#d7e8d0]/60 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-gray-700">
                    {row.allotted}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-purple-700 font-semibold">
                    {row.taken}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-600">
                    {row.carriedForward}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    <span
                      className={`font-bold ${
                        isLowBalance ? "text-amber-700" : "text-[#2e7d32]"
                      }`}
                    >
                      {row.balance}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.isEncashable ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Encashable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-[11px]">
                        <XCircle className="h-3.5 w-3.5" />
                        No
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
                          title={`Preview leave balance for ${row.employeeName}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSingleEmployeeAction(row, "print")}
                          className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title={`Print leave balance for ${row.employeeName}`}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
