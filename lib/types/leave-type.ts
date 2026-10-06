// =============================================================================
// LEAVE TYPE TYPES (Enhanced for Nepal Labour Act 2074)
// =============================================================================

import type { CreditMode, DayBasis, LeaveKind } from "@/lib/types/leave";

export type LeavePayType = "Pay" | "Non-Pay" | "Partial-Pay";
export type GenderApplicable = "All" | "Male" | "Female";
export type StatutoryCode = "HOME" | "SICK" | "MATERNITY" | "PATERNITY" | "MOURNING" | "SUBSTITUTE";
/** What a day paid out at the year end is worth: basic salary per day, or a fixed amount (never less than basic). */
export type PayoutBasis = "BasicSalary" | "Fixed";

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
  /** 4.6: how it counts (resolved: the defaults for its statutory code when not set). */
  kind: LeaveKind;
  dayBasis: DayBasis;
  allowHalfDay: boolean;
  maxDaysPerRequest: number | null;
  paidDaysPerEvent: number | null;
  /** 4.6e company types. */
  noticeDays: number | null;
  eligibleAfterDays: number | null;
  creditMode: CreditMode;
  maxDaysPerYear: number | null;
  maxDaysInService: number | null;
  payoutFixedAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The New / Edit window for a company leave type (statutory types change through a proposal). */
export interface LeaveTypeFormData {
  name: string;
  code: string;
  leaveType: LeavePayType;
  /** Balance: days a year. Event: days each time. No balance: 0. */
  noOfDays: number;
  kind: LeaveKind;
  dayBasis: DayBasis;
  allowHalfDay: boolean;
  maxDaysPerRequest: number | null;
  /** Event: the first N days are paid, the rest unpaid (null = all as the pay says). */
  paidDaysPerEvent: number | null;
  creditMode: CreditMode;
  proRataForNewJoinees: boolean;
  carryForward: boolean;
  accumulationCap: number | null;
  isEncashable: boolean;
  encashmentBasis: PayoutBasis;
  payoutFixedAmount: number | null;
  requiresDocument: boolean;
  documentThresholdDays: number | null;
  noticeDays: number | null;
  eligibleAfterDays: number | null;
  maxDaysPerYear: number | null;
  maxDaysInService: number | null;
  genderApplicable: GenderApplicable;
  applicableDepartments: string[];
  applicableDesignations: string[];
  isActive: boolean;
}

/** Saving a company type: also change this year's credit for people already credited (balance types given yearly). */
export interface LeaveTypeSaveOptions {
  thisYear?: boolean;
  /** Why, for the history (optional). */
  note?: string;
}

export type LeaveTypeValidationErrors = Partial<Record<keyof LeaveTypeFormData, string>>;

export interface LeaveTypeKPIs {
  total: number;
  statutory: number;
  company: number;
  active: number;
}

/** One saved version of a company leave type, for its history. */
export interface CompanyTypeChange {
  id: string;
  at: string;
  by: string;
  lines: string[];
  note: string;
}

/** What "also this year" would do. */
export interface ThisYearPreview {
  yearLabel: string;
  people: number;
  added: number;
  taken: number;
  examples: { name: string; days: number }[];
}
