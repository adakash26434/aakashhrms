"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
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
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <DataSaveButton
            onClick={handleSave}
            isSaving={saving}
            label={ruleRecord ? "Save Settings" : "Create Rule"}
          />
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Linked Leave Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Associated Leave Policy <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.leaveTypeId}
              disabled={isStatutory || !!ruleRecord}
              onChange={(e) => handleChange("leaveTypeId", e.target.value)}
              className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Select policy type</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            {errors.leaveTypeId && (
              <p className="mt-1 text-xs text-red-500">{errors.leaveTypeId}</p>
            )}
          </div>

          {/* Rule Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Rule Identifier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ruleName}
              disabled={isStatutory}
              onChange={(e) => handleChange("ruleName", e.target.value)}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] placeholder-gray-400 outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="e.g. Home Leave Accrual"
            />
            {errors.ruleName && (
              <p className="mt-1 text-xs text-red-500">{errors.ruleName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Accrual Method */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Accrual Generation Method <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.accrualMethod}
              disabled={isStatutory}
              onChange={(e) => handleChange("accrualMethod", e.target.value as AccrualMethod)}
              className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="FIXED_ANNUAL">Fixed Annual Allotment</option>
              <option value="DAYS_WORKED">Accrual per Days Worked</option>
              <option value="MONTHLY_ACCRUAL">Monthly Accrual Accumulation</option>
            </select>
            {errors.accrualMethod && (
              <p className="mt-1 text-xs text-red-500">{errors.accrualMethod}</p>
            )}
          </div>

          {/* Accrual Value */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Accrual Rate / Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              disabled={isStatutory}
              value={formData.accrualValue}
              onChange={(e) => handleChange("accrualValue", parseFloat(e.target.value) || 0)}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
              placeholder={
                formData.accrualMethod === "DAYS_WORKED"
                  ? "e.g. 20 (1 day per 20 days worked)"
                  : "e.g. 18 (annual total)"
              }
            />
            {errors.accrualValue && (
              <p className="mt-1 text-xs text-red-500">{errors.accrualValue}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Encashment Rate */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Encashment Rate Basis
            </label>
            <select
              value={formData.encashmentRate}
              disabled={isStatutory}
              onChange={(e) => handleChange("encashmentRate", e.target.value as EncashmentRate)}
              className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="BASIC_DAILY">Basic Salary / 30 (Nepal Standard)</option>
              <option value="FIXED_AMOUNT">Fixed Rate (NPR per day)</option>
            </select>
          </div>

          {/* Encashment Fixed Amount */}
          {formData.encashmentRate === "FIXED_AMOUNT" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
                Fixed Encashment Rate (NPR/day) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                disabled={isStatutory}
                value={formData.encashmentFixedAmount}
                onChange={(e) => handleChange("encashmentFixedAmount", parseFloat(e.target.value) || 0)}
                className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
              />
              {errors.encashmentFixedAmount && (
                <p className="mt-1 text-xs text-red-500">{errors.encashmentFixedAmount}</p>
              )}
            </div>
          )}
        </div>

        {/* Min Service Days & Status */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          {/* Min Service Days */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Min Service Days For Eligibility
            </label>
            <input
              type="number"
              min={0}
              disabled={isStatutory}
              value={formData.minServiceDaysForEligibility}
              onChange={(e) => handleChange("minServiceDaysForEligibility", parseInt(e.target.value) || 0)}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="e.g. 180"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Rule Status
            </label>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
                <input
                  type="radio"
                  name="isActive"
                  checked={formData.isActive === true}
                  onChange={() => handleChange("isActive", true)}
                  className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
                />
                <span className="text-sm text-emerald-700 font-medium">Active</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
                <input
                  type="radio"
                  name="isActive"
                  checked={formData.isActive === false}
                  onChange={() => handleChange("isActive", false)}
                  className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
                />
                <span className="text-sm text-gray-500 font-medium">Inactive</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
