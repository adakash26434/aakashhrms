"use client";

import React from "react";
import type { LeaveBalanceRow } from "@/lib/types/report";
import { Users, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmployeeLeaveSummary {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName?: string;
  totalAllotted: number;
  totalTaken: number;
  totalCarriedForward: number;
  totalBalance: number;
  encashableCount: number;
  items: LeaveBalanceRow[];
}

interface EmployeeLeaveBalanceSummaryTableProps {
  summaries: EmployeeLeaveSummary[];
  loading?: boolean;
  onViewDetails: (summary: EmployeeLeaveSummary) => void;
}

export function EmployeeLeaveBalanceSummaryTable({
  summaries,
  loading,
  onViewDetails,
}: EmployeeLeaveBalanceSummaryTableProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-200">
        <div className="flex items-center space-x-3 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span className="text-sm font-medium text-zinc-700">Loading employee summaries...</span>
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 p-6 text-center">
        <div className="rounded-full bg-zinc-100 p-3 text-zinc-600">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-zinc-900">No Employees Found</h3>
        <p className="mt-1 text-xs text-zinc-500">
          No employee leave records match the selected filter parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3 text-center w-12">SN</th>
            <th className="px-4 py-3 w-28">Emp Code</th>
            <th className="px-4 py-3 min-w-44">Employee Name</th>
            <th className="px-4 py-3 min-w-36">Department</th>
            <th className="px-4 py-3 min-w-28">Position</th>
            <th className="px-4 py-3 text-right">Allotted</th>
            <th className="px-4 py-3 text-right">Taken</th>
            <th className="px-4 py-3 text-right">Carried Fwd</th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-900">Total Balance</th>
            <th className="px-4 py-3 text-center">Encashable</th>
            <th className="px-4 py-3 text-center print:hidden w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {summaries.map((s, idx) => {
            // Extract initials for clean visual avatar
            const initials = s.employeeName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "E";

            return (
              <tr
                key={s.employeeCode}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
              >
                <td className="px-4 py-4 text-center font-medium text-zinc-400">
                  {idx + 1}
                </td>
                <td className="px-4 py-4 font-mono text-[11px] text-zinc-500">
                  {s.employeeCode}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-200/50 bg-emerald-50/70 font-semibold text-emerald-800 text-[10px]">
                      {initials}
                    </div>
                    <span className="font-medium text-zinc-900">
                      {s.employeeName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {s.departmentName || "—"}
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {s.designationName || "Staff"}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-zinc-700">
                  {s.totalAllotted.toFixed(1)}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-zinc-700">
                  {s.totalTaken.toFixed(1)}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-zinc-700">
                  {s.totalCarriedForward.toFixed(1)}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums font-semibold text-zinc-900">
                  {s.totalBalance.toFixed(1)}
                </td>
                <td className="px-4 py-4 text-center">
                  {s.encashableCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {s.encashableCount} {s.encashableCount === 1 ? "policy" : "policies"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">None</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(s)}
                    className="h-7 text-xs border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-medium shadow-none"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1 text-zinc-500" />
                    Breakdown
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

