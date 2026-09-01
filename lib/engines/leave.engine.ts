import type {
  LeaveApplication,
  LeaveApplicationFormData,
  LeaveApplicationValidationErrors,
  LeaveFilter,
  LeaveKPIs,
  LeaveStatus,
} from "@/lib/types/leave";

export function validateLeaveApplication(
  data: LeaveApplicationFormData,
): LeaveApplicationValidationErrors {
  const errors: LeaveApplicationValidationErrors = {};

  if (!data.employeeId) errors.employeeId = "Employee is required";
  if (!data.leaveTypeId) errors.leaveTypeId = "Leave type is required";
  if (!data.effectiveFrom) errors.effectiveFrom = "Start date is required";
  if (!data.effectiveTo) errors.effectiveTo = "End date is required";
  if (!data.reason.trim()) errors.reason = "Reason is required";

  if (data.effectiveFrom && data.effectiveTo) {
    const from = new Date(data.effectiveFrom);
    const to = new Date(data.effectiveTo);
    if (to < from) {
      errors.effectiveTo = "End date cannot be before start date";
    }
  }

  if (data.noOfDays <= 0) {
    errors.noOfDays = "Number of days must be greater than 0";
  }

  return errors;
}

export function calculateLeaveKPIs(
  applications: LeaveApplication[],
): LeaveKPIs {
  return {
    total: applications.length,
    pending: applications.filter((a) => a.status === "Pending").length,
    approved: applications.filter((a) => a.status === "Approved").length,
    rejected: applications.filter((a) => a.status === "Rejected").length,
    cancelled: applications.filter((a) => a.status === "Cancelled").length,
  };
}

export function getStatusBadgeVariant(
  status: LeaveStatus,
): "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "Pending":
      return "warning";
    case "Approved":
      return "success";
    case "Rejected":
      return "danger";
    case "Cancelled":
      return "neutral";
  }
}

const WORKING_HOURS_PER_DAY = 8;

/**
 * Calculate the number of working days between two dates (inclusive).
 * Excludes weekly off days (Saturday and Sunday) as per Nepal's corporate weekend standard.
 */
export function calculateWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculate leave days for half-day requests.
 */
export function calculateLeaveDays(
  from: Date,
  to: Date,
  duration: "Full Day" | "Half Day",
): number {
  const days = calculateWorkingDays(from, to);
  return duration === "Half Day" ? Math.max(0.5, days * 0.5) : days;
}