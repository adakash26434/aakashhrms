"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
import { cn } from "@/lib/utils";
import type { LeaveApplicationFormData, LeaveDuration } from "@/lib/types/leave";

interface LeaveFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LeaveApplicationFormData) => Promise<void>;
  editingId: string | null;
  initialData?: LeaveApplicationFormData;
  employees: { id: string; name: string; code: string; gender: string }[];
  leaveTypes: {
    id: string;
    name: string;
    code: string;
    noOfDays: number;
    genderApplicable: string;
    accumulationCap: number | null;
    requiresDocument: boolean;
    documentThresholdDays: number | null;
  }[];
  employeeBalances?: { leaveTypeId: string; balance: number }[];
}

const EMPTY_FORM: LeaveApplicationFormData = {
  employeeId: "",
  leaveTypeId: "",
  effectiveFrom: "",
  effectiveTo: "",
  duration: "Full Day",
  noOfDays: 1,
  reason: "",
  remarks: "",
};

export function LeaveFormModal({
  open,
  onClose,
  onSave,
  editingId,
  initialData,
  employees,
  leaveTypes,
  employeeBalances = [],
}: LeaveFormModalProps) {
  const [formData, setFormData] = useState<LeaveApplicationFormData>(
    initialData || EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setFormData(initialData || EMPTY_FORM);
      setLocalErrors({});
    }
  }, [open, initialData]);

  // Find selected employee details
  const selectedEmployee = employees.find((emp) => emp.id === formData.employeeId);
  const employeeGender = selectedEmployee?.gender || "All";

  // Filter leave types based on employee gender (Maternity is female-only, Paternity is male-only)
  const filteredLeaveTypes = leaveTypes.filter((lt) => {
    if (lt.genderApplicable === "All") return true;
    return lt.genderApplicable === employeeGender;
  });

  // Find selected leave type details
  const selectedLeaveType = leaveTypes.find((lt) => lt.id === formData.leaveTypeId);

  const getBalanceForSelectedLeave = () => {
    if (!formData.leaveTypeId) return null;
    const balance = employeeBalances.find(
      (b) => b.leaveTypeId === formData.leaveTypeId
    );
    return balance ? balance.balance : null;
  };

  const balance = getBalanceForSelectedLeave();

  const handleChange = (
    field: keyof LeaveApplicationFormData,
    value: string | number | LeaveDuration
  ) => {
    const updated = { ...formData, [field]: value };

    // Auto-calculate days if dates change
    if (field === "effectiveFrom" || field === "effectiveTo" || field === "duration") {
      if (updated.effectiveFrom && updated.effectiveTo) {
        const from = new Date(updated.effectiveFrom);
        const to = new Date(updated.effectiveTo);
        if (to >= from) {
          let days = 0;
          const current = new Date(from);
          while (current <= to) {
            const day = current.getDay();
            // Nepal now uses both Saturday (6) and Sunday (0) as weekly off days
            if (day !== 0 && day !== 6) days++;
            current.setDate(current.getDate() + 1);
          }
          updated.noOfDays = updated.duration === "Half Day" ? Math.max(0.5, days * 0.5) : days;
        }
      }
    }

    // Clear error for edited field
    if (localErrors[field]) {
      const newErrors = { ...localErrors };
      delete newErrors[field];
      setLocalErrors(newErrors);
    }

    setFormData(updated);
  };

  // Validate form submission locally first
  const handleValidateAndSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: Record<string, string> = {};

    if (!formData.employeeId) errors.employeeId = "Employee is required";
    if (!formData.leaveTypeId) errors.leaveTypeId = "Leave type is required";
    if (!formData.effectiveFrom) errors.effectiveFrom = "Start date is required";
    if (!formData.effectiveTo) errors.effectiveTo = "End date is required";
    if (!formData.reason.trim()) errors.reason = "Reason is required";

    if (formData.effectiveFrom && formData.effectiveTo) {
      const from = new Date(formData.effectiveFrom);
      const to = new Date(formData.effectiveTo);
      if (to < from) {
        errors.effectiveTo = "End date cannot be before start date";
      }
    }

    if (formData.noOfDays <= 0) {
      errors.noOfDays = "Number of days must be greater than 0";
    }

    // Gender check
    if (selectedEmployee && selectedLeaveType) {
      if (
        selectedLeaveType.genderApplicable !== "All" &&
        selectedLeaveType.genderApplicable !== selectedEmployee.gender
      ) {
        errors.leaveTypeId = `This leave type is only applicable for ${selectedLeaveType.genderApplicable} employees.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const showDocumentWarning =
    selectedLeaveType?.requiresDocument &&
    formData.noOfDays >= (selectedLeaveType.documentThresholdDays ?? 3);

  const showBalanceWarning = balance !== null && formData.noOfDays > balance;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editingId ? "Edit Leave Application" : "New Leave Application"}
      description={
        editingId
          ? "Update the leave application schedule and reason."
          : "Submit an employee leave request for supervisor review."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {formData.noOfDays > 0
              ? `${formData.noOfDays} day(s) requested`
              : "Select dates to calculate balance impact"}
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
              onClick={() => handleValidateAndSubmit()}
              isSaving={saving}
              label={editingId ? "Update Application" : "Submit Request"}
              className="rounded-md bg-payroll-primary hover:bg-payroll-primary-hover text-white font-medium shadow-none cursor-pointer"
            />
          </div>
        </div>
      }
    >
      <form onSubmit={handleValidateAndSubmit} className="space-y-6">
        {/* Section 1: Employee & Entitlement */}
        <FormSection
          title="Staff & Entitlement"
          description="Designate the applicant and the specific leave scheme requested."
          isFirst
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Staff Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => handleChange("employeeId", e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.code}) — {emp.gender}
                    </option>
                  ))}
                </select>
                {localErrors.employeeId && (
                  <p className="mt-1 text-xs text-red-600">{localErrors.employeeId}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Leave Policy <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.leaveTypeId}
                  onChange={(e) => handleChange("leaveTypeId", e.target.value)}
                  disabled={!formData.employeeId}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  <option value="">
                    {!formData.employeeId ? "Select employee first" : "Select leave policy..."}
                  </option>
                  {filteredLeaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code})
                      {lt.noOfDays > 0 ? ` - ${lt.noOfDays} days/yr` : ""}
                    </option>
                  ))}
                </select>
                {localErrors.leaveTypeId && (
                  <p className="mt-1 text-xs text-red-600">{localErrors.leaveTypeId}</p>
                )}
                {balance !== null && (
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Remaining balance: <strong className="text-emerald-950 font-semibold">{balance}</strong> days
                    </span>
                    {selectedLeaveType?.accumulationCap && (
                      <span className="text-zinc-400 font-mono text-2xs">
                        Cap: {selectedLeaveType.accumulationCap} days
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Warnings and notices */}
            {(showBalanceWarning || showDocumentWarning) && (
              <div className="space-y-2 pt-1">
                {showBalanceWarning && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Insufficient Balance Warning</strong>
                      Requested days ({formData.noOfDays}) exceed the remaining balance ({balance}). This application will require management review or may convert to Leave Without Pay (LWOP).
                    </div>
                  </div>
                )}
                {showDocumentWarning && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-payroll-primary mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Verification Document Required</strong>
                      Requesting <strong>{formData.noOfDays}</strong> or more consecutive days under this policy mandates submitting supporting certificates or medical documentation to HR.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* Section 2: Schedule & Duration */}
        <FormSection
          title="Schedule & Duration"
          description="Define the date window and specify full day or half day duration."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Duration Configuration
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    handleChange("duration", e.target.value as LeaveDuration)
                  }
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                >
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Total Working Days <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.noOfDays}
                    onChange={(e) =>
                      handleChange("noOfDays", parseFloat(e.target.value) || 0)
                    }
                    min={0.5}
                    step={0.5}
                    className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                  />
                  <span className="shrink-0 text-2xs text-zinc-400 font-mono">
                    (Auto-calc)
                  </span>
                </div>
                {localErrors.noOfDays && (
                  <p className="mt-1 text-xs text-red-600">{localErrors.noOfDays}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Effective From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => handleChange("effectiveFrom", e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                />
                {localErrors.effectiveFrom && (
                  <p className="mt-1 text-xs text-red-600">{localErrors.effectiveFrom}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Effective To <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.effectiveTo}
                  onChange={(e) => handleChange("effectiveTo", e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary"
                />
                {localErrors.effectiveTo && (
                  <p className="mt-1 text-xs text-red-600">{localErrors.effectiveTo}</p>
                )}
              </div>
            </div>
          </div>
        </FormSection>

        {/* Section 3: Justification & Notes */}
        <FormSection
          title="Justification & Notes"
          description="Provide context for absence and optional handover remarks."
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Reason for Leave <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => handleChange("reason", e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary resize-y"
                placeholder="Detail reason for requesting absence..."
              />
              {localErrors.reason && (
                <p className="mt-1 text-xs text-red-600">{localErrors.reason}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Additional Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
                rows={2}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary resize-y"
                placeholder="Delegation notes or handover remarks (optional)..."
              />
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