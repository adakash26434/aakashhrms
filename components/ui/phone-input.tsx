"use client";

import React, { useState, useEffect } from "react";
import metadata from "libphonenumber-js/metadata.min.json";
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  getCountries,
  type CountryCode,
} from "libphonenumber-js/core";
import { cn } from "@/lib/utils";

const regionNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function getCountryName(code: CountryCode): string {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}

function getFlagEmoji(countryCode: string): string {
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
}

export const ALL_COUNTRIES: CountryOption[] = (() => {
  const countries = getCountries(metadata).map((code) => ({
    code,
    name: getCountryName(code),
    callingCode: getCountryCallingCode(code, metadata),
    flag: getFlagEmoji(code),
  }));

  // Sort alphabetically by country name
  countries.sort((a, b) => a.name.localeCompare(b.name));

  // Place Nepal (NP) at the very top as default
  const nepalIndex = countries.findIndex((c) => c.code === "NP");
  if (nepalIndex > -1) {
    const [nepal] = countries.splice(nepalIndex, 1);
    countries.unshift(nepal);
  }

  return countries;
})();

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  containerClassName?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "9841123456",
  disabled = false,
  hasError = false,
  className,
  containerClassName,
  id,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("NP");
  const [nationalNumber, setNationalNumber] = useState("");

  // Sync internal state with external value prop
  useEffect(() => {
    if (!value) {
      setNationalNumber("");
      setSelectedCountry("NP");
      return;
    }

    const parsed =
      parsePhoneNumberFromString(value, metadata) ||
      parsePhoneNumberFromString(value, selectedCountry, metadata);

    if (parsed) {
      if (parsed.country) {
        setSelectedCountry(parsed.country);
      }
      setNationalNumber(parsed.nationalNumber);
    } else {
      // Stripping country code if prefix matched
      const callingCode = getCountryCallingCode(selectedCountry, metadata);
      const cleaned = value.replace(
        new RegExp(`^\\+?${callingCode}[-\\s]?`),
        "",
      );
      setNationalNumber(cleaned);
    }
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value as CountryCode;
    setSelectedCountry(newCountry);
    const callingCode = getCountryCallingCode(newCountry, metadata);

    if (nationalNumber) {
      const fullValue = `+${callingCode}${nationalNumber.replace(/\D/g, "")}`;
      onChange(fullValue);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const digitsOnly = inputVal.replace(/[^\d\s-]/g, "");
    setNationalNumber(digitsOnly);

    const callingCode = getCountryCallingCode(selectedCountry, metadata);
    const cleanDigits = digitsOnly.replace(/\D/g, "");

    if (cleanDigits) {
      const fullValue = `+${callingCode}${cleanDigits}`;
      onChange(fullValue);
    } else {
      onChange("");
    }
  };

  const currentCallingCode = getCountryCallingCode(selectedCountry, metadata);

  return (
    <div className={cn("flex items-center gap-2 w-full min-w-0", containerClassName)}>
      <div className="relative shrink-0">
        <select
          suppressHydrationWarning
          value={selectedCountry}
          onChange={handleCountryChange}
          disabled={disabled}
          className={cn(
            "h-10 max-w-[125px] sm:max-w-[140px] rounded-xl border border-payroll-light bg-payroll-cream px-2.5 text-xs font-semibold text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-2 focus:ring-payroll-primary cursor-pointer disabled:opacity-50 text-ellipsis overflow-hidden transition-all shadow-sm",
            hasError &&
              "border-rose-300 bg-rose-50/40 text-rose-800 focus:ring-rose-500",
          )}
        >
          {ALL_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code} suppressHydrationWarning>
              {c.flag} {c.name} (+{c.callingCode})
            </option>
          ))}
        </select>
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-gray-400 font-mono">
          +{currentCallingCode}
        </div>
        <input
          id={id}
          type="tel"
          value={nationalNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full h-10 rounded-xl border border-payroll-light bg-payroll-cream pl-12 pr-3.5 text-sm text-payroll-navy placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-payroll-primary disabled:opacity-50 transition-all shadow-sm font-sans",
            hasError &&
              "border-rose-300 focus:border-transparent focus:ring-rose-500 bg-rose-50/40 text-rose-900 placeholder:text-rose-300",
            className,
          )}
        />
      </div>
    </div>
  );
}
