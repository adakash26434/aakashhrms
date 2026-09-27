"use client";

import { useCallback, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import { cn } from "@/lib/utils";
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
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={rule ? "Edit Overtime Rule" : "New Overtime Rule"}
      description={
        rule
          ? "Update overtime multiplier benchmarks and applicability."
          : "Define an overtime policy with hourly or daily computation rates."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {rule ? `Editing: ${ruleName || "OT Rule"}` : "New overtime policy"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <DataSaveButton
              onClick={handleSave}
              isSaving={saving}
              label={rule ? "Update Rule" : "Create Rule"}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Rule Identification */}
        <FormSection
          title="Rule Identification"
          description="Name this policy and designate whether compensation is based on hourly units or flat daily sums."
          isFirst
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="ot-rule-name"
                className="mb-1.5 block text-xs font-semibold text-zinc-700"
              >
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                id="ot-rule-name"
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder="e.g. Standard Overtime"
              />
              {errors.ruleName && (
                <p className="mt-1 text-xs text-red-600">{errors.ruleName}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Computation Basis <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    ruleType === "Hourly"
                      ? "border-emerald-700 bg-emerald-50/50 text-emerald-900"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <input
                    type="radio"
                    name="ot-rule-type"
                    value="Hourly"
                    checked={ruleType === "Hourly"}
                    onChange={() => setRuleType("Hourly")}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ruleType === "Hourly" ? "bg-emerald-600" : "bg-zinc-300"
                    )}
                  />
                  Hourly Rate (NPR / hr)
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    ruleType === "Fixed"
                      ? "border-emerald-700 bg-emerald-50/50 text-emerald-900"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <input
                    type="radio"
                    name="ot-rule-type"
                    value="Fixed"
                    checked={ruleType === "Fixed"}
                    onChange={() => setRuleType("Fixed")}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ruleType === "Fixed" ? "bg-emerald-600" : "bg-zinc-300"
                    )}
                  />
                  Fixed Daily Amount (NPR / day)
                </label>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 2: Rate Multipliers */}
        <FormSection
          title="Rate Multipliers"
          description="Set the remuneration values for standard business working days versus weekends and holidays."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ot-rate-office"
                className="mb-1.5 block text-xs font-semibold text-zinc-700"
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
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder={ruleType === "Hourly" ? "e.g. 1.5" : "e.g. 500"}
              />
              {errors.rateOfficeDay && (
                <p className="mt-1 text-xs text-red-600">{errors.rateOfficeDay}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="ot-rate-off"
                className="mb-1.5 block text-xs font-semibold text-zinc-700"
              >
                {rateLabel} — Weekend / Holiday <span className="text-red-500">*</span>
              </label>
              <input
                id="ot-rate-off"
                type="number"
                min={0}
                step={ruleType === "Hourly" ? 0.5 : 1}
                value={rateOffDay}
                onChange={(e) => setRateOffDay(e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                placeholder={ruleType === "Hourly" ? "e.g. 2.0" : "e.g. 800"}
              />
              {errors.rateOffDay && (
                <p className="mt-1 text-xs text-red-600">{errors.rateOffDay}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 3: Operational Status */}
        <FormSection
          title="Operational Status"
          description="Control whether this overtime computation policy is actively applied during payroll runs."
        >
          <div className="flex items-center gap-3">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "border-emerald-700 bg-emerald-50/50 text-emerald-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <input
                type="radio"
                name="ot-rule-status"
                value="active"
                checked={isActive === true}
                onChange={() => setIsActive(true)}
                className="sr-only"
              />
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-600" : "bg-zinc-300"
                )}
              />
              Active Rule
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                !isActive
                  ? "border-zinc-800 bg-zinc-50 text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <input
                type="radio"
                name="ot-rule-status"
                value="inactive"
                checked={isActive === false}
                onChange={() => setIsActive(false)}
                className="sr-only"
              />
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  !isActive ? "bg-zinc-700" : "bg-zinc-300"
                )}
              />
              Inactive
            </label>
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