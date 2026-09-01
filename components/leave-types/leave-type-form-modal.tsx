"use client";

import { useCallback, useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
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
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <DataSaveButton
            onClick={handleSave}
            isSaving={saving}
            label={typeRecord ? "Update Policy" : "Create Policy"}
          />
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Leave Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Policy Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              disabled={isStatutory}
              onChange={(e) => handleChange("name", e.target.value)}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] placeholder-gray-400 outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="e.g. Study Leave"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Leave Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Unique Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              disabled={isStatutory || !!typeRecord}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] placeholder-gray-400 outline-none transition-colors focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]/20 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="e.g. STUDY_LEAVE"
            />
            {errors.code && (
              <p className="mt-1 text-xs text-red-500">{errors.code}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Pay Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.leaveType}
              disabled={isStatutory}
              onChange={(e) => handleChange("leaveType", e.target.value as LeavePayType)}
              className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100"
            >
              <option value="Pay">Paid Leave</option>
              <option value="Non-Pay">Unpaid Leave (LWOP)</option>
              <option value="Partial-Pay">Partial Paid Leave</option>
            </select>
          </div>

          {/* Days / Year */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Allotted Days / Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={formData.noOfDays}
              onChange={(e) => handleChange("noOfDays", parseFloat(e.target.value) || 0)}
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
            />
            {errors.noOfDays && (
              <p className="mt-1 text-xs text-red-500">{errors.noOfDays}</p>
            )}
          </div>

          {/* Gender Limit */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
              Gender Applicability
            </label>
            <select
              value={formData.genderApplicable}
              disabled={isStatutory}
              onChange={(e) => handleChange("genderApplicable", e.target.value as GenderApplicable)}
              className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100"
            >
              <option value="All">All Genders</option>
              <option value="Male">Male Only (Paternity)</option>
              <option value="Female">Female Only (Maternity)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Accumulation Cap */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
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
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
            />
            {errors.accumulationCap && (
              <p className="mt-1 text-xs text-red-500">{errors.accumulationCap}</p>
            )}
          </div>

          {/* Max Paid Days (relevant if Partial-Pay) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
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
              className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] disabled:bg-gray-100"
            />
            {errors.maxPaidDays && (
              <p className="mt-1 text-xs text-red-500">{errors.maxPaidDays}</p>
            )}
          </div>
        </div>

        <div className="border-t border-[#d7e8d0] pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Checkboxes group 1 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.carryForward}
                disabled={isStatutory}
                onChange={(e) => handleChange("carryForward", e.target.checked)}
                className="rounded border-[#d7e8d0] text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm font-medium text-[#1b3a1f]">
                Carry Forward to next Fiscal Year
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.proRataForNewJoinees}
                disabled={isStatutory}
                onChange={(e) => handleChange("proRataForNewJoinees", e.target.checked)}
                className="rounded border-[#d7e8d0] text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm font-medium text-[#1b3a1f]">
                Calculate Pro-Rata for Mid-Year Joinings
              </span>
            </label>
          </div>

          {/* Checkboxes group 2 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isEncashable}
                disabled={isStatutory && (formData.code !== "HOME" && formData.code !== "SICK")}
                onChange={(e) => handleChange("isEncashable", e.target.checked)}
                className="rounded border-[#d7e8d0] text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm font-medium text-[#1b3a1f]">
                Enable Encashment of Excess Leave
              </span>
            </label>

            {formData.isEncashable && (
              <div className="pl-6">
                <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Encashment Divisor/Basis
                </label>
                <select
                  value={formData.encashmentBasis || "BasicSalary"}
                  disabled={isStatutory}
                  onChange={(e) => handleChange("encashmentBasis", e.target.value)}
                  className="block w-full rounded-lg border border-[#d7e8d0] bg-white px-2.5 py-1.5 text-xs text-[#1b3a1f] outline-none"
                >
                  <option value="BasicSalary">Basic Salary only (Nepal Labour Act standard)</option>
                  <option value="BasicPlusGrade">Basic + Grade Amount</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Medical Document Section */}
        <div className="border-t border-[#d7e8d0] pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresDocument}
                onChange={(e) => handleChange("requiresDocument", e.target.checked)}
                className="rounded border-[#d7e8d0] text-[#2e7d32] focus:ring-[#2e7d32]/20"
              />
              <span className="text-sm font-medium text-[#1b3a1f]">
                Requires Official Document / Certificate
              </span>
            </label>
          </div>

          {formData.requiresDocument && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
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
                className="block w-full rounded-lg border border-[#d7e8d0] px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
                placeholder="e.g. 3 (Medical cert required for >3 days)"
              />
              {errors.documentThresholdDays && (
                <p className="mt-1 text-xs text-red-500">{errors.documentThresholdDays}</p>
              )}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="border-t border-[#d7e8d0] pt-4">
          <label className="mb-1.5 block text-sm font-medium text-[#1b3a1f]">
            Policy Status
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
    </Dialog>
  );
}
