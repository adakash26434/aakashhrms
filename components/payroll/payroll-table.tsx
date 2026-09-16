"use client";

import { useState } from "react";
import { Eye, Trash2, AlertTriangle, FileText, X } from "lucide-react";
import type { PayrollRun } from "@/lib/types/payroll";

interface PayrollTableProps {
  runs: PayrollRun[];
  onSelect: (run: PayrollRun) => void;
  onDelete?: (run: PayrollRun) => Promise<void>;
}

export function PayrollTable({ runs, onSelect, onDelete }: PayrollTableProps) {
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<PayrollRun | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      <div className="overflow-x-auto rounded-lg border border-payroll-light bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-payroll-light/80 bg-payroll-cream text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
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
                className="border-b border-payroll-light/60 transition-colors hover:bg-payroll-cream/30"
              >
                <td className="px-6 py-4">
                  <span className="font-semibold text-payroll-navy">
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
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(run)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-payroll-light bg-white px-3 py-1.5 text-xs font-medium text-payroll-navy shadow-sm transition-all hover:bg-payroll-light/20 hover:text-payroll-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {run.status === "DRAFT" ? "Review & Submit" : "View Details"}
                    </button>

                    {run.status !== 'LOCKED' && onDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRun(run)}
                        title="Cancel run and fallback to initial state"
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-all hover:bg-red-100 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Cancel Run
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Run
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
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

