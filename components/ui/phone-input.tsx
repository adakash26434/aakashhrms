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
  selectClassName?: string;
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
  selectClassName,
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
    <div
      className={cn(
        "flex items-center w-full min-w-0 rounded-lg border border-slate-200 bg-white shadow-2xs transition-colors hover:border-slate-300 focus-within:border-[#1e7e47] focus-within:ring-1 focus-within:ring-[#1e7e47]",
        hasError && "border-red-500 focus-within:border-red-500 focus-within:ring-red-500 bg-red-50/20",
        containerClassName,
      )}
    >
      <div className="relative shrink-0">
        <select
          suppressHydrationWarning
          value={selectedCountry}
          onChange={handleCountryChange}
          disabled={disabled}
          className={cn(
            "h-10 max-w-27.5 sm:max-w-32.5 rounded-l-lg border-0 border-r border-slate-200 bg-slate-50/80 px-2 text-xs font-medium text-slate-700 focus:outline-none cursor-pointer disabled:opacity-50 text-ellipsis overflow-hidden",
            hasError && "text-red-700 bg-red-50/40",
            selectClassName,
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
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-gray-400 font-mono">
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
            "w-full h-10 rounded-r-lg border-0 bg-transparent pl-11 pr-3 text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50",
            hasError && "text-red-900 placeholder:text-red-300",
            className,
          )}
        />
      </div>
    </div>
  );
}
