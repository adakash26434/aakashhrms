"use client";

import { useState, useMemo } from "react";
import { Eye, Trash2, AlertTriangle, FileText, Search, Clock, CheckCircle2, Lock, Calendar } from "lucide-react";
import type { PayrollRun, PayrollRunStatus } from "@/lib/types/payroll";
import { TableShell } from "@/components/ui/table-shell";
import { Button } from "@/components/ui/button";

interface PayrollTableProps {
  runs: PayrollRun[];
  onSelect: (run: PayrollRun) => void;
  onDelete?: (run: PayrollRun) => Promise<void>;
  selectedRunId?: string | null;
}

export function PayrollTable({ runs, onSelect, onDelete, selectedRunId }: PayrollTableProps) {
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<PayrollRun | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PayrollRunStatus>("ALL");

  const getBSMonthName = (m: number) => {
    const months = [
      "", "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", 
      "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
    ];
    return months[m] ?? "Unknown";
  };

  const filteredRuns = useMemo(() => {
    return runs
      .filter((run) => {
        if (statusFilter !== "ALL" && run.status !== statusFilter) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const monthName = getBSMonthName(run.payPeriodMonth).toLowerCase();
          const yearStr = String(run.payPeriodYear);
          const matches =
            monthName.includes(q) ||
            yearStr.includes(q) ||
            run.payPeriodStartDate.toLowerCase().includes(q) ||
            run.payPeriodEndDate.toLowerCase().includes(q) ||
            run.status.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.payPeriodYear !== a.payPeriodYear) {
          return b.payPeriodYear - a.payPeriodYear;
        }
        return b.payPeriodMonth - a.payPeriodMonth;
      });
  }, [runs, search, statusFilter]);

  const getStatusBadge = (status: PayrollRunStatus) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-200/70">
            <Clock className="h-3 w-3 text-gray-500" />
            Draft
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/80">
            <Clock className="h-3 w-3 text-amber-600" />
            Under Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Approved
          </span>
        );
      case "LOCKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100/70 px-2.5 py-0.5 text-[10px] font-semibold text-green-900 border border-green-300/80">
            <Lock className="h-3 w-3 text-green-700" />
            Locked
          </span>
        );
      default:
        return null;
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRun || !onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(confirmDeleteRun);
      setConfirmDeleteRun(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <TableShell
        title="Payroll Batch Registry"
        totalCount={runs.length}
        filteredCount={filteredRuns.length}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative min-w-56 flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by BS month, year, date range..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-payroll-light/80 bg-payroll-cream/50 p-1 shadow-payroll-xs">
              {(["ALL", "DRAFT", "UNDER_REVIEW", "APPROVED", "LOCKED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-payroll-primary text-white shadow-payroll-xs"
                      : "text-gray-600 hover:text-payroll-navy hover:bg-white/60"
                  }`}
                >
                  {st === "ALL" ? "All Runs" : st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-payroll-cream text-payroll-primary">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-payroll-navy">No Payroll Batches Found</p>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {search || statusFilter !== "ALL"
                ? "No payroll batches match your current search or status criteria."
                : "No monthly payroll batches have been generated yet. Switch to the 'Generate Draft' tab to calculate your first run."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-payroll-light/80 bg-payroll-cream/80 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  <th className="px-4 py-3 min-w-36">BS Period</th>
                  <th className="px-4 py-3 min-w-44">AD Date Range</th>
                  <th className="px-4 py-3 text-center w-24">Employees</th>
                  <th className="px-4 py-3 text-right min-w-28">Total Gross</th>
                  <th className="px-4 py-3 text-right min-w-28 font-bold text-payroll-primary">Total Net Salary</th>
                  <th className="px-4 py-3 text-right min-w-24">Total TDS</th>
                  <th className="px-4 py-3 text-center min-w-28">Status</th>
                  <th className="px-4 py-3 text-center print:hidden min-w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-payroll-light/60">
                {filteredRuns.map((run) => {
                  const isSelected = run.id === selectedRunId;

                  return (
                    <tr
                      key={run.id}
                      onClick={() => onSelect(run)}
                      className={`transition-colors hover:bg-payroll-cream/50 cursor-pointer ${
                        isSelected ? "bg-payroll-primary/5 font-semibold ring-1 ring-payroll-primary/20 shadow-2xs" : ""
                      }`}
                    >
                      {/* BS Period */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/10 text-payroll-primary">
                            <Calendar className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-payroll-navy text-[13px]">
                              {getBSMonthName(run.payPeriodMonth)} {run.payPeriodYear}
                            </span>
                            <p className="text-[10px] text-gray-400 font-mono">
                              Month {run.payPeriodMonth}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* AD Date Range */}
                      <td className="px-4 py-3.5 text-gray-600 font-mono text-[11px] tabular-nums">
                        {run.payPeriodStartDate} → {run.payPeriodEndDate}
                      </td>

                      {/* Employees Count */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-payroll-light/60 px-2 py-0.5 font-bold font-mono text-payroll-navy">
                          {run.employeeCount}
                        </span>
                      </td>

                      {/* Total Gross */}
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-gray-700 font-medium">
                        Rs. {Number(run.totalGross).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Total Net Salary */}
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-payroll-primary text-[13px]">
                        Rs. {Number(run.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Total TDS */}
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-rose-700 font-medium">
                        Rs. {Number(run.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {getStatusBadge(run.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center print:hidden">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelect(run)}
                            className="h-7 text-xs border-payroll-light/80 hover:bg-payroll-primary hover:text-white text-payroll-navy font-semibold px-2.5 cursor-pointer shadow-payroll-xs"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1 text-payroll-primary" />
                            {run.status === "DRAFT" ? "Review & Audit" : "View Ledger"}
                          </Button>

                          {run.status !== "LOCKED" && onDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRun(run)}
                              title="Cancel run and fallback to initial state"
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableShell>

      {/* Confirmation Modal */}
      {confirmDeleteRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-payroll-light bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-payroll-navy">
                  Cancel & Revert Payroll Run?
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Are you sure you want to cancel and delete the payroll run for{" "}
                  <span className="font-semibold text-gray-800">
                    {getBSMonthName(confirmDeleteRun.payPeriodMonth)} {confirmDeleteRun.payPeriodYear}
                  </span>
                  ?
                </p>
                <div className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">
                  This will delete all generated payslips for this period and fallback to the initial un-generated state, allowing you to re-generate payslips again for this month.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteRun(null)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Keep Run
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Cancelling..." : "Yes, Cancel & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
