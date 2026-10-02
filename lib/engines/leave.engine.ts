import type {
  LeaveApplication,
  LeaveApplicationFormData,
  LeaveApplicationValidationErrors,
  LeaveFilter,
  LeaveKPIs,
  LeaveStatus,
} from "@/lib/types/leave";
import type { ScopeFilter } from "@/lib/auth/scope-filter";

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

// ---------------------------------------------------------------------------
// Leave decisions (S17): shared by the decision action and the leave lists.
// ---------------------------------------------------------------------------

/**
 * Which status changes a reviewer may make. A decided request cannot be
 * re-decided except to withdraw an approval (Rejected / Cancelled restore the
 * balance). Nothing goes back to Pending.
 */
const ALLOWED_TRANSITIONS: Record<LeaveStatus, readonly LeaveStatus[]> = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["Rejected", "Cancelled"],
  Rejected: [],
  Cancelled: [],
};

export const LEAVE_STATUSES: readonly LeaveStatus[] = ["Pending", "Approved", "Rejected", "Cancelled"];

export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return typeof value === "string" && (LEAVE_STATUSES as readonly string[]).includes(value);
}

export function canTransitionLeave(from: LeaveStatus, to: LeaveStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface ScopedEmployee {
  id: string;
  branchId: string | null;
  departmentId: string | null;
}

/**
 * In-memory twin of `buildEmployeeScopeCondition`: is this employee inside the
 * reviewer's branch / department / self scope? Fails closed for unknown scopes
 * and for BRANCH / DEPARTMENT scopes with nothing assigned.
 */
export function employeeInScope(
  scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds" | "employeeId">,
  employee: ScopedEmployee
): boolean {
  switch (scope.scopeType) {
    case "GLOBAL":
      return true;
    case "BRANCH":
      return !!employee.branchId && scope.branchIds.includes(employee.branchId);
    case "DEPARTMENT":
      return !!employee.departmentId && scope.departmentIds.includes(employee.departmentId);
    case "SELF":
      return !!scope.employeeId && scope.employeeId === employee.id;
    default:
      return false;
  }
}

/** A reviewer may not approve or reject their own request (maker-checker). */
export function isOwnRequest(reviewerEmployeeId: string | null | undefined, applicantEmployeeId: string): boolean {
  return !!reviewerEmployeeId && reviewerEmployeeId === applicantEmployeeId;
}

export const REJECTION_REASON_MIN = 3;
export const REMARKS_MAX = 500;

/** Trims remarks and caps their length; returns null when empty. */
export function cleanRemarks(remarks: unknown): string | null {
  if (typeof remarks !== "string") return null;
  const text = remarks.trim().slice(0, REMARKS_MAX);
  return text.length > 0 ? text : null;
}
