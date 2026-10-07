import type {
  Employee,
  EmployeeAttendanceTabData,
  EmployeeFormData,
  EmployeeListRow,
  EmployeeRecordGap,
  EmployeeRecordTab,
  EmployeeValidationErrors,
} from "@/lib/types/employee";
import { EMPLOYEE_FORM_SECTIONS, fieldLabel, type EmployeeField, type EmployeeFormSection } from "@/lib/constants/employee-form";
import { maskAccountNumber } from "@/lib/utils/mask";
import type { ScopeFilter } from "@/lib/auth/scope-filter";
import { validatePhoneNumber } from "@/lib/utils/phone";
import { validateMobileNumber } from "@/lib/utils/phone-mobile";
import { validatePanNo } from "@/lib/utils/nepal-docs";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { documentsChanged, isPrimaryDocument, validateDocuments } from "@/lib/engines/employee-document.engine";
import { parseStructuredAddress } from "@/lib/constants/nepal-locations";

const WARD_ERROR = "Ward number must be between 1 and 35";

/** Ward numbers run 1–35 (the largest municipalities have 33); empty is allowed. */
export function isValidWard(ward: string | undefined | null): boolean {
  if (!ward || !ward.trim()) return true;
  const n = Number(ward);
  return Number.isInteger(n) && n >= 1 && n <= 35;
}

/**
 * Safely parses YYYY-MM-DD strings without UTC timezone drift.
 */
export function parseLocalDateParts(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) return null;
  const parts = dateStr.trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Calculates exact age in full years between birthDate and a reference date (defaults to today).
 */
