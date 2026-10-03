import metadata from 'libphonenumber-js/metadata.min.json';
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from 'libphonenumber-js/core';

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

/**
 * Stored form of a phone number: E.164 ("+9779841123456") when it parses,
 * otherwise the trimmed input (validation reports the problem separately).
 */
export function toE164Phone(raw?: string | null, defaultCountry: CountryCode = 'NP'): string {
  const clean = (raw ?? '').trim();
  if (!clean) return '';
  try {
    const parsed = parsePhoneNumberFromString(clean, metadata) || parsePhoneNumberFromString(clean, defaultCountry, metadata);
    return parsed && parsed.isValid() ? parsed.number : clean;
  } catch {
    return clean;
  }
}

/**
 * A stored number split for a country + number field: "+9779841123456" →
 * { country: "NP", national: "9841123456" }. Text that does not parse stays
 * in `national` with the fallback country.
 */
export function splitPhone(value?: string | null, fallback: CountryCode = 'NP'): { country: CountryCode; national: string } {
  const clean = (value ?? '').trim();
  if (!clean) return { country: fallback, national: '' };
  try {
    const parsed = parsePhoneNumberFromString(clean, metadata) || parsePhoneNumberFromString(clean, fallback, metadata);
    // Nepal numbers show as people write them ("984-1234567", "01-4412345").
    if (parsed) return { country: parsed.country ?? fallback, national: parsed.country === 'NP' ? parsed.formatNational() : parsed.nationalNumber };
  } catch {
    // fall through
  }
  return { country: fallback, national: clean.replace(/^\+/, '') };
}

/** The stored value of a country + number field: "+<dial code><digits>", or "" when there are no digits. */
export function joinPhone(country: CountryCode, national: string): string {
  const digits = national.replace(/\D/g, '');
  if (!digits) return '';
  try {
    // Drops a trunk "0" ("01-4412345" → "+97714412345").
    const parsed = parsePhoneNumberFromString(national, country, metadata);
    if (parsed && parsed.countryCallingCode === getCountryCallingCode(country, metadata)) return parsed.number;
  } catch {
    // fall through
  }
  return `+${getCountryCallingCode(country, metadata)}${digits}`;
}

/** The country a typed international number ("+91 98…") belongs to, if it can tell. */
export function countryOfTyped(typed: string): CountryCode | undefined {
  if (!typed.trim().startsWith('+')) return undefined;
  try {
    return parsePhoneNumberFromString(typed.trim(), metadata)?.country;
  } catch {
    return undefined;
  }
}
