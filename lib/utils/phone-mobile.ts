// Mobile-only check (4.2). Kept apart from lib/utils/phone.ts because the
// mobile metadata is ~100 kB and only the employee form and its server checks need it.

import metadata from 'libphonenumber-js/metadata.min.json';
import mobileMetadata from 'libphonenumber-js/metadata.mobile.json';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/core';
import type { PhoneValidationResult } from './phone';

const NEPAL_MOBILE = /^9[678]\d{8}$/;
const MOBILE_FORMAT_ERROR = 'Enter a mobile number for the chosen country.';

/**
 * Validates a MOBILE number (4.2): landlines are refused. Nepal numbers must
 * have 10 digits starting 96, 97 or 98; other countries use the phone
 * library's mobile-only metadata.
 */
export function validateMobileNumber(raw?: string | null, required = false, defaultCountry: CountryCode = 'NP'): PhoneValidationResult {
  if (!raw || !raw.trim()) return required ? { isValid: false, error: 'Mobile number is required.' } : { isValid: true };
  const clean = raw.trim();
  try {
    const parsed = parsePhoneNumberFromString(clean, metadata) || parsePhoneNumberFromString(clean, defaultCountry, metadata);
    if (!parsed) return { isValid: false, error: MOBILE_FORMAT_ERROR };
    if (parsed.country === 'NP' || (!parsed.country && parsed.countryCallingCode === '977')) {
      if (!NEPAL_MOBILE.test(parsed.nationalNumber)) {
        return { isValid: false, error: 'Nepal mobile numbers have 10 digits and start with 96, 97 or 98.' };
      }
    } else {
      const mobile = parsePhoneNumberFromString(parsed.number, mobileMetadata);
      if (!mobile || !mobile.isValid()) return { isValid: false, error: MOBILE_FORMAT_ERROR };
    }
    return { isValid: true, formatted: parsed.formatInternational(), nationalFormatted: parsed.formatNational(), countryCode: parsed.country };
  } catch {
    return { isValid: false, error: MOBILE_FORMAT_ERROR };
  }
}
