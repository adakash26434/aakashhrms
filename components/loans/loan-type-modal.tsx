"use client";

import { useState } from "react";
import type {
  LoanTypeFormData,
  LoanTypeValidationErrors,
} from "@/lib/types/loan";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LoanTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: LoanTypeFormData) => Promise<void>;
  initialData?: {
    id: string;
    name: string;
    maxAmount: number;
    maxInstallments: number;
    interestRate: number;
    isActive: boolean;
  } | null;
  validationErrors?: LoanTypeValidationErrors;
}

export function LoanTypeModal({
  open,
  onClose,
  onSave,
  initialData,
  validationErrors,
}: LoanTypeModalProps) {
  const isEditing = !!initialData;
  const [form, setForm] = useState<LoanTypeFormData>({
    name: initialData?.name || "",
    maxAmount: initialData?.maxAmount || 0,
    maxInstallments: initialData?.maxInstallments || 0,
    interestRate: initialData?.interestRate || 0,
    isActive: initialData?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(initialData?.id || null, form);
    setSaving(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      title={isEditing ? "Edit Loan Type" : "Add Loan Type"}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="loan-type-form" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </>
      }
    >
      <form id="loan-type-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="e.g., Vehicle Loan"
            />
            {validationErrors?.name && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.name}</p>
            )}
          </div>

          {/* Max Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Max Amount (Rs.) *</label>
            <input
              type="number"
              step="0.01"
              value={form.maxAmount || ""}
              onChange={(e) => setForm({ ...form, maxAmount: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="500000"
            />
            {validationErrors?.maxAmount && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.maxAmount}</p>
            )}
          </div>

          {/* Max Installments */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Max Installments *</label>
            <input
              type="number"
              value={form.maxInstallments || ""}
              onChange={(e) => setForm({ ...form, maxInstallments: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="24"
            />
            {validationErrors?.maxInstallments && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.maxInstallments}</p>
            )}
          </div>

          {/* Interest Rate */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Interest Rate (Flat %) *</label>
            <input
              type="number"
              step="0.01"
              value={form.interestRate || ""}
              onChange={(e) => setForm({ ...form, interestRate: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
              placeholder="5"
            />
            {validationErrors?.interestRate && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.interestRate}</p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-[#2e7d32] focus:ring-[#2e7d32]"
            />
            <label className="text-sm text-gray-700">Active</label>
          </div>

        </form>
    </Dialog>
  );
}
