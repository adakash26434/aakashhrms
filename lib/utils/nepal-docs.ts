/**
 * Validation utilities for Nepal Official Identity Documents:
 * - Citizenship Number (नागरिकता नं)
 * - National Identity Card Number (NID / राष्ट्रिय परिचयपत्र नं)
 * - Passport Number (राहदानी नं)
 * - Voter ID (मतदाता परिचयपत्र नं)
 * - Permanent Account Number (PAN / स्थायी लेखा नम्बर)
 */

export interface DocValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

/**
 * Validates Nepal Citizenship Number.
 * Accommodates diverse formats across generations:
 * - Computerized: `27-01-75-01234`
 * - Older/Regional: `123/4567`, `12-34-56789`, `12345`, `BA-1234`
 * Permissive check: 2 to 50 characters, alphanumeric with optional dash/slash/space separators.
 */
export function validateCitizenshipNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim();

  // Allow alphanumeric characters, hyphens, slashes, and spaces
  if (!/^[a-zA-Z0-9\-\/\s]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Citizenship number should contain letters, digits, and separators (- /)",
    };
  }

  if (clean.length < 2) {
    return {
      isValid: false,
      error: "Citizenship number must be at least 2 characters",
    };
  }

  if (clean.length > 50) {
    return {
      isValid: false,
      error: "Citizenship number is too long (maximum 50 characters)",
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates National Identity Card (NID) Number.
 * Nepal DoNIDCR standard is 10 digits, but provisional/hyphenated formats are accepted.
 */
export function validateNIDNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim();
  const digitsOnly = clean.replace(/[\s\-]/g, "");

  if (!/^[0-9\s\-]+$/.test(clean)) {
    return {
      isValid: false,
      error: "NID number must contain only numeric digits and hyphens",
    };
  }

  if (digitsOnly.length < 5 || digitsOnly.length > 20) {
    return {
      isValid: false,
      error: "NID number must be between 5 and 20 digits",
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates Passport Number.
 * Supports Nepal MRP, e-Passports, older passports, and expatriate passports (4-25 alphanumeric).
 */
export function validatePassportNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim().toUpperCase();

  if (!/^[A-Z0-9\-\/\s]{4,25}$/.test(clean)) {
    return {
      isValid: false,
      error: "Passport number must be 4 to 25 alphanumeric characters",
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates Nepal Election Commission Voter ID Number.
 * Flexible format: 3 to 25 alphanumeric characters.
 */
export function validateVoterIdNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim().toUpperCase();

  if (!/^[A-Z0-9\-\/\s]{3,25}$/.test(clean)) {
    return {
      isValid: false,
      error: "Voter ID must be 3 to 25 alphanumeric characters",
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates Nepal IRD PAN Number.
 * Standard: Exactly 9 numeric digits (e.g. `123456789`).
 */
export function validatePanNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim().replace(/[\s\-]/g, "");

  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      error: "PAN Number must contain numbers only",
    };
  }

  if (clean.length !== 9) {
    return {
      isValid: false,
      error: `PAN Number in Nepal must be exactly 9 digits (entered ${clean.length} digits)`,
    };
  }

  return { isValid: true, formatted: clean };
}
