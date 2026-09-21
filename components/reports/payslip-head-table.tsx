"use client";

import React, { useState } from "react";
import type { PayslipHeadSummaryRow } from "@/lib/types/report";
import { Search } from "lucide-react";

interface PayslipHeadTableProps {
  rows: PayslipHeadSummaryRow[];
  runLabel?: string;
}

export function PayslipHeadTable({ rows, runLabel }: PayslipHeadTableProps) {
  const [headTypeFilter, setHeadTypeFilter] = useState<"ALL" | "ALLOWANCE" | "DEDUCTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-payroll-light bg-payroll-cream p-8 text-center text-xs text-gray-500">
        No pay head summary data available for this run.
      </div>
    );
  }

  const filteredRows = rows.filter((r) => {
    if (headTypeFilter === "ALLOWANCE" && r.headType !== "allowance") return false;
    if (headTypeFilter === "DEDUCTION" && r.headType !== "deduction") return false;
    if (searchQuery.trim() && !r.payHeadName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const allowances = filteredRows.filter((r) => r.headType === "allowance");
  const deductions = filteredRows.filter((r) => r.headType === "deduction");

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-payroll-light bg-white p-4 shadow-payroll-sm">
        <div>
          <h2 className="text-sm font-bold text-payroll-navy uppercase tracking-wider">
            Pay Head Summary Breakdown {runLabel ? `— ${runLabel}` : ""}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Aggregated totals, employee coverage count, average amounts, and manual override tracking per pay head.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pay head..."
              className="h-8 w-44 rounded-lg border border-payroll-light bg-white pl-7 pr-2.5 text-xs text-payroll-navy focus:border-payroll-primary focus:outline-none"
            />
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          </div>

          {/* Type Toggle Pills */}
          <div className="inline-flex rounded-lg border border-payroll-light bg-payroll-cream p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setHeadTypeFilter("ALL")}
              className={`rounded-md px-2.5 py-1 transition-all ${
                headTypeFilter === "ALL" ? "bg-payroll-primary text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              All Heads
            </button>
            <button
              type="button"
              onClick={() => setHeadTypeFilter("ALLOWANCE")}
              className={`rounded-md px-2.5 py-1 transition-all ${
                headTypeFilter === "ALLOWANCE" ? "bg-emerald-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              Allowances
            </button>
            <button
              type="button"
              onClick={() => setHeadTypeFilter("DEDUCTION")}
              className={`rounded-md px-2.5 py-1 transition-all ${
                headTypeFilter === "DEDUCTION" ? "bg-red-600 text-white shadow-payroll-sm" : "text-gray-600 hover:text-payroll-navy"
              }`}
            >
              Deductions
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allowances Table */}
        <div className="rounded-xl border border-payroll-light bg-white shadow-sm overflow-hidden">
          <div className="bg-emerald-50 border-b border-payroll-light px-4 py-3">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Earnings & Allowances ({allowances.length})
            </h3>
          </div>
          <table className="w-full text-left text-xs text-payroll-navy">
            <thead className="bg-payroll-cream border-b border-payroll-light text-[10px] uppercase font-bold text-gray-600">
              <tr>
                <th className="px-3 py-2">Pay Head</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
                <th className="px-3 py-2 text-center">Employees</th>
                <th className="px-3 py-2 text-right">Avg / Person</th>
                <th className="px-3 py-2 text-center">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-payroll-light/60">
              {allowances.map((r, idx) => (
                <tr key={idx} className="hover:bg-payroll-cream/60">
                  <td className="px-3 py-2.5 font-semibold text-payroll-navy">
                    {r.payHeadName}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-mono font-bold text-emerald-700">
                    NPR {Number(r.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 font-medium">
                    {r.employeeCount}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-mono text-gray-600">
                    {Number(r.averageAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.overrideCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {r.overrideCount}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deductions Table */}
        <div className="rounded-xl border border-payroll-light bg-white shadow-sm overflow-hidden">
          <div className="bg-red-50 border-b border-payroll-light px-4 py-3">
            <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">
              Deductions ({deductions.length})
            </h3>
          </div>
          <table className="w-full text-left text-xs text-payroll-navy">
            <thead className="bg-payroll-cream border-b border-payroll-light text-[10px] uppercase font-bold text-gray-600">
              <tr>
                <th className="px-3 py-2">Pay Head</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
                <th className="px-3 py-2 text-center">Employees</th>
                <th className="px-3 py-2 text-right">Avg / Person</th>
                <th className="px-3 py-2 text-center">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-payroll-light/60">
              {deductions.map((r, idx) => (
                <tr key={idx} className="hover:bg-payroll-cream/60">
                  <td className="px-3 py-2.5 font-semibold text-payroll-navy">
                    {r.payHeadName}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-mono font-bold text-red-700">
                    NPR {Number(r.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 font-medium">
                    {r.employeeCount}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-right font-mono text-gray-600">
                    {Number(r.averageAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.overrideCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {r.overrideCount}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