export function calculateAgeInYears(birthDate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const mDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validates a single specific tab/section of the employee form.
 * Used when user clicks "Next" or navigates between sections.
 */
export function validateEmployeeTab(data: EmployeeFormData, tabIndex: number, options: { today?: string } = {}): EmployeeValidationErrors {
  const errors: EmployeeValidationErrors = {};

  if (tabIndex === 0) {
    // 0: General Information
    if (!data.attendanceCode?.trim()) errors.attendanceCode = "Attendance code is required";
    if (!data.employeeCode?.trim()) errors.employeeCode = "Employee code is required";
    if (!data.fullName?.trim()) errors.fullName = "Full name is required";

    if (!data.dateOfBirth || !data.dateOfBirth.trim()) {
      errors.dateOfBirth = "Date of birth is required";
    } else {
      const dob = parseLocalDateParts(data.dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!dob) {
        errors.dateOfBirth = "Invalid date of birth";
      } else {
        const dobZero = new Date(dob);
        dobZero.setHours(0, 0, 0, 0);

        if (dobZero > today) {
          errors.dateOfBirth = "Date of birth cannot be in the future";
        } else {
          const age = calculateAgeInYears(dobZero, today);
          if (age < 18) {
            errors.dateOfBirth = "Employee must be at least 18 years old (Nepal Labour Act requirement)";
          } else if (age > 100) {
            errors.dateOfBirth = "Please enter a realistic date of birth (maximum 100 years)";
          }
        }
      }
    }
  } else if (tabIndex === 1) {
    // 1: Office Information
    if (!data.departmentId?.trim()) errors.departmentId = "Department is required";
    if (!data.branchId?.trim()) errors.branchId = "Branch is required";
    if (!data.designationId?.trim()) errors.designationId = "Designation is required";
    if (!data.shreni?.trim()) errors.shreni = "Shreni is required";
    if (data.gradeCount !== undefined && data.gradeCount !== null && (Number(data.gradeCount) < 0 || !Number.isInteger(Number(data.gradeCount)))) {
      errors.gradeCount = "Grade count must be a non-negative integer";
    }
    if (data.gradeAmount === undefined || data.gradeAmount === null || Number(data.gradeAmount) < 0 || String(data.gradeAmount).trim() === "") {
      errors.gradeAmount = "Grade amount is required";
    }

    if (!data.joiningDate || !data.joiningDate.trim()) {
      errors.joiningDate = "Joining date is required";
    } else {
      const joinDate = parseLocalDateParts(data.joiningDate);
      if (!joinDate) {
        errors.joiningDate = "Invalid joining date";
      } else if (data.dateOfBirth) {
        const dob = parseLocalDateParts(data.dateOfBirth);
        if (dob) {
          joinDate.setHours(0, 0, 0, 0);
          const dobZero = new Date(dob);
          dobZero.setHours(0, 0, 0, 0);

          if (joinDate <= dobZero) {
            errors.joiningDate = "Joining date must be after date of birth";
          } else {
            const ageAtJoin = calculateAgeInYears(dobZero, joinDate);
            if (ageAtJoin < 18) {
              errors.joiningDate = "Employee must be at least 18 years old on joining date (Nepal Labour Act requirement)";
            }
          }
        }
      }
    }

    if (data.confirmationDate && data.confirmationDate.trim()) {
      const confDate = parseLocalDateParts(data.confirmationDate);
      if (!confDate) {
        errors.confirmationDate = "Invalid confirmation date";
      } else if (data.joiningDate) {
        const joinDate = parseLocalDateParts(data.joiningDate);
        if (joinDate) {
          confDate.setHours(0, 0, 0, 0);
          joinDate.setHours(0, 0, 0, 0);
          if (confDate < joinDate) {
            errors.confirmationDate = "Confirmation date cannot be before joining date";
          }
        }
      }
    }
  } else if (tabIndex === 2) {
    // 2: Personal Information, Identity Documents, Contacts & Addresses
    // Documents (4.2b): Citizenship or NID required; numbers, districts, issued dates and scans.
    Object.assign(errors, validateDocuments(data.documents ?? [], { dateOfBirth: data.dateOfBirth || "", today: options.today ?? nepalDateIso() }));

    if (data.panNumber && data.panNumber.trim()) {
      const res = validatePanNo(data.panNumber);
      if (!res.isValid) {
        errors.panNumber = res.error || "Invalid PAN number";
      }
    }

    const targetCompanyEmail = data.companyEmail || data.email;
    if (!targetCompanyEmail || !targetCompanyEmail.includes("@") || !targetCompanyEmail.includes(".")) {
      errors.companyEmail = "Valid company email is required";
      errors.email = "Valid company email is required";
    }

    if (data.personalEmail && data.personalEmail.trim()) {
      if (!data.personalEmail.includes("@") || !data.personalEmail.includes(".")) {
        errors.personalEmail = "Invalid personal email address";
      }
    }

    if (!data.mobileNo || !data.mobileNo.trim()) {
      errors.mobileNo = "Mobile number is required";
    } else {
      // A real mobile: landlines belong in Home phone (4.2).
      const phoneRes = validateMobileNumber(data.mobileNo.trim(), true);
      if (!phoneRes.isValid) {
        errors.mobileNo = phoneRes.error || "Enter a mobile number for the chosen country.";
      }
    }

    if (data.phoneHome && data.phoneHome.trim()) {
      const phoneRes = validatePhoneNumber(data.phoneHome.trim(), false);
      if (!phoneRes.isValid) {
        errors.phoneHome = "Enter a valid phone number for the chosen country (landlines need the area code, e.g. 01-4412345).";
      }
    }

    const permAddrRaw = data.permanentAddress || data.address1 || "";
    if (!permAddrRaw.trim()) {
      errors.permanentAddress = "Permanent address is required";
      errors.address1 = "Permanent address is required";
    } else {
      const parsedPerm = parseStructuredAddress(permAddrRaw);
      if (!parsedPerm.province || !parsedPerm.district || !parsedPerm.localLevel) {
        errors.permanentAddress = "Please select Province, District, and Local Level (Palika) for Permanent Address";
        errors.address1 = "Please select Province, District, and Local Level (Palika) for Permanent Address";
      } else if (!isValidWard(parsedPerm.wardNo)) {
        errors.permanentAddress = WARD_ERROR;
      }
    }
    if (data.temporaryAddress?.trim() && !isValidWard(parseStructuredAddress(data.temporaryAddress).wardNo)) {
      errors.temporaryAddress = WARD_ERROR;
    }
  } else if (tabIndex === 3) {
    // 3: Family Information
    if (!data.fatherName?.trim()) {
      errors.fatherName = "Father's name is required";
    }
    if (!data.motherName?.trim()) {
      errors.motherName = "Mother's name is required";
    }
    if (!data.grandfatherName?.trim()) {
      errors.grandfatherName = "Grandfather's name is required";
    }

    if (data.taxStatus === "Married") {
      if (!data.spouseName?.trim()) {
        errors.spouseName = "Spouse's name is required for married employees";
      }
    }
  } else if (tabIndex === 4) {
    // 4: Bank & Termination
    if (!data.bankName?.trim()) errors.bankName = "Bank name is required";
    if (!data.bankBranch?.trim()) errors.bankBranch = "Bank branch is required";
    if (!data.bankAccountNumber?.trim()) errors.bankAccountNumber = "Bank account number is required";

    const isInactive = data.status === "Inactive";
    const hasTerminationDetails = Boolean(
      data.terminationDate?.trim() ||
      data.informedDate?.trim() ||
      data.terminationType ||
      data.terminationReason?.trim()
    );

    if (isInactive || hasTerminationDetails) {
      if (isInactive && !data.terminationDate?.trim()) {
        errors.terminationDate = "Termination/Exit date is required for inactive employees";
      }
      if (isInactive && !data.terminationType) {
        errors.terminationType = "Termination type is required";
      }
      if (isInactive && !data.terminationReason?.trim()) {
        errors.terminationReason = "Termination reason is required";
      }

      if (data.terminationDate && data.terminationDate.trim()) {
        const termDate = parseLocalDateParts(data.terminationDate);
        if (!termDate) {
          errors.terminationDate = "Invalid termination date";
        } else {
          termDate.setHours(0, 0, 0, 0);
          if (data.joiningDate) {
            const joinDate = parseLocalDateParts(data.joiningDate);
            if (joinDate) {
              joinDate.setHours(0, 0, 0, 0);
              if (termDate < joinDate) {
                errors.terminationDate = "Termination date cannot be before joining date";
              }
            }
          }

          if (data.informedDate && data.informedDate.trim()) {
            const infDate = parseLocalDateParts(data.informedDate);
            if (!infDate) {
              errors.informedDate = "Invalid notice/informed date";
            } else {
              infDate.setHours(0, 0, 0, 0);
              if (infDate > termDate) {
                errors.informedDate = "Informed/Notice date cannot be after termination date";
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validates the entire employee form across all 5 sections.
 */
export function validateEmployee(data: EmployeeFormData, options: { today?: string } = {}): EmployeeValidationErrors {
  return {
    ...validateEmployeeTab(data, 0),
    ...validateEmployeeTab(data, 1),
    ...validateEmployeeTab(data, 2, options),
    ...validateEmployeeTab(data, 3),
    ...validateEmployeeTab(data, 4),
  };
}

export interface RegisterNames {
  department: Map<string, string>;
  designation: Map<string, string>;
  branch: Map<string, string>;
  employee: Map<string, string>;
}

/**
 * One register row (S18): list columns only, with the bank account masked and
 * the payroll record gaps worked out on the server.
 */
export function toEmployeeListRow(e: Employee, names: RegisterNames): EmployeeListRow {
  const iso = (d: Date | null | undefined) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toISOString().slice(0, 10) : "");
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    attendanceCode: e.attendanceCode,
    fullName: e.fullName,
    gender: e.gender,
    category: e.category,
    status: e.status,
    departmentId: e.departmentId,
    departmentName: names.department.get(e.departmentId) ?? "",
    designationId: e.designationId,
    designationName: names.designation.get(e.designationId) ?? "",
    branchId: e.branchId,
    branchName: names.branch.get(e.branchId) ?? "",
    shreni: e.shreni,
    supervisorName: e.supervisorId ? (names.employee.get(e.supervisorId) ?? null) : null,
    joiningDate: iso(e.joiningDate),
    mobileNo: e.mobileNo,
    companyEmail: e.companyEmail,
    basicSalary: Number(e.basicSalary) || 0,
    gradeAmount: Number(e.gradeAmount) || 0,
    bankAccountMasked: maskAccountNumber(e.bankAccountNumber),
    bankName: e.bankName,
    photoId: e.photoId ?? null,
    gaps: missingRecords(e),
  };
}

/** Header counts for the register ("128 active · 5 inactive"). */
export function registerCounts(rows: Pick<EmployeeListRow, "status" | "gaps">[]) {
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "Active").length,
    inactive: rows.filter((r) => r.status !== "Active").length,
    toFix: rows.filter((r) => r.status === "Active" && r.gaps.length > 0).length,
  };
}

/**
 * Computes the next sequential Employee Code based on existing employee codes.
 * E.g. ["EMP-001", "EMP-002"] -> "EMP-003"
 */
export function getNextEmployeeCode(existingCodes: string[], defaultPrefix = "EMP-"): string {
  let maxNum = 0;
  let padLength = 3;
  let detectedPrefix: string | null = null;

  for (const code of existingCodes) {
    if (!code || typeof code !== "string" || !code.trim()) continue;
    const clean = code.trim();

    // Check pattern like "EMP-001" or "E001" or "EMP/001"
    const prefixMatch = clean.match(/^([^\d]+)(\d+)$/);
    if (prefixMatch) {
      const num = parseInt(prefixMatch[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, prefixMatch[2].length);
        detectedPrefix = prefixMatch[1];
      }
      continue;
    }

    // Check pure numbers like "101", "102"
    if (/^\d+$/.test(clean)) {
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, clean.length);
      }
      continue;
    }

    // Generic trailing digits match
    const trailingMatch = clean.match(/(\d+)$/);
    if (trailingMatch) {
      const num = parseInt(trailingMatch[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, trailingMatch[1].length);
      }
    }
  }

  const nextNum = maxNum + 1;
  const numStr = String(nextNum).padStart(padLength, "0");
  const prefix = detectedPrefix ?? defaultPrefix;
  return `${prefix}${numStr}`;
}

/**
 * Computes the next sequential Attendance Code based on existing attendance codes.
 * E.g. ["101", "102"] -> "103" or ["ATD-001", "ATD-002"] -> "ATD-003"
 */
export function getNextAttendanceCode(existingCodes: string[], defaultPrefix = "ATD-"): string {
  let maxNum = 0;
  let padLength = 3;
  let detectedPrefix: string | null = null;
  let isPureNumeric = true;
  let countValid = 0;

  for (const code of existingCodes) {
    if (!code || typeof code !== "string" || !code.trim()) continue;
    const clean = code.trim();

    // Check pure numbers e.g. "101", "102", "1"
    if (/^\d+$/.test(clean)) {
      countValid++;
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, clean.length);
      }
      continue;
    }

    isPureNumeric = false;
    // Check prefix + number e.g. "ATD-001"
    const prefixMatch = clean.match(/^([^\d]+)(\d+)$/);
    if (prefixMatch) {
      countValid++;
      const num = parseInt(prefixMatch[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, prefixMatch[2].length);
        detectedPrefix = prefixMatch[1];
      }
      continue;
    }

    const trailingMatch = clean.match(/(\d+)$/);
    if (trailingMatch) {
      countValid++;
      const num = parseInt(trailingMatch[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        padLength = Math.max(padLength, trailingMatch[1].length);
      }
    }
  }

  if (countValid > 0 && isPureNumeric && maxNum > 0) {
    const nextNum = maxNum + 1;
    return String(nextNum).padStart(padLength, "0");
  }

  const nextNum = maxNum + 1;
  const numStr = String(nextNum).padStart(padLength, "0");
  const prefix = detectedPrefix ?? defaultPrefix;
  return `${prefix}${numStr}`;
}

// ---------------------------------------------------------------------------
// Record completeness: shared by the register, the record page and the
// dashboard's "Records to fix" card.
// ---------------------------------------------------------------------------

/** Nepal PAN: 9 digits. */
export function isValidPan(pan: string | null | undefined): boolean {
  return !!pan && /^\d{9}$/.test(pan.trim());
}

export interface RecordCheckSubject {
  panNumber?: string | null;
  bankAccountNumber?: string | null;
  basicSalary?: number | null;
  /** No Citizenship / NID with its issued date and a scan (worked out by the repository). */
  identityScanMissing?: boolean;
}

export const EMPLOYEE_RECORD_CHECKS: {
  id: EmployeeRecordGap;
  label: string;
  impact: string;
  /** Stops payroll or its reports (the dashboard's readiness card shows only these). */
  payroll: boolean;
  failing: (e: RecordCheckSubject) => boolean;
}[] = [
  { id: "pan", label: "PAN missing or invalid", impact: "TDS cannot be reported against the employee", payroll: true, failing: (e) => !isValidPan(e.panNumber) },
  { id: "bank", label: "No bank account", impact: "Left out of the bank transfer file", payroll: true, failing: (e) => !e.bankAccountNumber || e.bankAccountNumber.trim() === "" },
  { id: "basic", label: "Basic salary is zero", impact: "Payslip will calculate as nil", payroll: true, failing: (e) => !(Number(e.basicSalary) > 0) },
  { id: "documents", label: "ID scan or issue date missing", impact: "No copy of the citizenship or National ID on file", payroll: false, failing: (e) => e.identityScanMissing === true },
];

export function missingRecords(e: RecordCheckSubject): EmployeeRecordGap[] {
  return EMPLOYEE_RECORD_CHECKS.filter((c) => c.failing(e)).map((c) => c.id);
}

export const RECORD_GAP_LABEL: Record<EmployeeRecordGap, string> = {
  pan: "PAN missing or invalid",
  bank: "No bank account",
  basic: "Basic salary is zero",
  documents: "ID scan or issue date missing",
};

/** Short form for the register's Records column. */
export const RECORD_GAP_SHORT: Record<EmployeeRecordGap, string> = {
  pan: "PAN",
  bank: "Bank",
  basic: "Basic salary",
  documents: "ID scan",
};

/** Where on the edit form each gap is fixed. */
export const RECORD_GAP_SECTION: Record<EmployeeRecordGap, string> = {
  pan: "documents",
  bank: "bank",
  basic: "pay",
  documents: "documents",
};

// ---------------------------------------------------------------------------
// Scope and audit (security plan S18)
// ---------------------------------------------------------------------------

/**
 * May a user with this scope place an employee in this branch / department?
 * Used on create and on every update, so a branch manager cannot add someone
 * to, or move someone into, a branch they do not manage. SELF scope never
 * places employees. Fails closed for unknown scopes.
 */
export function canPlaceInScope(
  scope: Pick<ScopeFilter, "scopeType" | "branchIds" | "departmentIds">,
  placement: { branchId: string | null | undefined; departmentId: string | null | undefined }
): boolean {
  switch (scope.scopeType) {
    case "GLOBAL":
      return true;
    case "BRANCH":
      return !!placement.branchId && scope.branchIds.includes(placement.branchId);
    case "DEPARTMENT":
      return !!placement.departmentId && scope.departmentIds.includes(placement.departmentId);
    default:
      return false;
  }
}

/** Form fields compared for the audit trail of an update. */
const AUDITED_FIELDS: readonly (keyof EmployeeFormData & keyof Employee)[] = [
  "employeeCode", "attendanceCode", "fullName", "gender", "dateOfBirth", "taxStatus", "isDisabled",
  "category", "shreni", "departmentId", "designationId", "branchId", "supervisorId", "isSupervisor",
  "joiningDate", "confirmationDate", "status", "basicSalary", "gradeCount", "gradeAmount", "gradeManual",
  "panNumber", "phoneHome", "mobileNo", "companyEmail", "personalEmail",
  "permanentAddress", "temporaryAddress", "fatherName", "motherName", "spouseName", "grandfatherName",
  "bankName", "bankBranch", "bankAccountNumber", "informedDate", "terminationDate", "terminationType",
  "terminationReason", "terminationPlan", "terminationRemarks",
];

function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(Number(value));
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = String(value).trim();
  // Form dates arrive as YYYY-MM-DD; stored dates as full ISO strings.
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
}

/**
 * Names of the fields an update changes. Only names go into the audit log:
 * never the values, so PAN, bank and salary figures stay out of it.
 */
export function changedEmployeeFields(before: Partial<Employee>, after: Partial<EmployeeFormData>): string[] {
  const changed: string[] = AUDITED_FIELDS.filter((field) => {
    if (!(field in after)) return false;
    return comparable(before[field]) !== comparable(after[field]);
  });
  // Identity documents (4.2b): one name for any change to the list, its dates or its scans.
  if (after.documents && documentsChanged(before.documents ?? [], after.documents)) changed.push("documents");
  if (typeof after.photoId === "string" && after.photoId !== (before.photoId ?? "")) changed.push("photoId");
  return changed;
}

// ---------------------------------------------------------------------------
// Record page (4.2)
// ---------------------------------------------------------------------------

export const RECORD_TABS: readonly EmployeeRecordTab[] = ["overview", "profile", "leave", "attendance", "payslips", "loans", "history"];

/** The tab to show: the requested one if the user may see it, else Overview. */
export function resolveRecordTab(requested: unknown, allowed: readonly EmployeeRecordTab[]): EmployeeRecordTab {
  return typeof requested === "string" && (allowed as readonly string[]).includes(requested) ? (requested as EmployeeRecordTab) : "overview";
}

type AttendanceBucket = keyof EmployeeAttendanceTabData["totals"];

function attendanceBucket(status: string | null): AttendanceBucket {
  if (!status) return "notRecorded";
  const s = status.toLowerCase();
  if (s.includes("half")) return "halfDay";
  if (s.includes("leave")) return "leave";
  if (s === "present" || s === "late") return "present";
  if (s === "absent") return "absent";
  return "other";
}

/**
 * This month's attendance for one employee: one entry per day so far (BS day
 * numbers), with totals. A day without a record counts as "not recorded",
 * never as absent.
 */
export function attendanceMonth(
  monthLabel: string,
  days: { date: string; bsDay: number; weekday: number }[],
  records: { date: string; status: string; inTime: string | null; outTime: string | null; workHours: number; isLate: boolean }[]
): EmployeeAttendanceTabData {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const totals: EmployeeAttendanceTabData["totals"] = { present: 0, absent: 0, leave: 0, halfDay: 0, other: 0, notRecorded: 0 };
  const out = days.map((d) => {
    const r = byDate.get(d.date);
    totals[attendanceBucket(r?.status ?? null)] += 1;
    return {
      ...d,
      status: r?.status ?? null,
      inTime: r?.inTime ?? null,
      outTime: r?.outTime ?? null,
      workHours: r?.workHours ?? 0,
      isLate: r?.isLate ?? false,
    };
  });
  return { monthLabel, days: out, totals };
}

/** One line for an audit entry on the record's History tab (field names only, never values). */
export function historySummary(entry: { action: string; result: string; newValues: unknown }): string {
  const values = (entry.newValues && typeof entry.newValues === "object" ? entry.newValues : {}) as Record<string, unknown>;
  if (entry.result !== "SUCCESS") {
    return entry.result === "DENIED_SCOPE" ? "Refused: outside the user's branch or department" : `Refused (${entry.result.toLowerCase().replace(/_/g, " ")})`;
  }
  if (values.credentials === "resent") return "Sign-in details sent again";
  if (values.credentials === "reset") return "Password reset and sent";
  switch (entry.action) {
    case "ADD":
      return values.loginCreated ? "Record created, with a self-service login" : "Record created";
    case "DELETE":
      return "Record deleted";
    case "EDIT": {
      const fields = Array.isArray(values.changedFields) ? (values.changedFields as string[]) : [];
      if (fields.length === 0) return "Saved with no changes";
      const labels = fields.map(fieldLabel);
      return labels.length > 4 ? `Changed ${labels.slice(0, 4).join(", ")} and ${labels.length - 4} more` : `Changed ${labels.join(", ")}`;
    }
    default:
      return entry.action.charAt(0) + entry.action.slice(1).toLowerCase();
  }
}


/** Length of service from the joining date, e.g. "2 yr 3 mo"; "Not started" for a future date. */
export function tenureLabel(joining: Date | string | null | undefined, today: Date): string {
  const j = joining ? new Date(joining) : null;
  if (!j || isNaN(j.getTime())) return "";
  let months = (today.getFullYear() - j.getFullYear()) * 12 + (today.getMonth() - j.getMonth());
  if (today.getDate() < j.getDate()) months -= 1;
  if (months < 0) return "Not started";
  if (months === 0) return "Less than a month";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} yr` : "", rest ? `${rest} mo` : ""].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Full-page form (4.2): per-field checks for Enter-to-next, duplicate codes,
// and section progress for the section index.
// ---------------------------------------------------------------------------

/** Which of the existing rule groups checks each field. */
const FIELD_RULE_GROUP: Partial<Record<EmployeeField, number>> = {
  employeeCode: 0, attendanceCode: 0, fullName: 0, dateOfBirth: 0,
  departmentId: 1, branchId: 1, designationId: 1, shreni: 1, gradeCount: 1, gradeAmount: 1, joiningDate: 1, confirmationDate: 1,
  documents: 2, panNumber: 2, companyEmail: 2, personalEmail: 2, mobileNo: 2, phoneHome: 2, permanentAddress: 2, temporaryAddress: 2,
  fatherName: 3, motherName: 3, grandfatherName: 3, spouseName: 3,
  bankName: 4, bankBranch: 4, bankAccountNumber: 4, informedDate: 4, terminationDate: 4, terminationType: 4, terminationReason: 4,
};

/**
 * The error for one field, using exactly the rules the server applies on save
 * (validateEmployeeTab). Null when the field is fine or has no rule.
 */
export function validateEmployeeField(data: EmployeeFormData, field: EmployeeField | `documents.${number}.${string}`): string | null {
  const group = FIELD_RULE_GROUP[field.startsWith("documents.") ? "documents" : (field as EmployeeField)];
  if (group === undefined) return null;
  return validateEmployeeTab(data, group)[field] ?? null;
}

/** Duplicate employee / attendance codes against every code in the company (codes only). */
export function codeConflicts(
  codes: readonly { id: string; employeeCode: string; attendanceCode: string }[],
  data: Pick<EmployeeFormData, "employeeCode" | "attendanceCode">,
  excludeId: string | null
): EmployeeValidationErrors {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const others = codes.filter((c) => c.id !== excludeId);
  const errors: EmployeeValidationErrors = {};
  if (data.employeeCode?.trim() && others.some((c) => same(c.employeeCode, data.employeeCode))) {
    errors.employeeCode = `Employee code ${data.employeeCode.trim()} is already used`;
  }
  if (data.attendanceCode?.trim() && others.some((c) => same(c.attendanceCode, data.attendanceCode))) {
    errors.attendanceCode = `Attendance code ${data.attendanceCode.trim()} is already used`;
  }
  return errors;
}

function isFilled(data: EmployeeFormData, field: EmployeeField): boolean {
  if (field === "documents") return (data.documents ?? []).some((d) => isPrimaryDocument(d.type) && d.number.trim() !== "");
  const value = data[field];
  if (typeof value === "number") return value > 0;
  if (typeof value === "boolean") return true;
  if (field === "permanentAddress") {
    const a = parseStructuredAddress(String(value ?? ""));
    return !!(a.province && a.district && a.localLevel);
  }
  return typeof value === "string" && value.trim() !== "";
}

export interface SectionProgress {
  id: string;
  label: string;
  state: "complete" | "error" | "todo" | "optional";
  errors: number;
  /** Required fields filled / required fields in the section. */
  filled: number;
  required: number;
}

/** Done / errors / still to fill, per form section (section index, group headers, status bar). */
export function sectionProgress(
  data: EmployeeFormData,
  errors: EmployeeValidationErrors,
  sections: readonly EmployeeFormSection[] = EMPLOYEE_FORM_SECTIONS
): SectionProgress[] {
  return sections.map((section) => {
    // Row errors (documents.0.number) count for their list field.
    const count = Object.keys(errors).filter((k) => errors[k] && section.fields.some((f) => k === f || k.startsWith(`${f}.`))).length;
    const required = [...section.required];
    if (section.id === "family" && data.taxStatus === "Married") required.push("spouseName");
    const filled = required.filter((f) => isFilled(data, f)).length;
    const state = count > 0 ? "error" : required.length === 0 ? "optional" : filled === required.length ? "complete" : "todo";
    return { id: section.id, label: section.label, state, errors: count, filled, required: required.length };
  });
}


const SEPARATION_FIELDS = ["informedDate", "terminationDate", "terminationType", "terminationReason", "terminationPlan", "terminationRemarks"] as const;

/** Separation checks only (the Inactive rules of the form), for the status change. */
export function separationErrors(data: EmployeeFormData): EmployeeValidationErrors {
  const all = validateEmployeeTab({ ...data, status: "Inactive" }, 4);
  const errors: EmployeeValidationErrors = {};
  for (const f of SEPARATION_FIELDS) if (all[f]) errors[f] = all[f];
  if (data.terminationType && !["Retirement", "Resignation", "Termination", "Contract End"].includes(data.terminationType)) {
    errors.terminationType = "Choose a separation type";
  }
  if (data.terminationPlan && !["Upadan", "Gratuity", "Pension", "None"].includes(data.terminationPlan)) {
    errors.terminationPlan = "Choose a retirement benefit";
  }
  return errors;
}
