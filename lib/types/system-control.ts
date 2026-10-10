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
}

export interface LeavePermissionsSettings {
  enabledCategories: Record<EmployeeCategory, boolean>;
}

export interface StatutoryDeductionLimitsSettings {
  pfMaximumLimitPercent: number;
  citLimitNpr: number;
  retirementFundLimitNpr: number;
  handicappedDeductionPercent?: number;
  companyHasSsf: boolean;
  /** What SSF's 11% (employee) and 20% (employer) are worked out on. Default: basic + grade. */
  ssfContributionBase?: "BasicSalary" | "BasicPlusGrade";
}

export interface InsuranceDiscountsSettings {
  medicalInsuranceNpr: number;
  houseInsuranceNpr: number;
  lifeInsuranceNpr: number;
  womenDiscountPercent: number;
  handicappedDiscountPercent: number;
  remoteAllowanceNpr: number;
}

export type GradeCalculationMethod =
  | "STATUTORY_DAILY_RATE"
  | "FIXED_AMOUNT_PER_GRADE"
  | "PERCENTAGE_OF_BASIC"
  | "MANUAL_INPUT"
  | "DISABLED_NO_GRADES";

export interface PromotionRuleSettings {
  enforceNonReduction: boolean;
  guaranteeMinimumOneNewGrade: boolean;
  handlingMethod: "RESET_TO_ZERO_WITH_STEPPING" | "DIRECT_BASIC_ADJUSTMENT";
}

export interface GradePolicySettings {
  calculationMethod: GradeCalculationMethod;
  daysInMonthForDailyRate: number;
  fixedGradePercent: number;
  fixedAmountPerGrade: number;
  maxGradesAllowedPerLevel: number;
  promotionRule: PromotionRuleSettings;
}

export interface SystemControlData {
  officeTime: OfficeTimeSettings;
  manualAttendance: ManualAttendanceSettings;
  leavePermissions: LeavePermissionsSettings;
  statutoryDeductionLimits: StatutoryDeductionLimitsSettings;
  insuranceDiscounts: InsuranceDiscountsSettings;
  gradePolicy?: GradePolicySettings;
}


// ---------------------------------------------------------------------------
// 4.12b: Setup → Rules & controls (the settings payroll still reads). Office
// time, manual attendance and leave categories moved to shifts, attendance
// rules and employment types; their old keys stay stored but unused.
// ---------------------------------------------------------------------------

export type SsfBase = "BasicSalary" | "BasicPlusGrade";

/** The rules form, flat: what the company sets and payroll reads. */
export interface RulesForm {
  /** PF deducted is never more than this share of basic + grade. */
  pfMaxPercent: number;
  /** CIT counted against tax a year, at most. */
  citLimit: number;
  /** PF, SSF and CIT together counted against tax a year, at most (and never over a third of income). */
  retirementLimit: number;
  lifeInsuranceLimit: number;
  healthInsuranceLimit: number;
  houseInsuranceLimit: number;
  /** A remote-area allowance payment is never more than this. */
  remoteAreaLimit: number;
  womenRebatePercent: number;
  companyHasSsf: boolean;
  ssfBase: SsfBase;
  /** Overtime multipliers when no hourly overtime rule is active (never below 1.5). */
  otWorkDay: number;
  otOffDay: number;
  gradeMethod: GradeCalculationMethod;
  gradeDaysInMonth: number;
  gradePercent: number;
  gradeAmount: number;
  /** Grades counted at most (0: no limit). */
  gradeMax: number;
}

export type RulesErrors = Partial<Record<keyof RulesForm, string>>;

export interface RulesChange {
  key: keyof RulesForm;
  label: string;
  from: string;
  to: string;
}

/** What a grade-policy change does to salaries (it goes through salary approval). */
export interface GradePolicyImpact {
  /** Employees whose grade amount changes. */
  employees: number;
  /** Total salary change a month (+ / −). */
  monthlyChange: number;
  /** Employees with a salary change already waiting, left out (by name). */
  pending: string[];
  /** It includes the user's own salary, so someone else approves it. */
  ownSalary: boolean;
  /** It counts at once (no approval needed). */
  approvedAtOnce: boolean;
  /** Who it waits for ("an approver", "Level 1: …"); null when it counts at once. */
  waitingFor: string | null;
}

export interface RulesPage {
  form: RulesForm;
  canEdit: boolean;
  /** Changing the grade policy changes salaries: it also needs Salary structure → Edit. */
  canChangeGrades: boolean;
  /** An active hourly overtime rule overrides the multipliers here. */
  otRule: { work: number; off: number } | null;
  /** How salary changes are approved (none / simple / multi-level). */
  salaryApproval: "none" | "simple" | "multi_level";
  activeEmployees: number;
}

export interface RulesSaveResult {
  changed: RulesChange[];
  /** The grade policy changed: what happened to salaries (null: it did not). */
  grades: (GradePolicyImpact & { batchId: string | null }) | null;
}
