"use client";

import { useState } from "react";
import { X, Save, AlertCircle, Edit3, Plus, RefreshCw } from "lucide-react";
import type { PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";

interface PayslipDetailModalProps {
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
  onClose: () => void;
  onOverride?: (headId: string, amount: string, reason: string) => Promise<void>;
  onRecalculate?: () => Promise<void>;
  onAddHead?: (payHeadId: string, amount: string, reason: string) => Promise<void>;
  allPayHeads?: Array<{ id: string; name: string; code: string; type: 'allowance' | 'deduction' }>;
  isEditable: boolean;
}

export function PayslipDetailModal({
  slip,
  heads,
  onClose,
  onOverride,
  onRecalculate,
  onAddHead,
  allPayHeads,
  isEditable
}: PayslipDetailModalProps) {
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [overrideAmount, setOverrideAmount] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Add pay head form state
  const [isAddingHead, setIsAddingHead] = useState(false);
  const [newHeadId, setNewHeadId] = useState("");
  const [newHeadAmount, setNewHeadAmount] = useState("");
  const [newHeadReason, setNewHeadReason] = useState("");
  const [isSubmittingHead, setIsSubmittingHead] = useState(false);

  const allowances = heads.filter((h) => h.headType === "allowance");
  const deductions = heads.filter((h) => h.headType === "deduction");
  const existingHeadIds = new Set(heads.map((h) => h.payHeadId));
  const availablePayHeads = (allPayHeads || []).filter((ph) => !existingHeadIds.has(ph.id));

  const startEdit = (head: PayrollSlipHead) => {
    setEditingHeadId(head.payHeadId);
    setOverrideAmount(head.amount);
    setOverrideReason(head.overrideReason || "");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingHeadId(null);
  };

  const handleSave = async (headId: string) => {
    if (!onOverride) return;
    setError(null);

    const val = Number(overrideAmount);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid non-negative amount.");
      return;
    }

    if (!overrideReason.trim()) {
      setError("Please enter a justification for overriding this value.");
      return;
    }

    try {
      setIsSaving(true);
      await onOverride(headId, overrideAmount, overrideReason);
      setEditingHeadId(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to update override.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!onRecalculate) return;
    setError(null);
    try {
      setIsRecalculating(true);
      await onRecalculate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to recalculate payslip.");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleAddHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddHead) return;
    setError(null);

    if (!newHeadId) {
      setError("Please select a pay head to add.");
      return;
    }
    if (existingHeadIds.has(newHeadId)) {
      setError("This pay head is already added to this employee's payslip.");
      return;
    }
    const val = Number(newHeadAmount);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!newHeadReason.trim()) {
      setError("Please enter a reason or justification for adding this allowance/deduction.");
      return;
    }

    try {
      setIsSubmittingHead(true);
      await onAddHead(newHeadId, newHeadAmount, newHeadReason.trim());
      setIsAddingHead(false);
      setNewHeadId("");
      setNewHeadAmount("");
      setNewHeadReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add pay head to payslip.");
    } finally {
      setIsSubmittingHead(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-payroll-light bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-payroll-light bg-payroll-cream px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-payroll-navy">{slip.employeeName}</h2>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
              Code: {slip.employeeCode} · {slip.departmentName} · {slip.designationName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditable && onRecalculate && (
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={isRecalculating}
                title="Re-pull latest master salary mapping, pay heads, and attendance"
                className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-primary bg-white px-3 py-1.5 text-xs font-semibold text-payroll-primary shadow-sm hover:bg-payroll-primary hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? "Syncing..." : "Sync from Master"}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-payroll-light/60 hover:text-payroll-navy"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {slip.warnings && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 animate-[fadeIn_150ms_ease-out]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">Nepal Labour Act OT Compliance Warnings:</p>
                <p className="leading-relaxed font-semibold text-amber-800">
                  {slip.warnings}
                </p>
              </div>
            </div>
          )}

          {/* Quick Summary Grid */}
          <div className="grid gap-3 grid-cols-3 rounded-xl bg-payroll-cream border border-payroll-light p-4 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Gross Earnings</p>
              <p className="text-sm font-bold text-payroll-navy mt-1 tabular-nums">
                Rs. {Number(slip.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-x border-payroll-light">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Deductions</p>
              <p className="text-sm font-bold text-red-600 mt-1 tabular-nums">
                Rs. {Number(slip.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Net Payable</p>
              <p className="text-sm font-bold text-emerald-600 mt-1 tabular-nums">
                Rs. {Number(slip.netPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Bank details & Payment Details */}
          <div className="rounded-xl border border-payroll-light bg-payroll-cream p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">Bank Transfer Info</h4>
              {isEditable && onOverride && editingHeadId !== "bank-details" && (
                <button
                  onClick={() => {
                    setEditingHeadId("bank-details");
                    setOverrideAmount(slip.bankName);
                    setOverrideReason(slip.bankAccountNumber);
                    setError(null);
                  }}
                  className="text-xs text-payroll-primary font-bold hover:underline"
                >
                  Edit Bank Info
                </button>
              )}
            </div>

            {editingHeadId === "bank-details" ? (
              <div className="space-y-3 mt-1.5 bg-white p-3.5 rounded-lg border border-payroll-light">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                      placeholder="Bank Name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Account Number</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                      placeholder="Account Number"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 justify-end mt-2">
                  <button
                    onClick={cancelEdit}
                    className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!onOverride) return;
                      if (!overrideAmount.trim() || !overrideReason.trim()) {
                        setError("Both Bank Name and Account Number are required.");
                        return;
                      }
                      try {
                        setIsSaving(true);
                        await onOverride!("bank-details", `${overrideAmount.trim()}||${overrideReason.trim()}`, "Updated Bank details");
                        setEditingHeadId(null);
                      } catch (error: unknown) {
                        setError(error instanceof Error ? error.message : "Failed to update bank details.");
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy"
                  >
                    <Save className="h-3 w-3" />
                    Save Bank Info
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 text-xs">
                <div>
                  <span className="text-gray-400 font-medium font-sans">Bank Name:</span>{" "}
                  <span className="font-semibold text-payroll-navy">{slip.bankName}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium font-sans">Account Number:</span>{" "}
                  <span className="font-semibold text-payroll-navy tabular-nums">{slip.bankAccountNumber}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Allowances Column */}
            <div>
              <h3 className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md uppercase tracking-wider mb-3">Allowances & Earnings</h3>
              <div className="space-y-3.5">
                {/* Basic Salary */}
                <div className="border-b border-gray-100 pb-3">
                  {editingHeadId === "basic-salary" ? (
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-payroll-light">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Basic Salary</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="Basic Salary"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("basic-salary")} disabled={isSaving} className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs font-semibold text-payroll-navy">
                      <span>Basic Salary</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">Rs. {Number(slip.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {isEditable && onOverride && (
                          <button onClick={() => { setEditingHeadId("basic-salary"); setOverrideAmount(slip.basicSalary); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-payroll-primary p-0.5">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Salary Grade */}
                {(Number(slip.gradeAmount || 0) > 0 || editingHeadId === "grade-amount") && (
                  <div className="border-b border-gray-100 pb-3">
                    {editingHeadId === "grade-amount" ? (
                      <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-payroll-light">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block">Salary Grade</label>
                        <input
                          type="number"
                          value={overrideAmount}
                          onChange={(e) => setOverrideAmount(e.target.value)}
                          className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Salary Grade"
                        />
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Override Justification"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                          <button onClick={() => handleSave("grade-amount")} disabled={isSaving} className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy">
                            <Save className="h-3 w-3" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs font-semibold text-payroll-navy">
                        <span>Salary Grade</span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">Rs. {Number(slip.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          {isEditable && onOverride && (
                            <button onClick={() => { setEditingHeadId("grade-amount"); setOverrideAmount(slip.gradeAmount); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-payroll-primary p-0.5">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Overtime Earned (OT) */}
                <div className="border-b border-gray-100 pb-3">
                  {editingHeadId === "ot-amount" ? (
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-payroll-light">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Overtime Earned (OT)</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="OT Amount"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("ot-amount")} disabled={isSaving} className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs text-gray-600 font-medium">
                      <span>Overtime Earned (OT)</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">Rs. {Number(slip.otAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {isEditable && onOverride && (
                          <button onClick={() => { setEditingHeadId("ot-amount"); setOverrideAmount(slip.otAmount); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-payroll-primary p-0.5">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {allowances.map((head) => (
                  <div key={head.payHeadId} className="border-b border-gray-100 pb-3">
                    {editingHeadId === head.payHeadId ? (
                      <div className="space-y-2 mt-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block">{head.payHeadName}</label>
                        <input
                          type="number"
                          value={overrideAmount}
                          onChange={(e) => setOverrideAmount(e.target.value)}
                          className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Amount"
                        />
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Override Justification/Reason"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(head.payHeadId)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy"
                          >
                            <Save className="h-3 w-3" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{head.payHeadName}</span>
                          {head.isManualOverride && (
                            <span className="ml-1.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] text-amber-700">Overridden</span>
                          )}
                          {head.payHeadName.toLowerCase().includes("ssf") && head.payHeadName.toLowerCase().includes("employer") && (
                            <span className="block text-[10px] text-gray-400">Employer non-cash benefit deposited to SSF (20%)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold">Rs. {Number(head.calculatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          {isEditable && onOverride && (
                            <button
                              onClick={() => startEdit(head)}
                              className="text-gray-400 hover:text-payroll-primary p-0.5"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Column */}
            <div>
              <h3 className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-md uppercase tracking-wider mb-3">Deductions</h3>
              <div className="space-y-3.5">
                {/* Absent/Leave Deduction */}
                <div className="border-b border-gray-100 pb-3">
                  {editingHeadId === "absent-deduction" ? (
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-payroll-light">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Absent/Leave Deduction</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="Absent Deduction Amount"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-payroll-light bg-white px-2 py-1.5 text-xs text-payroll-navy"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("absent-deduction")} disabled={isSaving} className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs text-gray-600 font-medium">
                      <span>Absent/Leave Deduction</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-red-600">Rs. {Number(slip.absentDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {isEditable && onOverride && (
                          <button onClick={() => { setEditingHeadId("absent-deduction"); setOverrideAmount(slip.absentDeduction); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-payroll-primary p-0.5">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Loan Deduction */}
                <div className="flex justify-between items-center text-xs text-gray-600 font-medium border-b border-gray-100 pb-3">
                  <span>Loan Deduction</span>
                  <span className="tabular-nums text-red-600 font-semibold">Rs. {Number(slip.loanDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                {deductions.map((head) => (
                  <div key={head.payHeadId} className="border-b border-gray-100 pb-3">
                    {editingHeadId === head.payHeadId ? (
                      <div className="space-y-2 mt-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase block">{head.payHeadName}</label>
                        <input
                          type="number"
                          value={overrideAmount}
                          onChange={(e) => setOverrideAmount(e.target.value)}
                          className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Amount"
                        />
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full rounded border border-payroll-light px-2 py-1.5 text-xs text-payroll-navy"
                          placeholder="Override Justification/Reason"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(head.payHeadId)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 bg-payroll-primary text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-payroll-navy"
                          >
                            <Save className="h-3 w-3" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <div>
                          <span className="font-medium">{head.payHeadName}</span>
                          {head.isManualOverride && (
                            <span className="ml-1.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] text-amber-700">Overridden</span>
                          )}
                          {(head.payHeadName.toLowerCase().includes("ssf") || head.payHeadName.toLowerCase().includes("social security fund")) && (
                            <span className="block text-[10px] text-gray-400">
                              {Number(slip.ssfEmployee) > 0 && Number(slip.ssfEmployer) > 0
                                ? `EE 11% (Rs. ${Number(slip.ssfEmployee).toLocaleString("en-IN", { minimumFractionDigits: 2 })}) + ER 20% (Rs. ${Number(slip.ssfEmployer).toLocaleString("en-IN", { minimumFractionDigits: 2 })})`
                                : "Total 31% SSF Deposit (11% Employee + 20% Employer)"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold text-red-600">Rs. {Number(head.calculatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          {isEditable && onOverride && (
                            <button
                              onClick={() => startEdit(head)}
                              className="text-gray-400 hover:text-payroll-primary p-0.5"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Missed Allowance/Deduction Addition Section */}
          {isEditable && onAddHead && (
            <div className="rounded-xl border border-dashed border-payroll-light p-4 bg-payroll-cream/60">
              {!isAddingHead ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-payroll-navy">Missed an Allowance or Deduction?</h4>
                    <p className="text-[11px] text-gray-500">Attach any company pay head to this employee's payslip and automatically recalculate progressive taxes.</p>
                  </div>
                  {availablePayHeads.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingHead(true)}
                      className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-payroll-primary bg-white px-3 py-1.5 text-xs font-semibold text-payroll-primary shadow-sm hover:bg-payroll-primary hover:text-white transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      + Add Pay Head
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">
                      All company pay heads are already added
                    </span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddHeadSubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-payroll-navy">Add Pay Head to Payslip</h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingHead(false)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Pay Head</label>
                      <select
                        value={newHeadId}
                        onChange={(e) => setNewHeadId(e.target.value)}
                        className="w-full rounded-lg border border-payroll-light bg-white px-2.5 py-1.5 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
                      >
                        <option value="">-- Select Pay Head --</option>
                        {availablePayHeads.map((ph) => (
                          <option key={ph.id} value={ph.id}>
                            {ph.name} ({ph.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Amount (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newHeadAmount}
                        onChange={(e) => setNewHeadAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full rounded-lg border border-payroll-light bg-white px-2.5 py-1.5 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Reason / Justification</label>
                      <input
                        type="text"
                        value={newHeadReason}
                        onChange={(e) => setNewHeadReason(e.target.value)}
                        placeholder="e.g. Missed in salary mapping"
                        className="w-full rounded-lg border border-payroll-light bg-white px-2.5 py-1.5 text-xs text-payroll-navy outline-none focus:border-payroll-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingHead(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingHead}
                      className="inline-flex items-center gap-1.5 bg-payroll-primary text-white px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-sm hover:bg-payroll-navy disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSubmittingHead ? "Adding..." : "Add & Recalculate"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-payroll-light px-6 py-4 bg-payroll-cream">
          <button
            onClick={onClose}
            className="rounded-lg border border-payroll-light bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-payroll-navy hover:bg-payroll-light/20"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
}
