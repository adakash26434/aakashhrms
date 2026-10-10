"use client";

import { useState } from "react";
import { isOffCycle } from "@/lib/constants/run-types";
import { 
  Search, 
  Eye, 
  ClipboardList, 
  CheckSquare, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  AlertTriangle 
} from "lucide-react";
import dynamic from "next/dynamic";
import type { PayrollSlip, PayrollSlipHead, PayrollRun, PayrollRunStatus, PayrollSlipOverridePayload } from "@/lib/types/payroll";
import { 
  getPayslipWithHeadsAction, 
  updatePayrollSlipOverrideAction,
  recalculateEmployeePayslipAction,
  deleteEmployeePayslipAction,
  addPayHeadToPayslipAction,
  syncPayrollRunAttendanceAction
} from "@/app/actions/payroll.actions";

import { TableShell } from "@/components/ui/table-shell";
import { ErrorBanner } from "@/components/ui/error-banner";

const PayslipDetailModal = dynamic(
  () => import("./payslip-detail-modal").then((m) => m.PayslipDetailModal),
  { ssr: false }
);

interface PayrollReviewGridProps {
  run: PayrollRun;
  initialSlips: PayrollSlip[];
  onStatusChange: (toStatus: PayrollRunStatus, notes?: string) => Promise<void>;
  onDeleteRun?: () => Promise<void>;
  onRunUpdated?: () => Promise<void>;
  allPayHeads?: Array<{ id: string; name: string; code: string; type: 'allowance' | 'deduction' }>;
  userRole: string; // "System Administrator" | "HR Manager" | "Finance Auditor" etc.
}

