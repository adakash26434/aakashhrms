"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  CreditCard,
  Wallet,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Loan, LoanRepayment } from "@/lib/types/loan";
import { calculateLoanProgress } from "@/lib/engines/loan.engine";
import { getLoanRepaymentsAction } from "@/app/actions/loan.actions";

interface LoanDetailsModalProps {
  open: boolean;
  onClose: () => void;
  loan: Loan | null;
}

/** Generate a deterministic color from a name string. */
function getAvatarColor(name: string): string {
  const colors = [
    "bg-[#2e7d32] text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-violet-600 text-white",
    "bg-cyan-600 text-white",
    "bg-green-600 text-white",
    "bg-teal-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/** Add N months to a YYYY-MM-DD string and return YYYY-MM-DD. */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/** Format a payment method string for display. */
function formatMethod(method: string): string {
  switch (method) {
    case "SALARY_DEDUCTION":
      return "Salary Deduction";
    case "CASH":
      return "Cash";
    default:
      return method;
  }
}

export function LoanDetailsModal({
  open,
  onClose,
  loan,
}: LoanDetailsModalProps) {
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loadingRepayments, setLoadingRepayments] = useState(false);

  // Fetch repayment history when loan changes
  useEffect(() => {
    if (!open || !loan) {
      setRepayments([]);
      return;
    }
    setLoadingRepayments(true);
    getLoanRepaymentsAction(loan.id).then((res) => {
      if (res.success && res.data) {
        setRepayments(res.data);
      }
      setLoadingRepayments(false);
    });
  }, [open, loan]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !loan) return null;

  const progress = calculateLoanProgress(loan);
  const paidInstallments =
    loan.installmentAmount > 0
      ? Math.floor(loan.totalReturned / loan.installmentAmount)
      : 0;
  const totalPayable = loan.remainingAmount + loan.totalReturned;
  const endDate = addMonths(loan.givenDate, loan.noOfInstallments);

  // Most recent repayment
  const lastRepayment = repayments.length > 0 ? repayments[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative z-10 flex w-full max-w-2xl max-h-[90vh] flex-col rounded-xl border border-[#d7e8d0] bg-white shadow-xl outline-none animate-[dialogIn_180ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d7e8d0]/60 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-2.5 text-[#2e7d32]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#1b3a1f]">
                  Loan Details
                </h2>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge
                  variant={loan.status === "ACTIVE" ? "success" : "neutral"}
                >
                  {loan.status === "ACTIVE" ? "Active" : "Closed"}
                </Badge>
                <span className="text-xs text-gray-400">
                  {loan.loanTypeName}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#f6faf6] hover:text-[#ee3c4b]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Employee & Loan Type Info Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Employee Card */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(loan.employeeName)}`}
              >
                {getInitial(loan.employeeName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1b3a1f]">
                  {loan.employeeName}
                </p>
                <p className="text-xs text-gray-400">{loan.employeeCode}</p>
              </div>
            </div>

            {/* Loan Type Card */}
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-[#2e7d32]">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1b3a1f]">
                  {loan.loanTypeName}
                </p>
                <p className="text-xs text-gray-400">
                  {loan.noOfInstallments} month tenure
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[#1b3a1f]">
              Financial Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Principal
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1b3a1f]">
                  {loan.loanAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total Repayable
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1b3a1f]">
                  {totalPayable.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  EMI / Month
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1b3a1f]">
                  {loan.installmentAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Outstanding
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-red-500">
                  {loan.remainingAmount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  Repayment Progress
                </p>
                <p className="text-xs font-semibold tabular-nums text-[#1b3a1f]">
                  {progress}%
                </p>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    progress >= 100
                      ? "bg-emerald-500"
                      : "bg-linear-to-r from-[#2e7d32] to-[#3fa832]"
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Paid: {loan.totalReturned.toLocaleString()}
                </span>
                <span>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-gray-300" />
                  Remaining: {loan.remainingAmount.toLocaleString()}
                </span>
                <span className="tabular-nums">
                  {paidInstallments} / {loan.noOfInstallments} months
                </span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-gray-200 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Disbursed
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums text-[#1b3a1f]">
                {loan.givenDate}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Started
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums text-[#1b3a1f]">
                {loan.givenDate}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                End Date
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums text-[#1b3a1f]">
                {endDate}
              </p>
            </div>
          </div>

          {/* Last Payment Info */}
          {lastRepayment && (
            <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Last payment{" "}
                <span className="font-semibold text-[#1b3a1f]">
                  {lastRepayment.repaymentDate}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Rs. {lastRepayment.amountPaid.toLocaleString()} via{" "}
                {formatMethod(lastRepayment.paymentMethod)}
              </div>
            </div>
          )}

          {/* Repayment History */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-[#1b3a1f]">
                Repayment History
                {repayments.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    ({repayments.length} entries)
                  </span>
                )}
              </h3>
            </div>

            {loadingRepayments ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            ) : repayments.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Method
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {repayments
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.repaymentDate).getTime() -
                          new Date(b.repaymentDate).getTime()
                      )
                      .map((rep, idx) => (
                        <tr
                          key={rep.id}
                          className="transition-colors hover:bg-gray-50/50"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-[#1b3a1f]">
                            {rep.repaymentDate}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-emerald-600">
                            {rep.amountPaid.toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Wallet className="h-3.5 w-3.5" />
                              {formatMethod(rep.paymentMethod)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">
                            {ordinalInstallment(idx + 1)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                No repayments recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#d7e8d0]/60 bg-[#f6faf6]/50 px-6 py-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#2e7d32] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1b3a1f]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns "1st installment", "2nd installment", etc. */
function ordinalInstallment(n: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const s = suffix[(v - 20) % 10] || suffix[v] || suffix[0];
  return `${n}${s} installment`;
}
