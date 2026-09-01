"use client";

import { useCallback, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import type {
  OtRule,
  OtRuleFormData,
  OtRuleType,
  OtRuleValidationErrors,
} from "@/lib/types/ot-rule";
import { validateOtRuleForm } from "@/lib/engines/ot-rule.engine";

interface OtRuleFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: OtRuleFormData) => Promise<void>;
  rule: OtRule | null;
}

export function OtRuleFormModal({
  open,
  onClose,
  onSave,
  rule,
}: OtRuleFormModalProps) {
  const [ruleType, setRuleType] = useState<OtRuleType>(() => rule?.ruleType || "Hourly");
  const [ruleName, setRuleName] = useState(() => rule?.ruleName || "");
  const [rateOfficeDay, setRateOfficeDay] = useState(() => (rule ? String(rule.rateOfficeDay) : ""));
  const [rateOffDay, setRateOffDay] = useState(() => (rule ? String(rule.rateOffDay) : ""));
  const [isActive, setIsActive] = useState<boolean>(true);
  const [errors, setErrors] = useState<OtRuleValidationErrors>({});
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setRuleType(rule?.ruleType || "Hourly");
    setRuleName(rule?.ruleName || "");
    setRateOfficeDay(rule ? String(rule.rateOfficeDay) : "");
    setRateOffDay(rule ? String(rule.rateOffDay) : "");
    setIsActive(rule?.isActive ?? true);
    setErrors({});
  }, [rule]);

  async function handleSave() {
    const formData: OtRuleFormData = {
      ruleType,
      ruleName: ruleName.trim(),
      rateOfficeDay: Number(rateOfficeDay),
      rateOffDay: Number(rateOffDay),
      isActive,
    };

    const validationErrors = validateOtRuleForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(rule?.id || null, formData);
      onClose();
    } catch {
      // Error handled upstream
    } finally {
      setSaving(false);
    }
  }

  const rateLabel = ruleType === "Hourly" ? "Rate (NPR / hour)" : "Rate (NPR / day)";

  return (
    <Dialog
      open={open}
      onClose={() => { resetForm(); onClose(); }}
      title={rule ? "Edit OT Rule" : "New OT Rule"}
      description={rule ? "Update the overtime rule details below." : "Create a new overtime rule for the organization."}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
          <DataSaveButton
            onClick={handleSave}
            isSaving={saving}
            label={rule ? "Update Rule" : "Create Rule"}
          />
        </>
      }
    >
      <div className="space-y-5">
        {/* Rule Name */}
        <div>
          <label
            htmlFor="ot-rule-name"
            className="mb-1.5 block text-sm font-medium text-[#1b3a1f]"
          >
            Rule Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ot-rule-name"
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] placeholder-gray-400 outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20"
            placeholder="e.g. Normal Overtime"
          />
          {errors.ruleName && (
            <p className="mt-1 text-xs text-red-500">{errors.ruleName}</p>
          )}
        </div>

        {/* Rule Type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
            Rule Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2.5 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
              <input
                type="radio"
                name="ot-rule-type"
                value="Hourly"
                checked={ruleType === "Hourly"}
                onChange={() => setRuleType("Hourly")}
                className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm text-gray-700">Hourly Rate</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2.5 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
              <input
                type="radio"
                name="ot-rule-type"
                value="Fixed"
                checked={ruleType === "Fixed"}
                onChange={() => setRuleType("Fixed")}
                className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm text-gray-700">Fixed Amount</span>
            </label>
          </div>
        </div>

        {/* Office Day Rate */}
        <div>
          <label
            htmlFor="ot-rate-office"
            className="mb-1.5 block text-sm font-medium text-[#1b3a1f]"
          >
            {rateLabel} — Office Day <span className="text-red-500">*</span>
          </label>
          <input
            id="ot-rate-office"
            type="number"
            min={0}
            step={ruleType === "Hourly" ? 0.5 : 1}
            value={rateOfficeDay}
            onChange={(e) => setRateOfficeDay(e.target.value)}
            className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20"
            placeholder={ruleType === "Hourly" ? "e.g. 1.5" : "e.g. 500"}
          />
          {errors.rateOfficeDay && (
            <p className="mt-1 text-xs text-red-500">{errors.rateOfficeDay}</p>
          )}
        </div>

        {/* Off Day Rate */}
        <div>
          <label
            htmlFor="ot-rate-off"
            className="mb-1.5 block text-sm font-medium text-[#1b3a1f]"
          >
            {rateLabel} — Off Day <span className="text-red-500">*</span>
          </label>
          <input
            id="ot-rate-off"
            type="number"
            min={0}
            step={ruleType === "Hourly" ? 0.5 : 1}
            value={rateOffDay}
            onChange={(e) => setRateOffDay(e.target.value)}
            className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20"
            placeholder={ruleType === "Hourly" ? "e.g. 2.0" : "e.g. 800"}
          />
          {errors.rateOffDay && (
            <p className="mt-1 text-xs text-red-500">{errors.rateOffDay}</p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
            Status
          </label>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2.5 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
              <input
                type="radio"
                name="ot-rule-status"
                value="active"
                checked={isActive === true}
                onChange={() => setIsActive(true)}
                className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm text-emerald-700 font-medium">Active</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#d7e8d0] px-4 py-2.5 transition-colors hover:bg-[#f6faf6] has-checked:border-[#2e7d32] has-checked:bg-[#f6faf6]">
              <input
                type="radio"
                name="ot-rule-status"
                value="inactive"
                checked={isActive === false}
                onChange={() => setIsActive(false)}
                className="text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm text-gray-500 font-medium">Inactive</span>
            </label>
          </div>
        </div>
      </div>
    </Dialog>
  );
}