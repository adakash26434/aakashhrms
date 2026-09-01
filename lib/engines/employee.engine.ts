import type { Employee, EmployeeFormData, EmployeeValidationErrors, EmployeeKPIs } from "@/lib/types/employee";
import { validatePhoneNumber } from "@/lib/utils/phone";
import {
  validateCitizenshipNo,
  validateNIDNo,
  validatePassportNo,
  validateVoterIdNo,
  validatePanNo,
} from "@/lib/utils/nepal-docs";
import { parseStructuredAddress } from "@/lib/constants/nepal-locations";

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
export function validateEmployeeTab(data: EmployeeFormData, tabIndex: number): EmployeeValidationErrors {
  const errors: EmployeeValidationErrors = {};

  if (tabIndex === 0) {
    // 0: General Information
    if (!data.attendanceCode?.trim()) errors.attendanceCode = "Attendance code is required";
    if (!data.employeeCode?.trim()) errors.employeeCode = "Employee code is required";
    if (!data.firstName?.trim()) errors.firstName = "First name is required";
    if (!data.lastName?.trim()) errors.lastName = "Last name is required";

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
    if (!data.salaryGrade?.trim()) errors.salaryGrade = "Salary grade is required";
    if (data.gradePercent < 0) errors.gradePercent = "Grade percent cannot be negative";
    if (data.gradeAmount < 0) errors.gradeAmount = "Grade amount cannot be negative";

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

    if (data.retirementDateProjected && data.retirementDateProjected.trim()) {
      const retDate = parseLocalDateParts(data.retirementDateProjected);
      if (!retDate) {
        errors.retirementDateProjected = "Invalid retirement date";
      } else {
        retDate.setHours(0, 0, 0, 0);
        if (data.joiningDate) {
          const joinDate = parseLocalDateParts(data.joiningDate);
          if (joinDate) {
            joinDate.setHours(0, 0, 0, 0);
            if (retDate <= joinDate) {
              errors.retirementDateProjected = "Projected retirement date must be after joining date";
            }
          }
        }
        if (data.confirmationDate && data.confirmationDate.trim()) {
          const confDate = parseLocalDateParts(data.confirmationDate);
          if (confDate) {
            confDate.setHours(0, 0, 0, 0);
            if (retDate <= confDate) {
              errors.retirementDateProjected = "Projected retirement date must be after confirmation date";
            }
          }
        }
      }
    }
  } else if (tabIndex === 2) {
    // 2: Personal Information, Identity Documents, Contacts & Addresses
    if (!data.citizenshipNo?.trim()) {
      errors.citizenshipNo = "Citizenship number is required";
    } else {
      const res = validateCitizenshipNo(data.citizenshipNo);
      if (!res.isValid) {
        errors.citizenshipNo = res.error || "Invalid citizenship number";
      }
    }

    if (data.citizenshipNo?.trim() && !data.issuingDistrict?.trim()) {
      errors.issuingDistrict = "Citizenship issuing district is required";
    }

    if (data.nidNo && data.nidNo.trim()) {
      const res = validateNIDNo(data.nidNo);
      if (!res.isValid) {
        errors.nidNo = res.error || "Invalid NID number";
      }
      if (!data.nidIssuingDistrict?.trim()) {
        errors.nidIssuingDistrict = "NID issuing district is required when NID is entered";
      }
    }

    if (data.passportNo && data.passportNo.trim()) {
      const res = validatePassportNo(data.passportNo);
      if (!res.isValid) {
        errors.passportNo = res.error || "Invalid passport number";
      }
      if (!data.passportIssuingDistrict?.trim()) {
        errors.passportIssuingDistrict = "Passport issuing district is required when passport is entered";
      }
    }

    if (data.votersId && data.votersId.trim()) {
      const res = validateVoterIdNo(data.votersId);
      if (!res.isValid) {
        errors.votersId = res.error || "Invalid voter ID";
      }
      if (!data.voterIdIssuingDistrict?.trim()) {
        errors.voterIdIssuingDistrict = "Voter ID issuing district is required when voter ID is entered";
      }
    }

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
      const phoneRes = validatePhoneNumber(data.mobileNo.trim(), true);
      if (!phoneRes.isValid) {
        errors.mobileNo = phoneRes.error || "Invalid mobile number for Nepal (+977)";
      }
    }

    if (data.phoneHome && data.phoneHome.trim()) {
      const phoneRes = validatePhoneNumber(data.phoneHome.trim(), false);
      if (!phoneRes.isValid) {
        errors.phoneHome = phoneRes.error || "Invalid home phone number";
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
      }
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
    const isTerminated = data.status === "Terminated";
    const hasTerminationDetails = Boolean(
      data.terminationDate?.trim() ||
      data.informedDate?.trim() ||
      data.terminationType ||
      data.terminationReason?.trim()
    );

    if (isTerminated || hasTerminationDetails) {
      if (isTerminated && !data.terminationDate?.trim()) {
        errors.terminationDate = "Termination/Retirement date is required for terminated employees";
      }
      if (isTerminated && !data.terminationType) {
        errors.terminationType = "Termination type is required";
      }
      if (isTerminated && !data.terminationReason?.trim()) {
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
export function validateEmployee(data: EmployeeFormData): EmployeeValidationErrors {
  return {
    ...validateEmployeeTab(data, 0),
    ...validateEmployeeTab(data, 1),
    ...validateEmployeeTab(data, 2),
    ...validateEmployeeTab(data, 3),
    ...validateEmployeeTab(data, 4),
  };
}

export function calculateEmployeeKPIs(employees: Employee[], departmentsCount: number): EmployeeKPIs {
  return {
    total: employees.length,
    active: employees.filter((e) => e.status === "Active").length,
    onLeave: employees.filter((e) => e.status === "On Leave").length,
    terminated: employees.filter((e) => e.status === "Terminated").length,
    departmentsCount,
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

