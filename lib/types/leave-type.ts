// =============================================================================
// LEAVE TYPE TYPES (Enhanced for Nepal Labour Act 2074)
// =============================================================================

export type LeavePayType = "Pay" | "Non-Pay" | "Partial-Pay";
export type GenderApplicable = "All" | "Male" | "Female";
export type StatutoryCode = "HOME" | "SICK" | "MATERNITY" | "PATERNITY" | "MOURNING" | "SUBSTITUTE";

export interface LeaveTypeRecord {
  id: string;
  name: string;
  code: string;
  leaveType: LeavePayType;
  noOfDays: number;
  carryForward: boolean;
  accumulationCap: number | null;
  maxPaidDays: number | null;
  isStatutory: boolean;
  statutoryCode: StatutoryCode | null;
  genderApplicable: GenderApplicable;
  requiresDocument: boolean;
  documentThresholdDays: number | null;
  isEncashable: boolean;
  encashmentBasis: string | null;
  proRataForNewJoinees: boolean;
  applicableDepartments: string[];
  applicableDesignations: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveTypeFormData {
  name: string;
  code: string;
  leaveType: LeavePayType;
  noOfDays: number;
  carryForward: boolean;
  accumulationCap: number | null;
  maxPaidDays: number | null;
  isStatutory: boolean;
  statutoryCode: StatutoryCode | null;
  genderApplicable: GenderApplicable;
  requiresDocument: boolean;
  documentThresholdDays: number | null;
  isEncashable: boolean;
  encashmentBasis: string;
  proRataForNewJoinees: boolean;
  applicableDepartments: string[];
  applicableDesignations: string[];
  isActive: boolean;
}

export interface LeaveTypeValidationErrors {
  name?: string;
  code?: string;
  leaveType?: string;
  noOfDays?: string;
  accumulationCap?: string;
  maxPaidDays?: string;
  genderApplicable?: string;
  documentThresholdDays?: string;
}

export interface LeaveTypeKPIs {
  total: number;
  statutory: number;
  company: number;
  active: number;
}
