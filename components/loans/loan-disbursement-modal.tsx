"use client";

import { useState, useMemo } from "react";
import type {
  DisburseLoanFormData,
  DisbursementValidationErrors,
} from "@/lib/types/loan";
import type { LoanLookupData } from "@/lib/types/loan";
import { calculateInstallmentAmount, calculateTotalPayable } from "@/lib/engines/loan.engine";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoanDisbursementModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: DisburseLoanFormData) => Promise<void>;
  lookupData: LoanLookupData | null;
  validationErrors?: DisbursementValidationErrors;
}

export function LoanDisbursementModal({
  open,
  onClose,
  onSave,
  lookupData,
  validationErrors,
}: LoanDisbursementModalProps) {
  const [form, setForm] = useState<DisburseLoanFormData>({
    employeeId: "",
    loanTypeId: "",
    givenDate: new Date().toISOString().split("T")[0],
    loanAmount: 0,
    noOfInstallments: 1,
  });
  const [saving, setSaving] = useState(false);

  // Get the selected loan type for dynamic calculation
  const selectedLoanType = useMemo(() => {
    if (!lookupData || !form.loanTypeId) return null;
    return lookupData.loanTypes.find((lt) => lt.id === form.loanTypeId) || null;
  }, [lookupData, form.loanTypeId]);

  // Dynamic installment calculation
  const computed = useMemo(() => {
    if (!selectedLoanType || form.loanAmount <= 0 || form.noOfInstallments <= 0) {
      return { installment: 0, totalPayable: 0, totalInterest: 0 };
    }
    const installment = calculateInstallmentAmount(
      form.loanAmount,
      selectedLoanType.interestRate,
      form.noOfInstallments,
    );
    const totalPayable = calculateTotalPayable(form.loanAmount, selectedLoanType.interestRate);
    const totalInterest = totalPayable - form.loanAmount;
    return { installment, totalPayable, totalInterest };
  }, [form.loanAmount, form.noOfInstallments, selectedLoanType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Loan Disbursement"
      description="Issue a loan disbursement against an approved employee scheme."
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {form.loanAmount > 0
              ? `Disbursing: NPR ${form.loanAmount.toLocaleString()}`
              : "Specify loan terms"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="disburse-form"
              disabled={saving}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              {saving ? "Disbursing..." : "Disburse Loan"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="disburse-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Beneficiary & Scheme */}
        <FormSection
          title="Beneficiary & Scheme"
          description="Select the employee recipient and the applicable approved loan scheme."
          isFirst
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
              >
                <option value="">Select an employee...</option>
                {lookupData?.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
              {validationErrors?.employeeId && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.employeeId}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Loan Scheme <span className="text-red-500">*</span>
              </label>
              <select
                value={form.loanTypeId}
                onChange={(e) => setForm({ ...form, loanTypeId: e.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
              >
                <option value="">Select loan scheme...</option>
                {lookupData?.loanTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.interestRate}% interest)
                  </option>
                ))}
              </select>
              {validationErrors?.loanTypeId && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.loanTypeId}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Disbursement Terms */}
        <FormSection
          title="Disbursement Terms"
          description="Specify principal sum, tenure limits, and execution date."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Principal (NPR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.loanAmount || ""}
                  onChange={(e) =>
                    setForm({ ...form, loanAmount: parseFloat(e.target.value) || 0 })
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  placeholder="0"
                />
                {validationErrors?.loanAmount && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.loanAmount}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Scheme Interest Rate
                </label>
                <input
                  type="text"
                  value={selectedLoanType ? `${selectedLoanType.interestRate}% Flat p.a.` : "—"}
                  readOnly
                  className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Tenure (Months) <span className="text-red-500">*</span>
                  {selectedLoanType && selectedLoanType.maxInstallments > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-zinc-400">
                      (Max {selectedLoanType.maxInstallments})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedLoanType?.maxInstallments || undefined}
                  value={form.noOfInstallments || ""}
                  onChange={(e) => {
                    let val = parseInt(e.target.value) || 0;
                    if (
                      selectedLoanType &&
                      selectedLoanType.maxInstallments > 0 &&
                      val > selectedLoanType.maxInstallments
                    ) {
                      val = selectedLoanType.maxInstallments;
                    }
                    setForm({ ...form, noOfInstallments: val });
                  }}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  placeholder="0"
                />
                {validationErrors?.noOfInstallments && (
                  <p className="mt-1 text-xs text-red-600">
                    {validationErrors.noOfInstallments}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Disbursement Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.givenDate}
                onChange={(e) => setForm({ ...form, givenDate: e.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
              />
              {validationErrors?.givenDate && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.givenDate}</p>
              )}
            </div>

            {/* Dynamic Calculator Display */}
            {computed.installment > 0 && (
              <div className="rounded-md border border-emerald-200/80 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                    Installment Calculation Preview
                  </p>
                  <span className="text-[11px] text-emerald-800 font-mono">
                    {form.noOfInstallments} monthly cycle(s)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-3 text-center">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500">Accrued Interest</p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-900 font-mono">
                      NPR {computed.totalInterest.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-500">Total Payable</p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-900 font-mono">
                      NPR {computed.totalPayable.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-800">Monthly Deduction</p>
                    <p className="text-base font-bold tabular-nums text-emerald-950 font-mono">
                      NPR {computed.installment.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </form>
    </Dialog>
  );
}

function FormSection({
  title,
  description,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-3", !isFirst && "pt-5 border-t border-zinc-200")}>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
