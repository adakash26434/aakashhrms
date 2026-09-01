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
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="repayment-form" disabled={saving || !form.loanId}>
            {saving ? "Recording..." : "Record Payment"}
          </Button>
        </>
      }
    >
      <form id="repayment-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Employee */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Employee *</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.code})
                </option>
              ))}
            </select>
          </div>

          {/* Loan Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Select Loan *</label>
            <select
              value={form.loanId}
              onChange={(e) => setForm({ ...form, loanId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              disabled={!selectedEmployeeId}
            >
              <option value="">-- Select Loan --</option>
              {employeeLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.loanTypeName} — Rs. {loan.loanAmount.toLocaleString()} (Given: {loan.givenDate})
                </option>
              ))}
            </select>
            {validationErrors?.loanId && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.loanId}</p>
            )}
            {selectedEmployeeId && employeeLoans.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">No active loans found for this employee.</p>
            )}
          </div>

          {/* Loan Details (Read-Only) */}
          {selectedLoan && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[11px] text-gray-500">Loan Taken</p>
                  <p className="text-sm font-semibold tabular-nums text-[#1b3a1f]">
                    Rs. {selectedLoan.loanAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Returned Till</p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-600">
                    Rs. {selectedLoan.totalReturned.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Remaining Loan</p>
                  <p className="text-sm font-semibold tabular-nums text-red-500">
                    Rs. {selectedLoan.remainingAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cash Paid */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cash Paid (Rs.) *</label>
            <input
              type="number"
              step="0.01"
              value={form.amountPaid || ""}
              onChange={(e) => setForm({ ...form, amountPaid: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="20000"
            />
            {validationErrors?.amountPaid && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.amountPaid}</p>
            )}
          </div>

          {/* Returned Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Returned Date *</label>
            <input
              type="date"
              value={form.repaymentDate}
              onChange={(e) => setForm({ ...form, repaymentDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
            />
            {validationErrors?.repaymentDate && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.repaymentDate}</p>
            )}
          </div>

        </form>
    </Dialog>
  );
}
