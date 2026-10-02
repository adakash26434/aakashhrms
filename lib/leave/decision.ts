// Leave decision rules (S17). Pure functions, shared by the leave decision
// server action and the Home approvals queue, and unit tested.

import type { LeaveStatus } from "@/lib/types/leave";
import type { ScopeFilter } from "@/lib/auth/scope-filter";

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
