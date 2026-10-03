// Countries for phone numbers: ISO code, English name and dial code, built at
// run time from libphonenumber-js (about 245), sorted by name with Nepal first.
// Shared by the kit PhoneField and the older components/ui/phone-input.tsx.

import metadata from "libphonenumber-js/metadata.min.json";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/core";
import type { ComboOption } from "@/lib/kit/combobox";

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

function countryName(code: CountryCode): string {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}

function flagEmoji(code: string): string {
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return "";
  }
}

export const DEFAULT_PHONE_COUNTRY: CountryCode = "NP";

export const ALL_COUNTRIES: CountryOption[] = (() => {
  const countries = getCountries(metadata).map((code) => ({
    code,
    name: countryName(code),
    callingCode: getCountryCallingCode(code, metadata),
    flag: flagEmoji(code),
  }));
  countries.sort((a, b) => a.name.localeCompare(b.name));
  const nepal = countries.findIndex((c) => c.code === DEFAULT_PHONE_COUNTRY);
  if (nepal > 0) countries.unshift(...countries.splice(nepal, 1));
  return countries;
})();

export function countryByCode(code: string): CountryOption | undefined {
  return ALL_COUNTRIES.find((c) => c.code === code);
}

/** The country list as searchable options: by name, ISO code or dial code ("977", "+91", "IN"). */
export const COUNTRY_SEARCH_OPTIONS: ComboOption[] = ALL_COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
  hint: `+${c.callingCode}`,
  keywords: `${c.code} ${c.callingCode} +${c.callingCode}`,
}));
