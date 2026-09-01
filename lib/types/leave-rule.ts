// =============================================================================
// LEAVE RULE TYPES (Decoupled from OT Rules)
// Nepal Labour Act 2074 — Statutory & Company Leave Policy Rules
// =============================================================================

export type LeaveRuleCategory = "STATUTORY" | "COMPANY";
export type AccrualMethod = "FIXED_ANNUAL" | "DAYS_WORKED" | "MONTHLY_ACCRUAL";
export type EncashmentRate = "BASIC_DAILY" | "FIXED_AMOUNT";

export interface LeaveRule {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;     // Joined from leaveTypes table
  leaveTypeCode: string;     // Joined from leaveTypes table
  fiscalYearId: string | null;
  ruleName: string;
  ruleCategory: LeaveRuleCategory;
  accrualMethod: AccrualMethod;
  accrualValue: number;
  encashmentRate: EncashmentRate;
  encashmentFixedAmount: number;
  minServiceDaysForEligibility: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRuleFormData {
  leaveTypeId: string;
  fiscalYearId: string;        // Empty string = global
  ruleName: string;
  ruleCategory: LeaveRuleCategory;
  accrualMethod: AccrualMethod;
  accrualValue: number;
  encashmentRate: EncashmentRate;
  encashmentFixedAmount: number;
  minServiceDaysForEligibility: number;
  isActive: boolean;
}

export interface LeaveRuleValidationErrors {
  leaveTypeId?: string;
  ruleName?: string;
  accrualMethod?: string;
  accrualValue?: string;
  encashmentRate?: string;
  encashmentFixedAmount?: string;
  minServiceDaysForEligibility?: string;
}

export interface LeaveRuleKPIs {
  total: number;
  statutory: number;
  company: number;
  active: number;
}
