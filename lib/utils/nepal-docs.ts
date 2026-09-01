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
 * Format examples:
 * - Computerized/Modern: `27-01-75-01234` or `12-01-72-12345` (District-Municipality/Year-Serial)
 * - Older formats: `123/4567`, `12-34-56789`, `12345/6789`, `123456`
 * Strict rules: 4 to 25 characters, digits with optional dash/slash separators, NO letters or symbols.
 */
export function validateCitizenshipNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim();

  // Must contain only numeric digits and separators (- / space)
  if (!/^[0-9\-\/\s]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Citizenship number must contain only digits and separators (e.g. 27-01-75-01234 or 123/4567)",
    };
  }

  // Extract digits only
  const digitsOnly = clean.replace(/[^0-9]/g, "");
  if (digitsOnly.length < 4) {
    return {
      isValid: false,
      error: "Citizenship number must contain at least 4 digits (e.g. 27-01-75-01234)",
    };
  }

  if (digitsOnly.length > 18 || clean.length > 25) {
    return {
      isValid: false,
      error: "Citizenship number is too long (maximum 18 digits)",
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates National Identity Card (NID) Number.
 * Nepal DoNIDCR standard: Exactly 10 numeric digits (e.g. `123-456-7890` or `1234567890`).
 */
export function validateNIDNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim();
  const digitsOnly = clean.replace(/[\s\-]/g, "");

  // Check if non-allowed characters present
  if (!/^[0-9\s\-]+$/.test(clean)) {
    return {
      isValid: false,
      error: "NID number must contain only 10 numeric digits (e.g. 1234567890 or 123-456-7890)",
    };
  }

  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: `National ID (NID) in Nepal must be exactly 10 digits (entered ${digitsOnly.length} digits)`,
    };
  }

  // Format as XXX-XXX-XXXX
  const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  return { isValid: true, formatted };
}

/**
 * Validates Nepal Passport Number (MRP / e-Passport).
 * Standard format: 1 or 2 letters followed by 7 or 8 digits, total 7-9 characters (e.g. `PA1234567`, `08123456`, `PC0123456`, `P1234567`).
 */
export function validatePassportNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim().toUpperCase();

  if (!/^[A-Z0-9]{7,9}$/.test(clean)) {
    return {
      isValid: false,
      error: `Passport number in Nepal must be 7 to 9 alphanumeric characters without spaces or hyphens (e.g. PA1234567, entered "${clean}")`,
    };
  }

  return { isValid: true, formatted: clean };
}

/**
 * Validates Nepal Election Commission Voter ID Number.
 * Format: 7 to 12 alphanumeric characters / digits (e.g. `12345678`, `012345678`, `1234567890`).
 */
export function validateVoterIdNo(val: string): DocValidationResult {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  const clean = val.trim().toUpperCase().replace(/[\s]/g, "");

  if (!/^[A-Z0-9\-\/]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Voter ID must contain only letters, numbers, and hyphens/slashes",
    };
  }

  const coreChars = clean.replace(/[\-\/]/g, "");
  if (coreChars.length < 7 || coreChars.length > 12) {
    return {
      isValid: false,
      error: `Voter ID number must be 7 to 12 characters (e.g. 12345678, entered ${coreChars.length})`,
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
