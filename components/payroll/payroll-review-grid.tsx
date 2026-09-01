"use client";

import { useState } from "react";
import { Search, Eye, ClipboardList, CheckSquare, ShieldCheck, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import type { PayrollSlip, PayrollSlipHead, PayrollRun, PayrollRunStatus } from "@/lib/types/payroll";
import { getPayslipWithHeadsAction, updatePayrollSlipOverrideAction } from "@/app/actions/payroll.actions";

const PayslipDetailModal = dynamic(
  () => import("./payslip-detail-modal").then((m) => m.PayslipDetailModal),
  { ssr: false }
);

interface PayrollReviewGridProps {
  run: PayrollRun;
  initialSlips: PayrollSlip[];
  onStatusChange: (toStatus: PayrollRunStatus, notes?: string) => Promise<void>;
  userRole: string; // "System Administrator" | "HR Manager" | "Finance Auditor" etc.
}

export function PayrollReviewGrid({
  run,
  initialSlips,
  onStatusChange,
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

    const payload: any = {
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

  // Determine actions based on RBAC and status
  const isDraft = run.status === "DRAFT";
  const isUnderReview = run.status === "UNDER_REVIEW";
  const isApproved = run.status === "APPROVED";
  const isLocked = run.status === "LOCKED";

  // Check roles (dynamic RBAC helper check on UI boundary)
  const isHR = userRole === "HR Manager" || userRole === "System Administrator";
  const isFinance = userRole === "Finance Auditor" || userRole === "System Administrator";
  const isCEO = userRole === "CEO" || userRole === "System Administrator";

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-payroll-light bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by staff name or employee ID..."
            className="w-full rounded-lg border border-payroll-light bg-white pl-10 pr-4 py-2 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-lg border border-payroll-light bg-white px-3.5 py-2 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Payslips Grid Table */}
      <div className="overflow-x-auto rounded-xl border border-payroll-light bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-payroll-light/80 bg-payroll-cream text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3.5">Employee</th>
              <th className="px-6 py-3.5">Department / Role</th>
              <th className="px-6 py-3.5">Bank Details</th>
              <th className="px-6 py-3.5 text-right font-medium">Basic</th>
              <th className="px-6 py-3.5 text-right font-medium">Grade</th>
              <th className="px-6 py-3.5 text-right font-medium">OT</th>
              <th className="px-6 py-3.5 text-right font-medium">Gross</th>
              <th className="px-6 py-3.5 text-right font-medium">Deductions</th>
              <th className="px-6 py-3.5 text-right font-medium">Loan</th>
              <th className="px-6 py-3.5 text-right font-medium">TDS (Tax)</th>
              <th className="px-6 py-3.5 text-right font-bold">Net Salary</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSlips.map((slip) => (
              <tr
                key={slip.id}
                className="border-b border-payroll-light/60 transition-colors hover:bg-payroll-cream/30 text-xs"
              >
                <td className="px-6 py-4">
                  <div>
                    <span className="font-semibold text-payroll-navy">{slip.employeeName}</span>
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 tabular-nums">
                      {slip.employeeCode}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {slip.departmentName} <br />
                  <span className="text-[10px] text-gray-400">{slip.designationName}</span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-[11px]">
                  <span className="font-semibold text-gray-700">{slip.bankName}</span> <br />
                  <span className="text-gray-400 font-medium tabular-nums">{slip.bankAccountNumber}</span>
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-gray-700">
                  Rs. {Number(slip.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-gray-700">
                  Rs. {Number(slip.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-emerald-600 font-medium">
                  Rs. {Number(slip.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-emerald-600 font-bold">
                  Rs. {Number(slip.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-red-500">
                  Rs. {Number(slip.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-red-500 font-semibold">
                  Rs. {Number(slip.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-red-500">
                  Rs. {Number(slip.tdsThisMonth).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-payroll-navy">
                  Rs. {Number(slip.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleOpenDetail(slip)}
                    className="inline-flex items-center gap-1 text-xs text-payroll-primary font-bold hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {isDraft ? "Override" : "View Breakdown"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RBAC Verification Panel */}
      {!isLocked && (
        <div className="rounded-xl border border-payroll-light bg-payroll-cream p-6 space-y-4">
          <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">Payroll Control Actions</h3>
          
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add transition notes (e.g. reviewed by, reason for revert, auditors checklist...)"
            className="w-full rounded-lg border border-payroll-light bg-white p-3 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
            rows={2}
          />

          <div className="flex flex-wrap gap-3">
            {/* HR submits draft to auditor */}
            {isDraft && isHR && (
              <button
                onClick={() => handleStatusTransition("UNDER_REVIEW")}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-payroll-navy disabled:opacity-50"
              >
                <ClipboardList className="h-4 w-4" />
                Submit for Verification
              </button>
            )}

            {/* Auditor reviews and approves */}
            {isUnderReview && isFinance && (
              <>
                <button
                  onClick={() => handleStatusTransition("APPROVED")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckSquare className="h-4 w-4" />
                  Approve Calculations
                </button>
                <button
                  onClick={() => handleStatusTransition("DRAFT")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Reject & Revert to Draft
                </button>
              </>
            )}

            {/* CFO / CEO performs final locking (separation of duties enforced by service) */}
            {isApproved && isCEO && (
              <>
                <button
                  onClick={() => handleStatusTransition("LOCKED")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Lock & Disburse Payroll
                </button>
                <button
                  onClick={() => handleStatusTransition("DRAFT")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Reject & Revert to Draft
                </button>
              </>
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
          isEditable={isDraft}
        />
      )}
    </div>
  );
}
