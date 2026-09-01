import metadata from 'libphonenumber-js/metadata.min.json';
import { parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from 'libphonenumber-js/core';

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  nationalFormatted?: string;
  countryCode?: string;
  error?: string;
}

/**
 * Validates any contact, employee, branch, or company phone number.
 * Supports international dial codes with default fallback to Nepal ('NP').
 * 
 * @param raw - The input phone number string (e.g. "+977 9800000000", "9841234567", "01-4412345")
 * @param required - Whether an empty value should be considered an error (default: false)
 * @param defaultCountry - Default country ISO 2-letter code when no international '+' prefix is provided (default: 'NP')
 */
export function validatePhoneNumber(
  raw?: string | null,
  required = false,
  defaultCountry: CountryCode = 'NP'
): PhoneValidationResult {
  if (!raw || !raw.trim()) {
    if (required) {
      return {
        isValid: false,
        error: 'Phone number is required.',
      };
    }
    return { isValid: true };
  }

  const clean = raw.trim();

  try {
    const parsed: PhoneNumber | undefined =
      parsePhoneNumberFromString(clean, metadata) ||
      parsePhoneNumberFromString(clean, defaultCountry, metadata);

    if (!parsed || !parsed.isValid()) {
      return {
        isValid: false,
        error: 'Invalid phone number format. Please enter a valid number (e.g. +977 9800000000 or 01-4XXXXXX).',
      };
    }

    return {
      isValid: true,
      formatted: parsed.formatInternational(),
      nationalFormatted: parsed.formatNational(),
      countryCode: parsed.country,
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid phone number format. Please enter a valid number (e.g. +977 9800000000 or 01-4XXXXXX).',
    };
  }
}

/**
 * Quick boolean check if a phone number string is valid.
 */
export function isValidPhoneNumber(raw?: string | null, defaultCountry: CountryCode = 'NP'): boolean {
  return validatePhoneNumber(raw, false, defaultCountry).isValid;
}

/**
 * Formats a raw phone string to clean international format if valid, or returns original string.
 */
export function formatPhoneNumber(raw?: string | null, defaultCountry: CountryCode = 'NP'): string {
  const res = validatePhoneNumber(raw, false, defaultCountry);
  return res.formatted || (raw ? raw.trim() : '');
}
