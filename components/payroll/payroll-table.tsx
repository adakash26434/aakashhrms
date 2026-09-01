"use client";

import { Eye, CheckCircle2, AlertCircle, FileText, Download } from "lucide-react";
import type { PayrollRun } from "@/lib/types/payroll";

interface PayrollTableProps {
  runs: PayrollRun[];
  onSelect: (run: PayrollRun) => void;
}

export function PayrollTable({ runs, onSelect }: PayrollTableProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-600">No payroll runs generated yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Go to the "Generate Payroll" tab to create your first batch.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">Draft</span>;
      case "UNDER_REVIEW":
        return <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Under Review</span>;
      case "APPROVED":
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Approved</span>;
      case "LOCKED":
        return <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Locked</span>;
      default:
        return null;
    }
  };

  const getBSMonthName = (m: number) => {
    const months = [
      "", "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", 
      "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
    ];
    return months[m] ?? "Unknown";
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-[#d7e8d0] bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6] text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3.5">BS Period</th>
            <th className="px-6 py-3.5">AD Range</th>
            <th className="px-6 py-3.5 text-center">Employees</th>
            <th className="px-6 py-3.5 text-right">Total Net Salary</th>
            <th className="px-6 py-3.5 text-right">Total TDS</th>
            <th className="px-6 py-3.5">Status</th>
            <th className="px-6 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className="border-b border-[#d7e8d0]/60 transition-colors hover:bg-[#f6faf6]/30"
            >
              <td className="px-6 py-4">
                <span className="font-semibold text-[#1b3a1f]">
                  {getBSMonthName(run.payPeriodMonth)} {run.payPeriodYear}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-gray-500 tabular-nums">
                {run.payPeriodStartDate} to {run.payPeriodEndDate}
              </td>
              <td className="px-6 py-4 text-center font-medium text-gray-700">
                {run.employeeCount}
              </td>
              <td className="px-6 py-4 text-right font-medium text-emerald-600 tabular-nums">
                Rs. {Number(run.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-right text-gray-600 tabular-nums">
                Rs. {Number(run.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4">
                {getStatusBadge(run.status)}
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => onSelect(run)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#d7e8d0] bg-white px-3 py-1.5 text-xs font-medium text-[#1b3a1f] shadow-sm transition-all hover:bg-[#d7e8d0]/20 hover:text-[#2e7d32]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
