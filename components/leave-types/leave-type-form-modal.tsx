"use client";

import { useCallback, useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import { cn } from "@/lib/utils";
import type {
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeavePayType,
  GenderApplicable,
  LeaveTypeValidationErrors,
} from "@/lib/types/leave-type";
import { validateLeaveTypeForm } from "@/lib/engines/leave-type.engine";

interface LeaveTypeFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: LeaveTypeFormData) => Promise<void>;
  typeRecord: LeaveTypeRecord | null;
}

const DEFAULT_FORM: LeaveTypeFormData = {
  name: "",
  code: "",
  leaveType: "Pay",
  noOfDays: 12,
  carryForward: false,
  accumulationCap: null,
  maxPaidDays: null,
  isStatutory: false,
  statutoryCode: null,
  genderApplicable: "All",
  requiresDocument: false,
  documentThresholdDays: null,
  isEncashable: false,
  encashmentBasis: "BasicSalary",
  proRataForNewJoinees: true,
  applicableDepartments: [],
  applicableDesignations: [],
  isActive: true,
};

export function LeaveTypeFormModal({
  open,
  onClose,
  onSave,
  typeRecord,
}: LeaveTypeFormModalProps) {
  const [formData, setFormData] = useState<LeaveTypeFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<LeaveTypeValidationErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeRecord) {
      setFormData({
        name: typeRecord.name,
        code: typeRecord.code,
        leaveType: typeRecord.leaveType,
        noOfDays: typeRecord.noOfDays,
        carryForward: typeRecord.carryForward,
        accumulationCap: typeRecord.accumulationCap,
        maxPaidDays: typeRecord.maxPaidDays,
        isStatutory: typeRecord.isStatutory,
        statutoryCode: typeRecord.statutoryCode,
        genderApplicable: typeRecord.genderApplicable,
        requiresDocument: typeRecord.requiresDocument,
        documentThresholdDays: typeRecord.documentThresholdDays,
        isEncashable: typeRecord.isEncashable,
        encashmentBasis: typeRecord.encashmentBasis || "BasicSalary",
        proRataForNewJoinees: typeRecord.proRataForNewJoinees,
        applicableDepartments: typeRecord.applicableDepartments,
        applicableDesignations: typeRecord.applicableDesignations,
        isActive: typeRecord.isActive,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
    setErrors({});
  }, [typeRecord, open]);

  const handleChange = (
    field: keyof LeaveTypeFormData,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const validationErrors = validateLeaveTypeForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(typeRecord?.id || null, formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isStatutory = typeRecord?.isStatutory ?? false;

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
      }}
      title={
        typeRecord
          ? isStatutory
            ? "Customize Statutory Leave"
            : "Edit Leave Type"
          : "New Leave Type"
      }
      description={
        typeRecord
          ? isStatutory
            ? "Nepal Labour Act statutory properties (Code, Statutory flags) are locked, but you can adjust days, caps, and departments."
            : "Update custom leave policy settings."
          : "Create a new leave type policy for the organization."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {typeRecord ? `Editing: ${formData.name || "Policy"}` : "New leave policy"}
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
              label={typeRecord ? "Update Policy" : "Create Policy"}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: Policy Identification */}
        <FormSection
          title="Policy Identification"
          description="Define official policy name and system code identifier."
          isFirst
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Policy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                disabled={isStatutory}
                onChange={(e) => handleChange("name", e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                placeholder="e.g. Study Leave"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Unique Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                disabled={isStatutory || Boolean(typeRecord)}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                placeholder="e.g. STUDY_LEAVE"
              />
              {errors.code && (
                <p className="mt-1 text-xs text-red-600">{errors.code}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Entitlement & Limits */}
        <FormSection
          title="Entitlement & Limits"
          description="Payment classification, annual allotted days, and gender eligibility."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Payment Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.leaveType}
                disabled={isStatutory}
                onChange={(e) => handleChange("leaveType", e.target.value as LeavePayType)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="Pay">Paid Leave</option>
                <option value="Non-Pay">Unpaid Leave (LWOP)</option>
                <option value="Partial-Pay">Partial Paid Leave</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Allotted Days / Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={formData.noOfDays}
                onChange={(e) => handleChange("noOfDays", parseFloat(e.target.value) || 0)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
              />
              {errors.noOfDays && (
                <p className="mt-1 text-xs text-red-600">{errors.noOfDays}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Gender Applicability
              </label>
              <select
                value={formData.genderApplicable}
                disabled={isStatutory}
                onChange={(e) => handleChange("genderApplicable", e.target.value as GenderApplicable)}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="All">All Genders</option>
                <option value="Male">Male Only (Paternity)</option>
                <option value="Female">Female Only (Maternity)</option>
              </select>
            </div>
          </div>
        </FormSection>

        {/* Section 3: Accumulation & Encashment */}
        <FormSection
          title="Accumulation & Encashment"
          description="Accumulation balance cap, carry-forward, and cashout rules."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Max Accumulation Cap (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 90 (Home), 45 (Sick)"
                  value={formData.accumulationCap ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "accumulationCap",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                />
                {errors.accumulationCap && (
                  <p className="mt-1 text-xs text-red-600">{errors.accumulationCap}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Max Paid Days (For partial-pay)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 60 days (Maternity)"
                  value={formData.maxPaidDays ?? ""}
                  disabled={isStatutory && formData.code !== "MATERNITY"}
                  onChange={(e) =>
                    handleChange(
                      "maxPaidDays",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                />
                {errors.maxPaidDays && (
                  <p className="mt-1 text-xs text-red-600">{errors.maxPaidDays}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-200/60">
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.carryForward}
                    disabled={isStatutory}
                    onChange={(e) => handleChange("carryForward", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-payroll-primary focus:ring-payroll-primary cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-800">
                    Carry Forward to next Fiscal Year
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.proRataForNewJoinees}
                    disabled={isStatutory}
                    onChange={(e) => handleChange("proRataForNewJoinees", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-payroll-primary focus:ring-payroll-primary cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-800">
                    Calculate Pro-Rata for Mid-Year Joinings
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isEncashable}
                    disabled={isStatutory && (formData.code !== "HOME" && formData.code !== "SICK")}
                    onChange={(e) => handleChange("isEncashable", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-payroll-primary focus:ring-payroll-primary cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-800">
                    Enable Encashment of Excess Leave
                  </span>
                </label>

                {formData.isEncashable && (
                  <div className="pl-6 pt-1">
                    <label className="mb-1 block text-2xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Encashment Basis
                    </label>
                    <select
                      value={formData.encashmentBasis || "BasicSalary"}
                      disabled={isStatutory}
                      onChange={(e) => handleChange("encashmentBasis", e.target.value)}
                      className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                    >
                      <option value="BasicSalary">Basic Salary only (Nepal Labour Act standard)</option>
                      <option value="BasicPlusGrade">Basic + Grade Amount</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 4: Verification & Documentation */}
        <FormSection
          title="Documentation"
          description="Mandatory justification or medical proof threshold."
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.requiresDocument}
                onChange={(e) => handleChange("requiresDocument", e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-payroll-primary focus:ring-payroll-primary accent-payroll-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-zinc-800">
                Requires Official Document / Certificate
              </span>
            </label>

            {formData.requiresDocument && (
              <div className="pl-6 max-w-sm">
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Threshold for document upload (Days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.documentThresholdDays ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "documentThresholdDays",
                      e.target.value === "" ? null : parseInt(e.target.value)
                    )
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  placeholder="e.g. 3 (Medical cert for >3 days)"
                />
                {errors.documentThresholdDays && (
                  <p className="mt-1 text-xs text-red-600">{errors.documentThresholdDays}</p>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* Section 5: Operational Status */}
        <FormSection
          title="Operational Status"
          description="Designate whether this leave policy is active for employees."
        >
          <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => handleChange("isActive", true)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                formData.isActive === true
                  ? "bg-payroll-primary text-white shadow-none"
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
