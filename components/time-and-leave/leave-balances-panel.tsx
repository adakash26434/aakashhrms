"use client";

import { useState, useMemo } from "react";
import type { LeaveBalanceRow, LeaveReportData, ReportFilterLookupData } from "@/lib/types/report";
import { LeaveBalanceTable } from "@/components/reports/leave-balance-table";
import { TableShell } from "@/components/ui/table-shell";
import { Search, Award, Users, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmployeeLeaveBalanceSummaryTable,
  type EmployeeLeaveSummary,
} from "./employee-leave-balance-summary-table";
import { EmployeeLeaveBalanceDetailDrawer } from "./employee-leave-balance-detail-drawer";

interface LeaveBalancesPanelProps {
  initialData?: LeaveReportData | null;
  lookups?: ReportFilterLookupData | null;
}

export function LeaveBalancesPanel({
  initialData,
  lookups,
}: LeaveBalancesPanelProps) {
  const [viewMode, setViewMode] = useState<"summary" | "ledger">("summary");
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLeaveSummary | null>(null);

  const rows: LeaveBalanceRow[] = useMemo(
    () => initialData?.balanceRows || [],
    [initialData?.balanceRows]
  );

  // Group raw rows into 1 summary record per employee
  const employeeSummaries = useMemo<EmployeeLeaveSummary[]>(() => {
    const map = new Map<string, EmployeeLeaveSummary>();
    for (const r of rows) {
      let existing = map.get(r.employeeCode);
      if (!existing) {
        existing = {
          employeeCode: r.employeeCode,
          employeeName: r.employeeName,
          departmentName: r.departmentName,
          designationName: "Staff",
          totalAllotted: 0,
          totalTaken: 0,
          totalCarriedForward: 0,
          totalBalance: 0,
          encashableCount: 0,
          items: [],
        };
        map.set(r.employeeCode, existing);
      }
      existing.totalAllotted += parseFloat(r.allotted) || 0;
      existing.totalTaken += parseFloat(r.taken) || 0;
      existing.totalCarriedForward += parseFloat(r.carriedForward) || 0;
      existing.totalBalance += parseFloat(r.balance) || 0;
      if (r.isEncashable) {
        existing.encashableCount += 1;
      }
      existing.items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  // Filtered summaries for default view
  const filteredSummaries = useMemo(() => {
    return employeeSummaries.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          s.employeeName.toLowerCase().includes(q) ||
          s.employeeCode.toLowerCase().includes(q) ||
          s.departmentName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedDept !== "all" && s.departmentName !== selectedDept) {
        return false;
      }
      if (selectedType !== "all") {
        const hasType = s.items.some((item) => item.leaveTypeName === selectedType);
        if (!hasType) return false;
      }
      return true;
    });
  }, [employeeSummaries, search, selectedDept, selectedType]);

  // Filtered rows for audit ledger view
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          row.employeeName.toLowerCase().includes(q) ||
          row.employeeCode.toLowerCase().includes(q) ||
          row.departmentName.toLowerCase().includes(q) ||
          row.leaveTypeName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedDept !== "all" && row.departmentName !== selectedDept) {
        return false;
      }
      if (selectedType !== "all" && row.leaveTypeName !== selectedType) {
        return false;
      }
      return true;
    });
  }, [rows, search, selectedDept, selectedType]);

  const departments = lookups?.departments || [];
  const leaveTypes = lookups?.leaveTypes || [];

  // Summary Metrics
  const totalEmployees = employeeSummaries.length;
  const totalBalanceDays = useMemo(() => {
    return rows.reduce((acc, r) => acc + (parseFloat(r.balance) || 0), 0);
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Employees tracked</p>
              <Users className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {totalEmployees}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Active workforce in leave ledger
          </div>
        </div>

        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Total balance days</p>
              <Award className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {totalBalanceDays.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Cumulative accrued leave remaining
          </div>
        </div>

        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Active fiscal year</p>
              <Award className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {initialData?.fiscalYearLabel || "Active"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Current accrual operating cycle
          </div>
        </div>
      </div>

      {/* Table Shell with View Mode Switcher and Filter Bar */}
      <TableShell
        title={viewMode === "summary" ? "Employee Leave Balances" : "Detailed Leave Balance Ledger"}
        totalCount={viewMode === "summary" ? employeeSummaries.length : rows.length}
        filteredCount={viewMode === "summary" ? filteredSummaries.length : filteredRows.length}
        actions={
          <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("summary")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer select-none",
                viewMode === "summary"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Employee Summary
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ledger")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer select-none",
                viewMode === "ledger"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Detailed Ledger
            </button>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search employee, code, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-colors"
              />
            </div>
            {departments.length > 0 && (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 shadow-2xs focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            {leaveTypes.length > 0 && (
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 shadow-2xs focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer"
              >
                <option value="all">All Leave Types</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      >
        {viewMode === "summary" ? (
          <EmployeeLeaveBalanceSummaryTable
            summaries={filteredSummaries}
            onViewDetails={(s) => setSelectedEmployee(s)}
          />
        ) : (
          <LeaveBalanceTable rows={filteredRows} />
        )}
      </TableShell>

      {/* Employee Detail Breakdown Drawer */}
      <EmployeeLeaveBalanceDetailDrawer
        open={selectedEmployee !== null}
        summary={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />
    </div>
  );
}
