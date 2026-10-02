"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  CreditCard,
  Wallet,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Loan, LoanRepayment } from "@/lib/types/loan";
import { calculateLoanProgress } from "@/lib/engines/loan.engine";
import { getLoanRepaymentsAction } from "@/app/actions/loan.actions";

interface LoanDetailsModalProps {
  open: boolean;
  onClose: () => void;
  loan: Loan | null;
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
      return "Cash Direct";
    default:
      return method;
  }
}

/** Returns "1st installment", "2nd installment", etc. */
function ordinalInstallment(n: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const s = suffix[(v - 20) % 10] || suffix[v] || suffix[0];
  return `${n}${s} installment`;
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

  if (!loan) return null;

  const progress = calculateLoanProgress(loan);
  const paidInstallments =
    loan.installmentAmount > 0
      ? Math.floor(loan.totalReturned / loan.installmentAmount)
      : 0;
  const totalPayable = loan.remainingAmount + loan.totalReturned;
  const endDate = addMonths(loan.givenDate, loan.noOfInstallments);
  const lastRepayment = repayments.length > 0 ? repayments[0] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Loan Account Details"
      description={`Lending ledger and repayment audit for ${loan.employeeName} (${loan.employeeCode}).`}
      size="3xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            Facility ID: {loan.id.slice(0, 8)} • Status: {loan.status === "ACTIVE" ? "Active Facility" : "Settled"}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Beneficiary & Scheme Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Employee Card */}
          <div className="flex items-center gap-3 rounded-md border border-zinc-200/80 bg-zinc-50/50 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/60 text-xs font-bold text-emerald-950">
              {getInitial(loan.employeeName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {loan.employeeName}
              </p>
              <p className="text-xs text-zinc-500 font-mono">{loan.employeeCode}</p>
            </div>
          </div>

          {/* Scheme Card */}
          <div className="flex items-center gap-3 rounded-md border border-zinc-200/80 bg-zinc-50/50 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {loan.loanTypeName}
                </p>
                <Badge variant={loan.status === "ACTIVE" ? "success" : "neutral"}>
                  {loan.status === "ACTIVE" ? "Active" : "Closed"}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500">
                {loan.noOfInstallments} months tenure
              </p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-md border border-zinc-200/80 p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Financial Facility Overview
            </h4>
            <span className="text-2xs font-mono text-zinc-500">
              Disbursed: {loan.givenDate} • Target End: {endDate}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
            <div>
              <p className="text-2xs font-medium text-zinc-500">
                Principal Sum
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 font-mono">
                NPR {loan.loanAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium text-zinc-500">
                Total Repayable
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 font-mono">
                NPR {totalPayable.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium text-zinc-500">
                Monthly EMI
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-950 font-mono">
                NPR {loan.installmentAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-2xs font-medium text-zinc-500">
                Outstanding Balance
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-amber-900 font-mono">
                NPR {loan.remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="pt-2">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-zinc-600 font-medium">Repayment Progress</span>
              <span className="font-semibold tabular-nums text-zinc-900 font-mono">
                {progress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-payroll-primary transition-all duration-700"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-2xs text-zinc-500 font-mono">
              <span>Paid: NPR {loan.totalReturned.toLocaleString()}</span>
              <span>Remaining: NPR {loan.remainingAmount.toLocaleString()}</span>
              <span>{paidInstallments} / {loan.noOfInstallments} cycles</span>
            </div>
          </div>
        </div>

        {/* Last Payment Indicator */}
        {lastRepayment && (
          <div className="flex items-center justify-between rounded-md border border-emerald-200/60 bg-emerald-50/40 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-950 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              Latest Payment on <span className="font-mono font-semibold">{lastRepayment.repaymentDate}</span>
            </div>
            <span className="font-mono font-semibold text-emerald-950">
              NPR {lastRepayment.amountPaid.toLocaleString()} via {formatMethod(lastRepayment.paymentMethod)}
            </span>
          </div>
        )}

        {/* Repayment History Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-zinc-400" />
              <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Repayment Audit History
              </h4>
            </div>
            <span className="text-2xs text-zinc-500 font-mono">
              {repayments.length} transaction(s) recorded
            </span>
          </div>

          {loadingRepayments ? (
            <div className="space-y-2 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-zinc-100" />
              ))}
            </div>
          ) : repayments.length > 0 ? (
            <div className="rounded-md border border-zinc-200/80 overflow-hidden">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-zinc-200 border-b border-zinc-300 text-2xs font-semibold text-zinc-900 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5 text-left">Method</th>
                    <th className="px-4 py-2.5 text-left">Cycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {repayments
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.repaymentDate).getTime() -
                        new Date(a.repaymentDate).getTime()
                    )
                    .map((rep, idx) => (
                      <tr key={rep.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-800">
                          {rep.repaymentDate}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold text-emerald-950">
                          NPR {rep.amountPaid.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">
                          {formatMethod(rep.paymentMethod)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400 font-mono text-2xs">
                          {ordinalInstallment(repayments.length - idx)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-zinc-400">
              No repayment transactions logged for this facility.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
