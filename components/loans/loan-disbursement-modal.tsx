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
      description="Issue a new loan to an employee"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="disburse-form" disabled={saving}>
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {saving ? "Disbursing..." : "Disburse Loan"}
          </Button>
        </>
      }
    >
      <form id="disburse-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Employee — full width */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Employee <span className="text-red-400">*</span>
          </label>
          <select
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          >
            <option value="">Select an employee...</option>
            {lookupData?.employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.code})
              </option>
            ))}
          </select>
          {validationErrors?.employeeId && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.employeeId}</p>
          )}
        </div>

        {/* Loan Type — full width */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Loan Type <span className="text-red-400">*</span>
          </label>
          <select
            value={form.loanTypeId}
            onChange={(e) => setForm({ ...form, loanTypeId: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          >
            <option value="">Select loan type...</option>
            {lookupData?.loanTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name} ({lt.interestRate}% interest)
              </option>
            ))}
          </select>
          {validationErrors?.loanTypeId && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.loanTypeId}</p>
          )}
        </div>

        {/* Loan Amount, Interest Rate display, Tenure — 3 columns */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Principal (Rs.) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.loanAmount || ""}
              onChange={(e) => setForm({ ...form, loanAmount: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="0"
            />
            {validationErrors?.loanAmount && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.loanAmount}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Interest Rate (%)
            </label>
            <input
              type="text"
              value={selectedLoanType ? `${selectedLoanType.interestRate}%` : "—"}
              readOnly
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tenure (Months) <span className="text-red-400">*</span>
              {selectedLoanType && selectedLoanType.maxInstallments > 0 && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (Max: {selectedLoanType.maxInstallments})
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="0"
            />
            {validationErrors?.noOfInstallments && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.noOfInstallments}</p>
            )}
          </div>
        </div>

        {/* Disbursed Date — full width */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Disbursed Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={form.givenDate}
            onChange={(e) => setForm({ ...form, givenDate: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          />
          {validationErrors?.givenDate && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.givenDate}</p>
          )}
        </div>

        {/* Dynamic Calculator Display */}
        {computed.installment > 0 && (
          <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#2e7d32]">
              Installment Preview
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] text-gray-500">Interest</p>
                <p className="text-sm font-semibold tabular-nums text-[#1b3a1f]">
                  Rs. {computed.totalInterest.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Total Payable</p>
                <p className="text-sm font-semibold tabular-nums text-[#1b3a1f]">
                  Rs. {computed.totalPayable.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Monthly Installment</p>
                <p className="text-lg font-bold tabular-nums text-[#2e7d32]">
                  Rs. {computed.installment.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}
