"use client";

import { useState } from "react";
import { X, Save, AlertCircle, Edit3 } from "lucide-react";
import type { PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";

interface PayslipDetailModalProps {
  slip: PayrollSlip;
  heads: PayrollSlipHead[];
  onClose: () => void;
  onOverride?: (headId: string, amount: string, reason: string) => Promise<void>;
  isEditable: boolean;
}

export function PayslipDetailModal({
  slip,
  heads,
  onClose,
  onOverride,
  isEditable
}: PayslipDetailModalProps) {
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [overrideAmount, setOverrideAmount] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const allowances = heads.filter((h) => h.headType === "allowance");
  const deductions = heads.filter((h) => h.headType === "deduction");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#d7e8d0] bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d7e8d0] bg-[#f6faf6] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#1b3a1f]">{slip.employeeName}</h2>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
              Code: {slip.employeeCode} · {slip.departmentName} · {slip.designationName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#d7e8d0]/60 hover:text-[#1b3a1f]"
          >
            <X className="h-4 w-4" />
          </button>
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
          <div className="grid gap-3 grid-cols-3 rounded-xl bg-[#f6faf6] border border-[#d7e8d0] p-4 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Gross Earnings</p>
              <p className="text-sm font-bold text-[#1b3a1f] mt-1 tabular-nums">
                Rs. {Number(slip.grossEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-x border-[#d7e8d0]">
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
          <div className="rounded-xl border border-[#d7e8d0] bg-[#f6faf6] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-[#1b3a1f] uppercase tracking-wider">Bank Transfer Info</h4>
              {isEditable && onOverride && editingHeadId !== "bank-details" && (
                <button
                  onClick={() => {
                    setEditingHeadId("bank-details");
                    setOverrideAmount(slip.bankName);
                    setOverrideReason(slip.bankAccountNumber);
                    setError(null);
                  }}
                  className="text-xs text-[#2e7d32] font-bold hover:underline"
                >
                  Edit Bank Info
                </button>
              )}
            </div>

            {editingHeadId === "bank-details" ? (
              <div className="space-y-3 mt-1.5 bg-white p-3.5 rounded-lg border border-[#d7e8d0]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
                      placeholder="Bank Name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Account Number</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
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
                    className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]"
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
                  <span className="font-semibold text-[#1b3a1f]">{slip.bankName}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium font-sans">Account Number:</span>{" "}
                  <span className="font-semibold text-[#1b3a1f] tabular-nums">{slip.bankAccountNumber}</span>
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
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-[#d7e8d0]">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Basic Salary</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Basic Salary"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("basic-salary")} disabled={isSaving} className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs font-semibold text-[#1b3a1f]">
                      <span>Basic Salary</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">Rs. {Number(slip.basicSalary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {isEditable && onOverride && (
                          <button onClick={() => { setEditingHeadId("basic-salary"); setOverrideAmount(slip.basicSalary); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-[#2e7d32] p-0.5">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Salary Grade */}
                <div className="border-b border-gray-100 pb-3">
                  {editingHeadId === "grade-amount" ? (
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-[#d7e8d0]">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Salary Grade</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Salary Grade"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("grade-amount")} disabled={isSaving} className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-xs font-semibold text-[#1b3a1f]">
                      <span>Salary Grade</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">Rs. {Number(slip.gradeAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {isEditable && onOverride && (
                          <button onClick={() => { setEditingHeadId("grade-amount"); setOverrideAmount(slip.gradeAmount); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-[#2e7d32] p-0.5">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Overtime Earned (OT) */}
                <div className="border-b border-gray-100 pb-3">
                  {editingHeadId === "ot-amount" ? (
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-[#d7e8d0]">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Overtime Earned (OT)</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="OT Amount"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("ot-amount")} disabled={isSaving} className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]">
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
                          <button onClick={() => { setEditingHeadId("ot-amount"); setOverrideAmount(slip.otAmount); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-[#2e7d32] p-0.5">
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
                          className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
                          placeholder="Amount"
                        />
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
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
                            className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]"
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
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold">Rs. {Number(head.calculatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          {isEditable && onOverride && (
                            <button
                              onClick={() => startEdit(head)}
                              className="text-gray-400 hover:text-[#2e7d32] p-0.5"
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
                    <div className="space-y-2 mt-1 bg-gray-50 p-2.5 rounded border border-[#d7e8d0]">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase block">Absent/Leave Deduction</label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Absent Deduction Amount"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full rounded border border-[#d7e8d0] bg-white px-2 py-1.5 text-xs text-[#1b3a1f]"
                        placeholder="Override Justification"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded hover:bg-gray-100">Cancel</button>
                        <button onClick={() => handleSave("absent-deduction")} disabled={isSaving} className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]">
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
                          <button onClick={() => { setEditingHeadId("absent-deduction"); setOverrideAmount(slip.absentDeduction); setOverrideReason("Manual Override"); setError(null); }} className="text-gray-400 hover:text-[#2e7d32] p-0.5">
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
                          className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
                          placeholder="Amount"
                        />
                        <input
                          type="text"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="w-full rounded border border-[#d7e8d0] px-2 py-1.5 text-xs text-[#1b3a1f]"
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
                            className="inline-flex items-center gap-1 bg-[#2e7d32] text-white px-2.5 py-1 text-[10px] font-semibold rounded hover:bg-[#1b3a1f]"
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
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold text-red-600">Rs. {Number(head.calculatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          {isEditable && onOverride && (
                            <button
                              onClick={() => startEdit(head)}
                              className="text-gray-400 hover:text-[#2e7d32] p-0.5"
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
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#d7e8d0] px-6 py-4 bg-[#f6faf6]">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#d7e8d0] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1b3a1f] hover:bg-[#d7e8d0]/20"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
}
