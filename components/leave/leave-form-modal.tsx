"use client";

import { useState, useEffect } from "react";
import {
  User,
  Calendar,
  Clock,
  MessageSquare,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";
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
          ? "Update the leave application details."
          : "Fill in the details below to submit a new leave request."
      }
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <DataSaveButton
            onClick={() => handleValidateAndSubmit()}
            isSaving={saving}
            label={editingId ? "Update Application" : "Submit Application"}
          />
        </>
      }
    >
      <form onSubmit={handleValidateAndSubmit} className="space-y-5">
        {/* Row 1: Employee + Leave Type */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Employee" icon={User} required>
            <select
              value={formData.employeeId}
              onChange={(e) => handleChange("employeeId", e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.code}) — {emp.gender}
                </option>
              ))}
            </select>
            {localErrors.employeeId && (
              <p className="mt-1 text-xs text-red-500">{localErrors.employeeId}</p>
            )}
          </FormField>

          <FormField label="Leave Type" icon={Calendar} required>
            <select
              value={formData.leaveTypeId}
              onChange={(e) => handleChange("leaveTypeId", e.target.value)}
              required
              disabled={!formData.employeeId}
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32] disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {!formData.employeeId ? "Please select employee first" : "Select leave type"}
              </option>
              {filteredLeaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code})
                  {lt.noOfDays > 0 ? ` - ${lt.noOfDays} days/yr` : ""}
                </option>
              ))}
            </select>
            {localErrors.leaveTypeId && (
              <p className="mt-1 text-xs text-red-500">{localErrors.leaveTypeId}</p>
            )}
            {balance !== null && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Remaining balance: <strong>{balance}</strong> days
                </span>
                {selectedLeaveType?.accumulationCap && (
                  <span className="text-gray-400 font-mono text-[10px]">
                    Cap: {selectedLeaveType.accumulationCap} days
                  </span>
                )}
              </div>
            )}
          </FormField>
        </div>

        {/* Warnings and notices */}
        {(showBalanceWarning || showDocumentWarning) && (
          <div className="space-y-2">
            {showBalanceWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block text-amber-900 font-semibold">Insufficient Balance Warning</strong>
                  Requested days ({formData.noOfDays}) exceed the employee's remaining balance ({balance}). This application will need special review or may be treated as Leave Without Pay (LWOP).
                </div>
              </div>
            )}
            {showDocumentWarning && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800 flex items-start gap-2.5 shadow-sm">
                <FileText className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                <div>
                  <strong className="block text-green-900 font-semibold">Document Required Policy</strong>
                  As per policy, requesting <strong>{formData.noOfDays}</strong> or more consecutive days of this leave requires uploading/submitting official documents (e.g. medical report or certificate) to HR.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 2: Duration + Days */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Duration" icon={Clock}>
            <select
              value={formData.duration}
              onChange={(e) =>
                handleChange("duration", e.target.value as LeaveDuration)
              }
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            >
              <option value="Full Day">Full Day</option>
              <option value="Half Day">Half Day</option>
            </select>
          </FormField>

          <FormField label="Number of Days" required>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={formData.noOfDays}
                onChange={(e) =>
                  handleChange("noOfDays", parseFloat(e.target.value) || 0)
                }
                min={0.5}
                step={0.5}
                required
                className="w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              />
              <span className="shrink-0 text-xs text-gray-500">
                (Auto-calculated)
              </span>
            </div>
            {localErrors.noOfDays && (
              <p className="mt-1 text-xs text-red-500">{localErrors.noOfDays}</p>
            )}
          </FormField>
        </div>

        {/* Row 3: Date Range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="From" required>
            <input
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) => handleChange("effectiveFrom", e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            />
            {localErrors.effectiveFrom && (
              <p className="mt-1 text-xs text-red-500">{localErrors.effectiveFrom}</p>
            )}
          </FormField>
          <FormField label="To" required>
            <input
              type="date"
              value={formData.effectiveTo}
              onChange={(e) => handleChange("effectiveTo", e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            />
            {localErrors.effectiveTo && (
              <p className="mt-1 text-xs text-red-500">{localErrors.effectiveTo}</p>
            )}
          </FormField>
        </div>

        {/* Reason */}
        <FormField label="Reason" icon={MessageSquare} required>
          <textarea
            value={formData.reason}
            onChange={(e) => handleChange("reason", e.target.value)}
            required
            rows={3}
            className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            placeholder="Reason for leave..."
          />
          {localErrors.reason && (
            <p className="mt-1 text-xs text-red-500">{localErrors.reason}</p>
          )}
        </FormField>

        {/* Remarks */}
        <FormField label="Remarks">
          <textarea
            value={formData.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            placeholder="Additional notes (optional)..."
          />
        </FormField>
      </form>
    </Dialog>
  );
}

function FormField({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-[#1b3a1f]">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}