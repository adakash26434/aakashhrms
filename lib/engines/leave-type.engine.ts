import type {
  LeaveTypeRecord,
  LeaveTypeFormData,
  LeaveTypeValidationErrors,
  LeaveTypeKPIs,
  GenderApplicable,
} from "@/lib/types/leave-type";

/**
 * Validate a leave type form submission.
 */
export function validateLeaveTypeForm(
  data: LeaveTypeFormData,
): LeaveTypeValidationErrors {
  const errors: LeaveTypeValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = "Leave type name is required";
  }

  if (!data.code.trim()) {
    errors.code = "Leave type code is required";
  } else if (!/^[A-Z_]+$/.test(data.code.trim())) {
    errors.code = "Code must be uppercase letters and underscores only (e.g. STUDY_LEAVE)";
  }

  if (!data.leaveType) {
    errors.leaveType = "Pay type is required";
  }

  if (data.noOfDays <= 0) {
    errors.noOfDays = "Number of days must be greater than 0";
  }

  if (data.accumulationCap !== null && data.accumulationCap < 0) {
    errors.accumulationCap = "Accumulation cap cannot be negative";
  }

  if (data.maxPaidDays !== null && data.maxPaidDays < 0) {
    errors.maxPaidDays = "Max paid days cannot be negative";
  }

  if (data.requiresDocument && (data.documentThresholdDays === null || data.documentThresholdDays <= 0)) {
    errors.documentThresholdDays = "Document threshold days is required when document is required";
  }

  return errors;
}

/**
 * Calculate leave type KPIs from a list of types.
 */
export function calculateLeaveTypeKPIs(types: LeaveTypeRecord[]): LeaveTypeKPIs {
  return {
    total: types.length,
    statutory: types.filter((t) => t.isStatutory).length,
    company: types.filter((t) => !t.isStatutory).length,
    active: types.filter((t) => t.isActive).length,
  };
}

/**
 * Format gender applicability for display.
 */
export function formatGenderApplicable(gender: GenderApplicable): string {
  switch (gender) {
    case "All":
      return "All Genders";
    case "Male":
      return "Male Only";
    case "Female":
      return "Female Only";
    default:
      return gender;
  }
}

/**
 * Get the badge variant for gender display.
 */
export function getGenderBadgeVariant(gender: GenderApplicable): "neutral" | "info" | "warning" {
  switch (gender) {
    case "All":
      return "neutral";
    case "Male":
      return "info";
    case "Female":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Check if a leave type is applicable to an employee's gender.
 */
export function isLeaveTypeApplicableForGender(
  leaveTypeGender: GenderApplicable,
  employeeGender: string,
): boolean {
  if (leaveTypeGender === "All") return true;
  if (leaveTypeGender === "Female" && employeeGender === "Female") return true;
  if (leaveTypeGender === "Male" && employeeGender === "Male") return true;
  return false;
}

/**
 * Calculate pro-rata leave days for mid-year joinees.
 * @param totalDays Total annual leave days
 * @param joiningDate Employee joining date
 * @param fyStartDate Fiscal year start date
 * @param fyEndDate Fiscal year end date
 */
export function calculateProRataLeaveDays(
  totalDays: number,
  joiningDate: Date,
  fyStartDate: Date,
  fyEndDate: Date,
): number {
  if (joiningDate <= fyStartDate) return totalDays;

  const totalFyMs = fyEndDate.getTime() - fyStartDate.getTime();
  const remainingMs = fyEndDate.getTime() - joiningDate.getTime();
  if (remainingMs <= 0) return 0;

  const ratio = remainingMs / totalFyMs;
  return Math.round(totalDays * ratio * 10) / 10; // Round to 1 decimal
}
