export type EmployeeCategory =
  | "Permanent"
  | "Temporary"
  | "OutSource"
  | "Consultant"
  | "Trainee"
  | "Volunteer"
  | "Contract";

export type ManualAttendanceDefault = "Absent" | "Present";
export type Meridiem = "AM" | "PM";

export const EMPLOYEE_CATEGORIES: EmployeeCategory[] = [
  "Permanent",
  "Temporary",
  "OutSource",
  "Consultant",
  "Trainee",
  "Volunteer",
  "Contract",
];

/** 12-hour clock hour (1–12) */
export type ClockHour = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Time of day stored as the 12-hour value the user enters in the UI
 * (e.g. "10:00 AM", "4:30 PM"). Always uppercase AM/PM with one space.
 */
export interface OfficeTimeValue {
  hour: ClockHour;
  minute: number; // 0–59
  meridiem: Meridiem;
}

export interface OfficeTimeSettings {
  inTime: OfficeTimeValue;
  outTime: OfficeTimeValue;
  calculateOtAndAbsent: boolean;
  applyGraceWindow: boolean;
  graceWindowMinutes: number;
  otMultiplierOfficeDay?: number;
  otMultiplierOffDay?: number;
}

export interface ManualAttendanceSettings {
  defaultWhenNotPosted: ManualAttendanceDefault;
  yearlyInsurancePremiumLimit: number;
}

export interface LeavePermissionsSettings {
  enabledCategories: Record<EmployeeCategory, boolean>;
}

export interface StatutoryDeductionLimitsSettings {
  pfMaximumLimitPercent: number;
  citLimitNpr: number;
  retirementFundLimitNpr: number;
  handicappedDeductionPercent: number;
  companyHasSsf: boolean;
}

export interface InsuranceDiscountsSettings {
  medicalInsuranceNpr: number;
  houseInsuranceNpr: number;
  lifeInsuranceNpr: number;
  womenDiscountPercent: number;
  remoteAllowanceNpr: number;
}

export interface SystemControlData {
  officeTime: OfficeTimeSettings;
  manualAttendance: ManualAttendanceSettings;
  leavePermissions: LeavePermissionsSettings;
  statutoryDeductionLimits: StatutoryDeductionLimitsSettings;
  insuranceDiscounts: InsuranceDiscountsSettings;
}
