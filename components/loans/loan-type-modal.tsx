"use client";

import { useState } from "react";
import type {
  LoanTypeFormData,
  LoanTypeValidationErrors,
} from "@/lib/types/loan";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      title={isEditing ? "Edit Loan Scheme" : "New Loan Scheme"}
      description={
        isEditing
          ? "Update terms, ceiling limits, and interest rates for this scheme."
          : "Define lending scheme rules, ceiling caps, and interest requirements."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEditing ? `Editing: ${form.name || "Loan Scheme"}` : "New loan configuration"}
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
              form="loan-type-form"
              disabled={saving}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Scheme"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="loan-type-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Loan Identity */}
        <FormSection
          title="Scheme Identity"
          description="Designate the scheme title and its current operational availability."
          isFirst
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Scheme Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder="e.g., Staff Vehicle Loan"
              />
              {validationErrors?.name && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Operational Status
              </label>
              <div className="flex items-center gap-3">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    form.isActive
                      ? "border-emerald-700 bg-emerald-50/50 text-emerald-900"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <input
                    type="radio"
                    name="loan-type-active"
                    checked={form.isActive}
                    onChange={() => setForm({ ...form, isActive: true })}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      form.isActive ? "bg-emerald-600" : "bg-zinc-300"
                    )}
                  />
                  Active Scheme
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    !form.isActive
                      ? "border-zinc-800 bg-zinc-50 text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <input
                    type="radio"
                    name="loan-type-active"
                    checked={!form.isActive}
                    onChange={() => setForm({ ...form, isActive: false })}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      !form.isActive ? "bg-zinc-700" : "bg-zinc-300"
                    )}
                  />
                  Inactive
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 2: Financial Thresholds */}
        <FormSection
          title="Financial Thresholds"
          description="Define the maximum lending principal, installment tenure limits, and annual interest rate."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Max Principal (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.maxAmount || ""}
                onChange={(e) =>
                  setForm({ ...form, maxAmount: parseFloat(e.target.value) || 0 })
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder="500000"
              />
              {validationErrors?.maxAmount && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.maxAmount}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Max Installments <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.maxInstallments || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxInstallments: parseInt(e.target.value) || 0,
                  })
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder="24"
              />
              {validationErrors?.maxInstallments && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.maxInstallments}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Interest Rate (Flat %) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.interestRate || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    interestRate: parseFloat(e.target.value) || 0,
                  })
                }
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder="5.0"
              />
              {validationErrors?.interestRate && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.interestRate}
                </p>
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
