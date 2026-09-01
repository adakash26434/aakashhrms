export type LeaveTypeCategory = "Pay" | "Non-Pay";
export type LeaveDuration = "Full Day" | "Half Day";
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  leaveType: LeaveTypeCategory;
  noOfDays: number;
  carryForward: boolean;
  applicableDepartments: string[];
  applicableDesignations: string[];
  isActive: boolean;
}

export interface EmployeeLeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string;
  allotted: number;
  taken: number;
  carriedForward: number;
  balance: number;
}

export interface LeaveApplication {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  appliedDate: Date;
  effectiveFrom: Date;
  effectiveTo: Date;
  duration: LeaveDuration;
  noOfDays: number;
  reason: string;
  remarks: string | null;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewRemarks: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveApplicationFormData {
  employeeId: string;
  leaveTypeId: string;
  effectiveFrom: string;
  effectiveTo: string;
  duration: LeaveDuration;
  noOfDays: number;
  reason: string;
  remarks: string;
}

export interface LeaveFilter {
  search?: string;
  status?: LeaveStatus | "all";
  leaveTypeId?: string | "all";
  dateFrom?: string;
  dateTo?: string;
}

export interface LeaveKPIs {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
}

export interface LeaveApplicationValidationErrors {
  employeeId?: string;
  leaveTypeId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  duration?: string;
  noOfDays?: string;
  reason?: string;
}