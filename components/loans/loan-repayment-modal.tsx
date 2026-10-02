"use client";

import { useState, useEffect } from "react";
import type {
  Loan,
  RepaymentFormData,
  RepaymentValidationErrors,
} from "@/lib/types/loan";
import { getActiveLoansByEmployeeAction } from "@/app/actions/loan.actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoanRepaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: RepaymentFormData) => Promise<void>;
  employees: { id: string; name: string; code: string }[];
  validationErrors?: RepaymentValidationErrors;
}

export function LoanRepaymentModal({
  open,
  onClose,
  onSave,
  employees,
  validationErrors,
}: LoanRepaymentModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeLoans, setEmployeeLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState<RepaymentFormData>({
    loanId: "",
    amountPaid: 0,
    repaymentDate: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  // Fetch active loans when employee changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeLoans([]);
      setSelectedLoan(null);
      setForm((f) => ({ ...f, loanId: "" }));
      return;
    }
    getActiveLoansByEmployeeAction(selectedEmployeeId).then((res) => {
      if (res.success && res.data) {
        setEmployeeLoans(res.data);
      }
    });
  }, [selectedEmployeeId]);

  // Update selected loan details when loanId changes
  useEffect(() => {
    const loan = employeeLoans.find((l) => l.id === form.loanId) || null;
    setSelectedLoan(loan);
  }, [form.loanId, employeeLoans]);

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
      title="Record Cash Repayment"
      description="Log a manual employee loan installment or lump-sum settlement."
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {form.amountPaid > 0
              ? `Recording payment: NPR ${form.amountPaid.toLocaleString()}`
              : "Select active facility to settle"}
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
              form="repayment-form"
              disabled={saving || !form.loanId}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
            >
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="repayment-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Account & Active Facility */}
        <FormSection
          title="Account & Active Facility"
          description="Choose the staff member and specify which active lending account to credit."
          isFirst
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Staff Member <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Target Loan Facility <span className="text-red-500">*</span>
              </label>
              <select
                value={form.loanId}
                onChange={(e) => setForm({ ...form, loanId: e.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                disabled={!selectedEmployeeId}
              >
                <option value="">-- Select Loan --</option>
                {employeeLoans.map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    {loan.loanTypeName} — NPR {loan.loanAmount.toLocaleString()} (Issued: {loan.givenDate})
                  </option>
                ))}
              </select>
              {validationErrors?.loanId && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.loanId}</p>
              )}
              {selectedEmployeeId && employeeLoans.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">No active loans found for this employee.</p>
              )}
            </div>

            {/* Loan Details (Read-Only Snapshot) */}
            {selectedLoan && (
              <div className="rounded-md border border-zinc-200/80 bg-zinc-50/50 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-300/60">
                  <span className="text-xs font-semibold text-zinc-900">
                    Facility Ledger Snapshot
                  </span>
                  <span className="text-2xs text-zinc-500 font-mono">
                    Disbursed: {selectedLoan.givenDate}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-3 text-center">
                  <div>
                    <p className="text-2xs font-medium text-zinc-500">Disbursed Principal</p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-900 font-mono">
                      NPR {selectedLoan.loanAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium text-zinc-500">Total Cleared</p>
                    <p className="text-sm font-semibold tabular-nums text-payroll-primary font-mono">
                      NPR {selectedLoan.totalReturned.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium text-zinc-500">Outstanding Balance</p>
                    <p className="text-sm font-semibold tabular-nums text-amber-900 font-mono">
                      NPR {selectedLoan.remainingAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>

        {/* Section 2: Payment Particulars */}
        <FormSection
          title="Payment Particulars"
          description="Enter the amount deposited and the settlement execution date."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Amount Paid (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.amountPaid || ""}
                onChange={(e) =>
                  setForm({ ...form, amountPaid: parseFloat(e.target.value) || 0 })
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                placeholder="20000"
              />
              {validationErrors?.amountPaid && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.amountPaid}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.repaymentDate}
                onChange={(e) =>
                  setForm({ ...form, repaymentDate: e.target.value })
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
              />
              {validationErrors?.repaymentDate && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.repaymentDate}</p>
              )}
            </div>
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
