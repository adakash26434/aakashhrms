"use client";

import React, { useState } from "react";
import type { PayslipHeadSummaryRow } from "@/lib/types/report";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayslipHeadTableProps {
  rows: PayslipHeadSummaryRow[];
  runLabel?: string;
}

export function PayslipHeadTable({ rows, runLabel }: PayslipHeadTableProps) {
  const [headTypeFilter, setHeadTypeFilter] = useState<"ALL" | "ALLOWANCE" | "DEDUCTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  if (rows.length === 0) {
    return (
      <div className="border-b border-zinc-100 py-12 text-center text-xs text-zinc-500 font-medium">
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-300/80">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Pay head summary breakdown {runLabel ? `— ${runLabel}` : ""}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
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
              className="h-8 w-44 rounded-md border border-zinc-200 bg-white pl-8 pr-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none transition-colors"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          </div>

          {/* Type Toggle Pills */}
          <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100/70 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setHeadTypeFilter("ALL")}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                headTypeFilter === "ALL" ? "bg-white text-zinc-950 font-semibold shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              All heads
            </button>
            <button
              type="button"
              onClick={() => setHeadTypeFilter("ALLOWANCE")}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                headTypeFilter === "ALLOWANCE" ? "bg-white text-zinc-950 font-semibold shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              Earnings & allowances
            </button>
            <button
              type="button"
              onClick={() => setHeadTypeFilter("DEDUCTION")}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                headTypeFilter === "DEDUCTION" ? "bg-white text-zinc-950 font-semibold shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              Deductions
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Allowances Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-300">
            <h3 className="text-xs font-semibold text-zinc-900">
              Earnings & allowances <span className="text-zinc-400 font-normal">({allowances.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold text-zinc-900">
                <tr>
                  <th className="px-2 py-2.5">Pay head</th>
                  <th className="px-2 py-2.5 text-right">Total amount</th>
                  <th className="px-2 py-2.5 text-center">Employees</th>
                  <th className="px-2 py-2.5 text-right">Avg / person</th>
                  <th className="px-2 py-2.5 text-center">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {allowances.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/60 transition-colors border-b border-zinc-100">
                    <td className="px-2 py-3.5 font-medium text-zinc-900">
                      {r.payHeadName}
                    </td>
                    <td className="px-2 py-3.5 tabular-nums text-right font-mono font-semibold text-zinc-900">
                      NPR {Number(r.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3.5 text-center text-zinc-600 font-normal">
                      {r.employeeCount}
                    </td>
                    <td className="px-2 py-3.5 tabular-nums text-right font-mono text-zinc-600 font-normal">
                      {Number(r.averageAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      {r.overrideCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-normal text-zinc-700">
                          {r.overrideCount}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions Table */}
        <div className="space-y-3 lg:border-l lg:border-zinc-200/80 lg:pl-12 pt-6 lg:pt-0">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-300">
            <h3 className="text-xs font-semibold text-zinc-900">
              Deductions <span className="text-zinc-400 font-normal">({deductions.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold text-zinc-900">
                <tr>
                  <th className="px-2 py-2.5">Pay head</th>
                  <th className="px-2 py-2.5 text-right">Total amount</th>
                  <th className="px-2 py-2.5 text-center">Employees</th>
                  <th className="px-2 py-2.5 text-right">Avg / person</th>
                  <th className="px-2 py-2.5 text-center">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {deductions.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/60 transition-colors border-b border-zinc-100">
                    <td className="px-2 py-3.5 font-medium text-zinc-900">
                      {r.payHeadName}
                    </td>
                    <td className="px-2 py-3.5 tabular-nums text-right font-mono font-semibold text-zinc-900">
                      NPR {Number(r.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3.5 text-center text-zinc-600 font-normal">
                      {r.employeeCount}
                    </td>
                    <td className="px-2 py-3.5 tabular-nums text-right font-mono text-zinc-600 font-normal">
                      {Number(r.averageAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      {r.overrideCount > 0 ? (
                        <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-normal text-zinc-700">
                          {r.overrideCount}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
