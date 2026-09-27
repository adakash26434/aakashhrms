"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import { cn } from "@/lib/utils";
import type {
  LeaveRule,
  LeaveRuleFormData,
  AccrualMethod,
  EncashmentRate,
  LeaveRuleValidationErrors,
} from "@/lib/types/leave-rule";
import { validateLeaveRuleForm } from "@/lib/engines/leave-rule.engine";

interface LeaveRuleFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: LeaveRuleFormData) => Promise<void>;
  ruleRecord: LeaveRule | null;
  leaveTypes: { id: string; name: string; code: string }[];
}

const DEFAULT_FORM: LeaveRuleFormData = {
  leaveTypeId: "",
  fiscalYearId: "", // Empty string = global
  ruleName: "",
  ruleCategory: "COMPANY",
  accrualMethod: "FIXED_ANNUAL",
  accrualValue: 12,
  encashmentRate: "BASIC_DAILY",
  encashmentFixedAmount: 0,
  minServiceDaysForEligibility: 0,
  isActive: true,
};

export function LeaveRuleFormModal({
  open,
  onClose,
  onSave,
  ruleRecord,
  leaveTypes,
}: LeaveRuleFormModalProps) {
  const [formData, setFormData] = useState<LeaveRuleFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<LeaveRuleValidationErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ruleRecord) {
      setFormData({
        leaveTypeId: ruleRecord.leaveTypeId,
        fiscalYearId: ruleRecord.fiscalYearId || "",
        ruleName: ruleRecord.ruleName,
        ruleCategory: ruleRecord.ruleCategory,
        accrualMethod: ruleRecord.accrualMethod,
        accrualValue: ruleRecord.accrualValue,
        encashmentRate: ruleRecord.encashmentRate,
        encashmentFixedAmount: ruleRecord.encashmentFixedAmount,
        minServiceDaysForEligibility: ruleRecord.minServiceDaysForEligibility,
        isActive: ruleRecord.isActive,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
    setErrors({});
  }, [ruleRecord, open]);

  const handleChange = (
    field: keyof LeaveRuleFormData,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const validationErrors = validateLeaveRuleForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(ruleRecord?.id || null, formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isStatutory = ruleRecord?.ruleCategory === "STATUTORY";

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
      }}
      title={
        ruleRecord
          ? isStatutory
            ? "Statutory Rule Settings"
            : "Edit Leave Rule"
          : "New Leave Rule"
      }
      description={
        ruleRecord
          ? isStatutory
            ? "Statutory leave rules mandated by Nepal Labour Act 2074 are read-only. Only status toggles are allowed."
            : "Modify corporate leave rule configuration."
          : "Create a custom accrual or encashment policy for leave types."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {ruleRecord ? `Editing: ${formData.ruleName || "Rule"}` : "New leave rule"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <DataSaveButton
              onClick={handleSave}
              isSaving={saving}
              label={ruleRecord ? "Save Settings" : "Create Rule"}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Rule Association */}
        <FormSection
          title="Rule Association"
          description="Link this rule to a specific policy and assign a descriptive identifier."
          isFirst
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Associated Leave Policy <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.leaveTypeId}
                disabled={isStatutory || Boolean(ruleRecord)}
                onChange={(e) => handleChange("leaveTypeId", e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="">Select policy type</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              {errors.leaveTypeId && (
                <p className="mt-1 text-xs text-red-600">{errors.leaveTypeId}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Rule Identifier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ruleName}
                disabled={isStatutory}
                onChange={(e) => handleChange("ruleName", e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                placeholder="e.g. Home Leave Accrual"
              />
              {errors.ruleName && (
                <p className="mt-1 text-xs text-red-600">{errors.ruleName}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Accrual Computation */}
        <FormSection
          title="Accrual Computation"
          description="Allotment schedule, accumulation logic, and annual generation value."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Accrual Generation Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.accrualMethod}
                disabled={isStatutory}
                onChange={(e) => handleChange("accrualMethod", e.target.value as AccrualMethod)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="FIXED_ANNUAL">Fixed Annual Allotment</option>
                <option value="DAYS_WORKED">Accrual per Days Worked</option>
                <option value="MONTHLY_ACCRUAL">Monthly Accrual Accumulation</option>
              </select>
              {errors.accrualMethod && (
                <p className="mt-1 text-xs text-red-600">{errors.accrualMethod}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Accrual Rate / Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                disabled={isStatutory}
                value={formData.accrualValue}
                onChange={(e) => handleChange("accrualValue", parseFloat(e.target.value) || 0)}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                placeholder={
                  formData.accrualMethod === "DAYS_WORKED"
                    ? "e.g. 20 (1 day per 20 days worked)"
                    : "e.g. 18 (annual total)"
                }
              />
              {errors.accrualValue && (
                <p className="mt-1 text-xs text-red-600">{errors.accrualValue}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 3: Encashment Basis */}
        <FormSection
          title="Encashment Basis"
          description="Rate calculation standard applied during leave liquidation."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Encashment Rate Basis
              </label>
              <select
                value={formData.encashmentRate}
                disabled={isStatutory}
                onChange={(e) => handleChange("encashmentRate", e.target.value as EncashmentRate)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="BASIC_DAILY">Basic Salary / 30 (Nepal Standard)</option>
                <option value="FIXED_AMOUNT">Fixed Rate (NPR per day)</option>
              </select>
            </div>

            {formData.encashmentRate === "FIXED_AMOUNT" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Fixed Encashment Rate (NPR/day) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={isStatutory}
                  value={formData.encashmentFixedAmount}
                  onChange={(e) => handleChange("encashmentFixedAmount", parseFloat(e.target.value) || 0)}
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                />
                {errors.encashmentFixedAmount && (
                  <p className="mt-1 text-xs text-red-600">{errors.encashmentFixedAmount}</p>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* Section 4: Eligibility & Status */}
        <FormSection
          title="Eligibility & Status"
          description="Probation service days threshold and operational status."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Min Service Days For Eligibility
              </label>
              <input
                type="number"
                min={0}
                disabled={isStatutory}
                value={formData.minServiceDaysForEligibility}
                onChange={(e) => handleChange("minServiceDaysForEligibility", parseInt(e.target.value) || 0)}
                className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400"
                placeholder="e.g. 180"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Rule Status
              </label>
              <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => handleChange("isActive", true)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    formData.isActive === true
                      ? "bg-emerald-700 text-white shadow-none"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("isActive", false)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    formData.isActive === false
                      ? "bg-zinc-800 text-white shadow-none"
                      : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
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