export function PayrollReviewGrid({
  run,
  initialSlips,
  onStatusChange,
  onDeleteRun,
  onRunUpdated,
  allPayHeads,
  userRole
}: PayrollReviewGridProps) {
  const [slips, setSlips] = useState<PayrollSlip[]>(initialSlips);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedSlip, setSelectedSlip] = useState<PayrollSlip | null>(null);
  const [selectedHeads, setSelectedHeads] = useState<PayrollSlipHead[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recalculation & Deletion States
  const [recalculatingSlipId, setRecalculatingSlipId] = useState<string | null>(null);
  const [confirmDeleteSlip, setConfirmDeleteSlip] = useState<PayrollSlip | null>(null);
  const [isDeletingSlip, setIsDeletingSlip] = useState(false);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  // Extract unique departments for filtering
  const departments = Array.from(new Set(slips.map((s) => s.departmentName)));

  const filteredSlips = slips.filter((s) => {
    const matchesSearch =
      s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      s.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || s.departmentName === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleOpenDetail = async (slip: PayrollSlip) => {
    setError(null);
    try {
      const res = await getPayslipWithHeadsAction(slip.id);
      if (!res.success || !res.data) {
        setError(res.error || "Failed to load payslip detail.");
        return;
      }
      setSelectedSlip(slip);
      setSelectedHeads(res.data.heads);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to fetch payslip details.");
    }
  };

  const handleOverride = async (headId: string, amount: string, reason: string) => {
    if (!selectedSlip) return;
    setError(null);

    const payload: PayrollSlipOverridePayload = {
      slipId: selectedSlip.id,
      reason
    };

    if (headId === "basic-salary") {
      payload.basicSalary = amount;
    } else if (headId === "grade-amount") {
      payload.gradeAmount = amount;
    } else if (headId === "ot-amount") {
      payload.otAmount = amount;
    } else if (headId === "absent-deduction") {
      payload.absentDeduction = amount;
    } else if (headId === "loan-deduction") {
      payload.loanDeduction = amount;
    } else if (headId === "bank-details") {
      const [bName, bAcc] = amount.split("||");
      payload.bankName = bName;
      payload.bankAccountNumber = bAcc;
    } else {
      payload.headId = headId;
      payload.amount = amount;
    }

    const res = await updatePayrollSlipOverrideAction(payload);

    if (!res.success) {
      throw new Error(res.error || "Failed to save override.");
    }

    // Refresh slip and heads list
    const detailRes = await getPayslipWithHeadsAction(selectedSlip.id);
    if (detailRes.success && detailRes.data) {
      setSelectedSlip(detailRes.data.slip);
      setSelectedHeads(detailRes.data.heads);
      
      // Update in main list
      setSlips(slips.map(s => s.id === selectedSlip.id ? detailRes.data.slip : s));
    }
  };

  const handleStatusTransition = async (toStatus: PayrollRunStatus) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onStatusChange(toStatus, notes.trim() || undefined);
      setNotes("");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : `Failed to change status to ${toStatus}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAttendance = async () => {
    setError(null);
    setIsSyncingAttendance(true);
    try {
      const res = await syncPayrollRunAttendanceAction(run.id);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to sync attendance.");
      }
      if (onRunUpdated) {
        await onRunUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Calculation sync error.");
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const handleRecalculateSlip = async (slipId: string) => {
    setError(null);
    try {
      setRecalculatingSlipId(slipId);
      const res = await recalculateEmployeePayslipAction(slipId);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Failed to recalculate payslip.");
      }
      // Update in slips list
      setSlips(slips.map(s => s.id === slipId ? res.data!.slip : s));
      // If modal is open for this slip, update modal
      if (selectedSlip?.id === slipId) {
        setSelectedSlip(res.data.slip);
        setSelectedHeads(res.data.heads);
      }
      if (onRunUpdated) {
        await onRunUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Calculation error.");
    } finally {
      setRecalculatingSlipId(null);
    }
  };

  const handleConfirmDeleteSlip = async () => {
    if (!confirmDeleteSlip) return;
    setError(null);
    try {
      setIsDeletingSlip(true);
      const res = await deleteEmployeePayslipAction(confirmDeleteSlip.id);
      if (!res.success) {
        throw new Error(res.error || "Failed to delete employee payslip.");
      }
      setSlips(slips.filter(s => s.id !== confirmDeleteSlip.id));
      if (selectedSlip?.id === confirmDeleteSlip.id) {
        setSelectedSlip(null);
      }
      setConfirmDeleteSlip(null);
      if (onRunUpdated) {
        await onRunUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion error.");
    } finally {
      setIsDeletingSlip(false);
    }
  };

  const handleAddHead = async (payHeadId: string, amount: string, reason: string) => {
    if (!selectedSlip) return;
    setError(null);
    const res = await addPayHeadToPayslipAction({
      slipId: selectedSlip.id,
      payHeadId,
      amount,
      reason
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || "Failed to add pay head.");
    }
    setSelectedSlip(res.data.slip);
    setSelectedHeads(res.data.heads);
    setSlips(slips.map(s => s.id === selectedSlip.id ? res.data!.slip : s));
    if (onRunUpdated) {
      await onRunUpdated();
    }
  };

  const handleConfirmDeleteBatch = async () => {
    if (!onDeleteRun) return;
    setError(null);
    try {
      setIsDeletingBatch(true);
      await onDeleteRun();
      setConfirmDeleteBatch(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel run.");
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Determine actions based on RBAC and status
  const isDraft = run.status === "DRAFT";
  const isUnderReview = run.status === "UNDER_REVIEW";
  const isApproved = run.status === "APPROVED";
  // F6: festival allowance and arrears runs read no attendance.
  const offCycle = isOffCycle(run.runType);
  const isLocked = run.status === "LOCKED";

  // Check roles (dynamic RBAC helper check on UI boundary)
  const roleLower = (userRole || "").toLowerCase();
  const isAdmin = 
    roleLower.includes("admin") || 
    roleLower.includes("super") || 
    roleLower === "company admin";

  const isHR = isAdmin || roleLower.includes("hr") || userRole === "HR Manager";
  const isFinance = isAdmin || roleLower.includes("finance") || roleLower.includes("audit") || userRole === "Finance Auditor";
  const isCEO = isAdmin || roleLower.includes("ceo") || roleLower.includes("director") || roleLower.includes("executive") || userRole === "CEO";

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <TableShell
        title="Monthly Payslips Ledger"
        totalCount={slips.length}
        filteredCount={filteredSlips.length}
        toolbar={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff name or employee ID..."
                className="w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              {isDraft && !offCycle && (
                <button
                  type="button"
                  onClick={handleSyncAttendance}
                  disabled={isSyncingAttendance}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Re-aggregate attendance punches, unpaid leaves, and OT calculations for this batch"
                >
                  <RefreshCw className={isSyncingAttendance ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {isSyncingAttendance ? "Syncing..." : "Sync Attendance"}
                </button>
              )}
              {departments.length > 0 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary transition-colors cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
              <tr className="border-b border-zinc-300 bg-zinc-50 text-left text-2xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department / Role</th>
                <th className="px-5 py-3">Bank Details</th>
                <th className="px-5 py-3 text-right">Basic</th>
                <th className="px-5 py-3 text-right">Grade</th>
                <th className="px-5 py-3 text-right">OT</th>
                <th className="px-5 py-3 text-right font-medium text-emerald-800">Gross</th>
                <th className="px-5 py-3 text-right">Deductions</th>
                <th className="px-5 py-3 text-right">Loan</th>
                <th className="px-5 py-3 text-right">TDS (Tax)</th>
                <th className="px-5 py-3 text-right font-medium text-zinc-900">Net Salary</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredSlips.map((slip) => (
                <tr
                  key={slip.id}
                  className="hover:bg-zinc-50/60 transition-colors text-xs"
                >
                  <td className="px-5 py-3.5">
                    <div>
                      <span className="font-medium text-zinc-900">{slip.employeeName}</span>
                      <span className="ml-2 rounded border border-zinc-200/70 bg-zinc-50 px-1.5 py-0.5 text-2xs font-mono text-zinc-600 tabular-nums">
                        {slip.employeeCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">
                    {slip.departmentName} <br />
                    <span className="text-2xs text-zinc-400">{slip.designationName}</span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 text-2xs">
                    <span className="font-medium text-zinc-800">{slip.bankName}</span> <br />
                    <span className="text-zinc-400 font-mono tabular-nums">{slip.bankAccountNumber}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-zinc-700">
                    Rs. {Number(slip.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-zinc-700">
                    Rs. {Number(slip.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-emerald-800 font-medium">
                    Rs. {Number(slip.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-emerald-800 font-medium">
                    Rs. {Number(slip.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-rose-700">
                    Rs. {Number(slip.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-rose-700">
                    Rs. {Number(slip.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-rose-700">
                    Rs. {Number(slip.tdsThisMonth).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900 font-mono">
                    Rs. {Number(slip.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenDetail(slip)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-700 font-medium hover:text-zinc-950 p-1 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        {isDraft ? "Override" : "View"}
                      </button>

                      {isDraft && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRecalculateSlip(slip.id)}
                            disabled={recalculatingSlipId === slip.id}
                            title="Recalculate from master data (salary mapping, new pay heads, attendance)"
                            className="rounded p-1 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${recalculatingSlipId === slip.id ? "animate-spin text-zinc-800" : ""}`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSlip(slip)}
                            title="Remove employee from draft batch"
                            className="rounded p-1 text-zinc-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>

      {/* Locked Audit Notice */}
      {isLocked && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 text-xs text-emerald-950">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100/70 text-emerald-800 border border-emerald-200/50">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-emerald-950">Finalized & Locked Payroll Batch</p>
              <p className="text-2xs text-emerald-800/80 mt-0.5">
                This batch is locked for audit integrity. Payslip line-items cannot be altered. Bank transfers and statutory ledgers can be exported from the top header.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RBAC Verification Panel */}
      {!isLocked && (
        <div className="border-t border-zinc-200/80 pt-6 space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Payroll Control Actions</h3>
          
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add transition notes (e.g. reviewed by, reason for revert, auditors checklist...)"
            className="w-full rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary transition-colors"
            rows={2}
          />

          <div className="flex flex-wrap gap-2.5">
            {/* HR / Admin submits draft to auditor */}
            {isDraft && isHR && (
              <>
                {!offCycle && (
                <button
                  type="button"
                  onClick={handleSyncAttendance}
                  disabled={isSyncingAttendance || isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={isSyncingAttendance ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {isSyncingAttendance ? "Syncing Attendance..." : "Sync Latest Attendance"}
                </button>
                )}
                <button
                  onClick={() => handleStatusTransition("UNDER_REVIEW")}
                  disabled={isSubmitting || isSyncingAttendance}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Submit for Review
                </button>
              </>
            )}

            {/* Auditor reviews and approves */}
            {isUnderReview && isFinance && (
              <>
                <button
                  onClick={() => handleStatusTransition("APPROVED")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary px-4 py-2 text-xs font-medium text-white hover:bg-payroll-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Approve Calculations
                </button>
                <button
                  onClick={() => handleStatusTransition("DRAFT")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Reject & Revert to Draft
                </button>
              </>
            )}

            {/* CFO / CEO performs final locking */}
            {isApproved && isCEO && (
              <>
                <button
                  onClick={() => handleStatusTransition("LOCKED")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary px-4 py-2 text-xs font-medium text-white hover:bg-payroll-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Lock & Disburse Payroll
                </button>
                <button
                  onClick={() => handleStatusTransition("DRAFT")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Reject & Revert to Draft
                </button>
              </>
            )}

            {/* Discard Entire Batch Button */}
            {(isDraft || isUnderReview) && onDeleteRun && (
              <button
                type="button"
                onClick={() => setConfirmDeleteBatch(true)}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard Entire Batch
              </button>
            )}
          </div>
        </div>
      )}

      {selectedSlip && (
        <PayslipDetailModal
          slip={selectedSlip}
          heads={selectedHeads}
          onClose={() => setSelectedSlip(null)}
          onOverride={isDraft ? handleOverride : undefined}
          onRecalculate={isDraft ? () => handleRecalculateSlip(selectedSlip.id) : undefined}
          onAddHead={isDraft ? handleAddHead : undefined}
          allPayHeads={allPayHeads}
          isEditable={isDraft}
        />
      )}

      {/* Remove Employee Confirmation Modal */}
      {confirmDeleteSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-payroll-light bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-payroll-navy">
                  Remove Employee from Batch?
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Are you sure you want to remove <span className="font-semibold text-gray-800">{confirmDeleteSlip.employeeName}</span> ({confirmDeleteSlip.employeeCode}) from this payroll run?
                </p>
                <div className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-2xs text-red-700">
                  Their payslip will be deleted and the batch totals will be automatically recalculated.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteSlip(null)}
                disabled={isDeletingSlip}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSlip}
                disabled={isDeletingSlip}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingSlip ? "Removing..." : "Yes, Remove Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Batch Confirmation Modal */}
      {confirmDeleteBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-payroll-light bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-payroll-navy">
                  Discard Entire Payroll Batch?
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Are you sure you want to cancel and delete this entire payroll run? All generated payslips in this batch will be deleted and the period will fall back to the initial state.
                </p>
                <div className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-2xs text-red-700">
                  You will be able to generate the payslips again for this month from scratch.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteBatch(false)}
                disabled={isDeletingBatch}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Batch
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBatch}
                disabled={isDeletingBatch}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingBatch ? "Discarding..." : "Yes, Discard Batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

