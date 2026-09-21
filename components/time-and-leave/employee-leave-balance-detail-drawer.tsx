"use client";

import React from "react";
import { DrawerShell } from "@/components/ui/drawer-shell";
import { CheckCircle2, XCircle, Info, ShieldCheck, Calendar, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { EmployeeLeaveSummary } from "./employee-leave-balance-summary-table";

interface EmployeeLeaveBalanceDetailDrawerProps {
  open: boolean;
  summary: EmployeeLeaveSummary | null;
  onClose: () => void;
}

export function EmployeeLeaveBalanceDetailDrawer({
  open,
  summary,
  onClose,
}: EmployeeLeaveBalanceDetailDrawerProps) {
  if (!summary) return null;

  // Extract initials for avatar
  const initials =
    summary.employeeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "E";

  // Calculate encashable days total
  const totalEncashableDays = summary.items
    .filter((item) => item.isEncashable)
    .reduce((acc, item) => acc + (parseFloat(item.balance) || 0), 0);

  // Overall consumption percent
  const overallUsedPercent =
    summary.totalAllotted > 0
      ? Math.min(100, Math.round((summary.totalTaken / summary.totalAllotted) * 100))
      : 0;

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      size="4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-payroll-primary/15 font-bold text-payroll-primary text-sm shadow-payroll-xs">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-payroll-navy leading-tight truncate">
                {summary.employeeName}
              </h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/70">
                Active
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
              <span className="font-mono font-medium text-payroll-navy">{summary.employeeCode}</span>
              <span>·</span>
              <span>{summary.departmentName || "General Department"}</span>
              <span>·</span>
              <span>{summary.designationName || "Staff"}</span>
            </p>
          </div>
        </div>
      }
      description="Comprehensive individual entitlement ledger, consumption rates, and encashment eligibility breakdown."
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            Evaluating <strong className="text-payroll-navy font-semibold">{summary.items.length} leave policies</strong> for fiscal year
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 border-payroll-light/80 hover:bg-payroll-cream text-payroll-navy font-semibold px-4 cursor-pointer"
          >
            Close Ledger
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-2 pb-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Card 1: Allotted */}
          <Card className="p-3.5 border-payroll-light/70 bg-payroll-cream/30">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Allotted
                </span>
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <p className="text-xl font-bold tabular-nums font-mono text-payroll-navy">
                {summary.totalAllotted.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 truncate">Total FY Entitlement</p>
            </div>
          </Card>

          {/* Card 2: Taken */}
          <Card className="p-3.5 border-payroll-light/70 bg-payroll-cream/30">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Taken
                </span>
                <span className="text-[10px] font-semibold text-amber-700">
                  {overallUsedPercent}% used
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums font-mono text-amber-700">
                {summary.totalTaken.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 truncate">Consumed to date</p>
            </div>
          </Card>

          {/* Card 3: Carried Forward */}
          <Card className="p-3.5 border-payroll-light/70 bg-payroll-cream/30">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Carried Fwd
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <p className="text-xl font-bold tabular-nums font-mono text-gray-700">
                {summary.totalCarriedForward.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-400 truncate">From previous FY</p>
            </div>
          </Card>

          {/* Card 4: Total Balance */}
          <Card className="p-3.5 border-emerald-200/80 bg-emerald-50/50 shadow-payroll-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Available Balance
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xl font-bold tabular-nums font-mono text-payroll-primary">
                {summary.totalBalance.toFixed(1)}
              </p>
              <p className="text-[10px] text-emerald-700/80 font-medium truncate">Remaining Days</p>
            </div>
          </Card>

          {/* Card 5: Encashable */}
          <Card className="p-3.5 border-payroll-light/70 bg-payroll-cream/30">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Encashable
                </span>
                <ShieldCheck className="h-3.5 w-3.5 text-payroll-primary" />
              </div>
              <p className="text-xl font-bold tabular-nums font-mono text-payroll-navy">
                {summary.encashableCount} <span className="text-xs font-normal text-gray-500">policies</span>
              </p>
              <p className="text-[10px] text-emerald-700 font-semibold truncate">
                {totalEncashableDays.toFixed(1)} days eligible
              </p>
            </div>
          </Card>
        </div>

        {/* Per-Policy Breakdown Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                Policy Ledger Breakdown
              </h4>
              <span className="rounded-full bg-payroll-primary/10 px-2 py-0.5 text-[10px] font-semibold text-payroll-primary">
                {summary.items.length} categories
              </span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              Nepal Labour Act 2074 Rules Applied
            </span>
          </div>

          {/* Table Container with guaranteed horizontal scroll & min-width */}
          <div className="overflow-hidden rounded-xl border border-payroll-light/80 bg-white shadow-payroll-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left text-xs">
                <thead>
                  <tr className="border-b border-payroll-light/80 bg-payroll-cream/80 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    <th className="px-4 py-3 min-w-[200px]">Leave Category</th>
                    <th className="px-3 py-3 text-center w-24">Type</th>
                    <th className="px-3 py-3 text-right w-20">Allotted</th>
                    <th className="px-3 py-3 text-right w-20">Taken</th>
                    <th className="px-3 py-3 text-right w-20">Carried</th>
                    <th className="px-4 py-3 text-right w-24 font-bold text-payroll-primary">Balance</th>
                    <th className="px-4 py-3 text-center min-w-[120px]">Encashable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-payroll-light/60">
                  {summary.items.map((item, idx) => {
                    const allotted = parseFloat(item.allotted) || 0;
                    const taken = parseFloat(item.taken) || 0;
                    const balance = parseFloat(item.balance) || 0;
                    const carried = parseFloat(item.carriedForward) || 0;
                    const percentUsed =
                      allotted > 0 ? Math.min(100, Math.round((taken / allotted) * 100)) : 0;

                    return (
                      <tr
                        key={`${item.leaveTypeCode}-${idx}`}
                        className="transition-colors hover:bg-payroll-cream/40"
                      >
                        {/* Leave Category */}
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-bold text-payroll-navy leading-snug">
                              {item.leaveTypeName}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="rounded bg-payroll-light/70 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-payroll-navy">
                                {item.leaveTypeCode}
                              </span>
                              {allotted > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden"
                                    title={`${percentUsed}% utilized`}
                                  >
                                    <div
                                      className={`h-full rounded-full ${
                                        percentUsed > 80
                                          ? "bg-rose-500"
                                          : percentUsed > 40
                                          ? "bg-amber-500"
                                          : "bg-payroll-primary"
                                      }`}
                                      style={{ width: `${percentUsed}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    {percentUsed}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400">On-demand</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Statutory / Custom Badge */}
                        <td className="px-3 py-3 text-center">
                          {item.isStatutory ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                              Statutory
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                              Custom
                            </span>
                          )}
                        </td>

                        {/* Allotted */}
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-700 font-medium">
                          {allotted.toFixed(1)}
                        </td>

                        {/* Taken */}
                        <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">
                          <span className={taken > 0 ? "text-amber-700 font-bold" : "text-gray-400"}>
                            {taken.toFixed(1)}
                          </span>
                        </td>

                        {/* Carried Forward */}
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-600">
                          {carried.toFixed(1)}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-payroll-primary text-[13px]">
                          {balance.toFixed(1)}
                        </td>

                        {/* Encashable */}
                        <td className="px-4 py-3 text-center">
                          {item.isEncashable ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Encashable
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                              <XCircle className="h-3 w-3 text-gray-300" />
                              Lapses
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Nepal Labour Act 2074 Statutory Encashment & Carry-Forward Guidelines */}
        <div className="rounded-xl border border-payroll-light/80 bg-payroll-cream/40 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-payroll-navy font-bold">
            <Info className="h-4 w-4 text-payroll-primary shrink-0" />
            <span>Nepal Labour Act 2074 Entitlement & Encashment Rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-gray-600 text-[11px] leading-relaxed">
            <div className="rounded-lg bg-white p-2.5 border border-payroll-light/60">
              <strong className="text-payroll-navy font-semibold">Home Leave (घर बिदा):</strong>
              <p className="mt-0.5">
                Accrues 1 day per 20 working days. Up to <strong>90 days</strong> can be accumulated and carried forward. Excess days are encashable at year-end or exit.
              </p>
            </div>
            <div className="rounded-lg bg-white p-2.5 border border-payroll-light/60">
              <strong className="text-payroll-navy font-semibold">Sick Leave (बिरामी बिदा):</strong>
              <p className="mt-0.5">
                Up to 12 days fully paid per year. Up to <strong>45 days</strong> can be accumulated and carried forward. Excess days are encashable at year-end or exit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DrawerShell>
  );
}
