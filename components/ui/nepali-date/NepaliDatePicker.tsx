"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  adToBS,
  bsToAD,
  formatADDate,
  getDaysInBSMonth,
  isValidBSDate,
  BS_MONTHS_EN,
} from "@/lib/utils/bs-calendar";
import {
  formatDateInput,
  toNepaliNumerals,
  fromNepaliNumerals,
  NEPALI_DIGITS,
} from "@/lib/utils/date-input-formatter";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown, Eraser } from "lucide-react";

export { toNepaliNumerals, fromNepaliNumerals };

export interface NepaliDatePickerProps {
  /** Current value as an AD `Date` (from form state). */
  value: Date | null;
  /** Called with the AD `Date` when a valid date is selected, or null when cleared. */
  onChange: (adDate: Date) => void;
  /** Optional clear handler. */
  onClear?: () => void;
  /** Force calendar mode ("BS" or "AD"). If omitted, uses active DateFormatContext. */
  mode?: "BS" | "AD";
  /** Field label shown above the picker. */
  label?: string;
  /** Shows a red asterisk on the label. */
  required?: boolean;
  /** Disables all controls. */
  disabled?: boolean;
  /** Earliest selectable BS year. Defaults to 1976 (covers employee DOBs). */
  minBSYear?: number;
  /** Latest selectable BS year. Defaults to 2100. */
  maxBSYear?: number;
  /** Earliest selectable AD year. Defaults to 1920. */
  minADYear?: number;
  /** Latest selectable AD year. Defaults to 2050. */
  maxADYear?: number;
  /** Validation error shown below the picker. */
  error?: string;
  className?: string;
  placeholder?: string;
}

const BS_MONTHS_NAMES = [
  "",
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भाद्र",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पौष",
  "माघ",
  "फागुन",
  "चैत्र",
] as const;

const BS_WEEKDAYS = ["आ", "सो", "मं", "बु", "बि", "शु", "श"] as const;
const AD_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const AD_MONTHS_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Sleek, high-precision calendar popup supporting both BS and AD calendars,
 * styled with our canonical AakashHRMS lush green system palette:
 * - Smart auto-slash formatting when typing YYYY/MM/DD manually
 * - Forest-green header with circular nav buttons (< >) and Month / Year selectors
 * - Weekday initials header (आ सो मं बु बि शु श / Su Mo Tu We Th Fr Sa)
 * - Mint-green day cells with signature soft-yellow highlight for selected dates
 * - Attached deep-forest green eraser button for instant clearing
 */
export function NepaliDatePicker({
  value,
  onChange,
  onClear,
  mode: forcedMode,
  label,
  required = false,
  disabled = false,
  minBSYear = 1976,
  maxBSYear = 2100,
  minADYear = 1920,
  maxADYear = 2050,
  error,
  className,
  placeholder = "YYYY/MM/DD",
}: NepaliDatePickerProps) {
  const { isAD: globalIsAD } = useDateFormat();
  const activeMode = forcedMode ?? (globalIsAD ? "AD" : "BS");
  const isBS = activeMode === "BS";

  const containerRef = useRef<HTMLDivElement>(null);
  const prevInputRef = useRef<string>("");
  const [isOpen, setIsOpen] = useState(false);

  // Fallback defaults
  const today = useMemo(() => new Date(), []);
  const todayBS = useMemo(() => adToBS(today), [today]);

  // Selected date representations
  const selectedBS = useMemo(() => {
    if (!value || isNaN(value.getTime())) return null;
    return adToBS(value);
  }, [value]);

  const selectedAD = useMemo(() => {
    if (!value || isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }, [value]);

  // Current calendar view
  const [viewYear, setViewYear] = useState<number>(() => {
    if (isBS) {
      return selectedBS?.year || todayBS.year || 2081;
    }
    return selectedAD?.year || today.getFullYear() || 2026;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (isBS) {
      return selectedBS?.month || todayBS.month || 1;
    }
    return selectedAD?.month || today.getMonth() + 1;
  });

  // Text inside the input field
  const [inputText, setInputText] = useState<string>("");

  // Synchronize input text and view position when value or mode changes
  useEffect(() => {
    if (!value || isNaN(value.getTime())) {
      setInputText("");
      prevInputRef.current = "";
      if (isBS) {
        setViewYear(todayBS.year);
        setViewMonth(todayBS.month);
      } else {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth() + 1);
      }
      return;
    }
    if (isBS) {
      const bs = adToBS(value);
      const str = `${bs.year}/${pad2(bs.month)}/${pad2(bs.day)}`;
      setInputText(str);
      prevInputRef.current = str;
      setViewYear(bs.year);
      setViewMonth(bs.month);
    } else {
      const y = value.getFullYear();
      const m = value.getMonth() + 1;
      const d = value.getDate();
      const str = `${y}/${pad2(m)}/${pad2(d)}`;
      setInputText(str);
      prevInputRef.current = str;
      setViewYear(y);
      setViewMonth(m);
    }
  }, [value, isBS, todayBS, today]);

  // Dismiss popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Previous month handler
  function handlePrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  // Next month handler
  function handleNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // Count days in viewing month
  const daysCount = useMemo(() => {
    if (isBS) {
      return getDaysInBSMonth(viewYear, viewMonth) || 30;
    }
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [isBS, viewYear, viewMonth]);

  // Starting weekday of the month (0 = Sun, 1 = Mon, ... 6 = Sat)
  const startDayOfWeek = useMemo(() => {
    if (isBS) {
      try {
        const firstDayAD = bsToAD(viewYear, viewMonth, 1);
        return firstDayAD.getDay();
      } catch {
        return 0;
      }
    }
    return new Date(viewYear, viewMonth - 1, 1).getDay();
  }, [isBS, viewYear, viewMonth]);

  // Day selection
  function handleSelectDay(day: number) {
    if (isBS) {
      const adDate = bsToAD(viewYear, viewMonth, day);
      onChange(adDate);
      const str = `${viewYear}/${pad2(viewMonth)}/${pad2(day)}`;
      setInputText(str);
      prevInputRef.current = str;
    } else {
      const adDate = new Date(viewYear, viewMonth - 1, day);
      onChange(adDate);
      const str = `${viewYear}/${pad2(viewMonth)}/${pad2(day)}`;
      setInputText(str);
      prevInputRef.current = str;
    }
    setIsOpen(false);
  }

  // Clear handler (eraser icon)
  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setInputText("");
    prevInputRef.current = "";
    if (onClear) {
      onClear();
    } else {
      (onChange as any)(null);
    }
  }

  /**
   * Smart automatic slash `/` insertion on manual keyboard typing with strict validation:
   * - Month strictly clamped between 01 and 12 (cannot type > 12, cannot type 00)
   * - Day strictly clamped between 01 and maximum days for that specific year and month
   *   (28-32 days in BS, 28-31 days in AD)
   * - Live synchronization of calendar view month and year as the user types
   * - Respects backspacing seamlessly so the user never gets stuck
   */
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const result = formatDateInput({
      raw,
      prevValue: prevInputRef.current,
      isBS,
      minYear: isBS ? minBSYear : minADYear,
      maxYear: isBS ? maxBSYear : maxADYear,
    });

    prevInputRef.current = result.formatted;
    setInputText(result.formatted);

    // Live calendar view updates as the user types
    const min = isBS ? minBSYear : minADYear;
    const max = isBS ? maxBSYear : maxADYear;
    if (result.year && result.year >= min && result.year <= max) {
      setViewYear(result.year);
    }
    if (result.month && result.month >= 1 && result.month <= 12) {
      setViewMonth(result.month);
    }

    // When a valid complete date (YYYY/MM/DD) is reached, update state
    if (result.isValid && result.year && result.month && result.day) {
      if (isBS) {
        const ad = bsToAD(result.year, result.month, result.day);
        if (!isNaN(ad.getTime())) {
          onChange(ad);
        }
      } else {
        const ad = new Date(result.year, result.month - 1, result.day);
        if (!isNaN(ad.getTime())) {
          onChange(ad);
        }
      }
    }
  }

  function handleBlur() {
    // If input was completely emptied, trigger clear
    if (!inputText.trim()) {
      if (value) {
        if (onClear) {
          onClear();
        } else {
          (onChange as any)(null);
        }
      }
      return;
    }

    // If input has an incomplete or partial date, restore to the last valid value or clear
    const parts = inputText.split("/").map(Number);
    const isComplete =
      parts.length === 3 && parts[0] > 0 && parts[1] > 0 && parts[2] > 0;
    if (!isComplete) {
      if (value && !isNaN(value.getTime())) {
        if (isBS) {
          const bs = adToBS(value);
          const str = `${bs.year}/${pad2(bs.month)}/${pad2(bs.day)}`;
          setInputText(str);
          prevInputRef.current = str;
        } else {
          const str = `${value.getFullYear()}/${pad2(value.getMonth() + 1)}/${pad2(value.getDate())}`;
          setInputText(str);
          prevInputRef.current = str;
        }
      } else {
        setInputText("");
        prevInputRef.current = "";
      }
    }
  }

  // Year options list - dynamically includes viewYear so navigation across decades never drops out
  const yearOptions = useMemo(() => {
    const min = isBS ? minBSYear : minADYear;
    const max = isBS ? maxBSYear : maxADYear;
    const start = Math.min(min, viewYear);
    const end = Math.max(max, viewYear);
    const list: number[] = [];
    for (let y = start; y <= end; y++) list.push(y);
    return list;
  }, [isBS, minBSYear, maxBSYear, minADYear, maxADYear, viewYear]);

  // Day states
  function isSelectedDay(day: number): boolean {
    if (isBS) {
      return Boolean(
        selectedBS &&
          selectedBS.year === viewYear &&
          selectedBS.month === viewMonth &&
          selectedBS.day === day,
      );
    }
    return Boolean(
      selectedAD &&
        selectedAD.year === viewYear &&
        selectedAD.month === viewMonth &&
        selectedAD.day === day,
    );
  }

  function isTodayDay(day: number): boolean {
    if (isBS) {
      return (
        todayBS.year === viewYear &&
        todayBS.month === viewMonth &&
        todayBS.day === day
      );
    }
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() + 1 === viewMonth &&
      today.getDate() === day
    );
  }

  return (
    <div ref={containerRef} className={cn("relative inline-block w-full", className)}>
      {label && (
        <label className="mb-1 block text-xs font-bold text-payroll-navy">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}

      {/* Input Group with Attached Greenish Eraser Button */}
      <div
        className={cn(
          "relative flex items-center rounded-lg border bg-white shadow-xs transition-all text-payroll-navy",
          isOpen
            ? "border-payroll-primary ring-2 ring-payroll-primary/20"
            : error
              ? "border-rose-400 focus-within:ring-1 focus-within:ring-rose-500"
              : "border-payroll-light/80 hover:border-gray-300 focus-within:ring-1 focus-within:ring-payroll-primary",
          disabled && "cursor-not-allowed bg-gray-50 opacity-70",
        )}
      >
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent py-2 pl-3 pr-10 text-xs sm:text-sm font-mono font-medium placeholder-gray-400 focus:outline-none"
        />

        {/* Attached Eraser Button (Deep System Forest Navy/Green) */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={handleClear}
          title="Clear date"
          className="absolute right-0 top-0 bottom-0 px-2.5 bg-payroll-navy hover:bg-payroll-primary-hover text-white rounded-r-lg flex items-center justify-center transition-colors shadow-inner"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Opposite Calendar Context Hint */}
      {value && !isNaN(value.getTime()) && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <span>
            {isBS
              ? `A.D.: ${formatADDate(value, "long")}`
              : `B.S.: ${(() => {
                  const bs = adToBS(value);
                  return `${bs.year}/${pad2(bs.month)}/${pad2(bs.day)} (${bs.monthName})`;
                })()}`}
          </span>
          <span className="text-[10px] uppercase font-bold text-payroll-primary tracking-wider">
            {isBS ? "B.S. Calendar" : "A.D. Calendar"}
          </span>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-rose-600 font-semibold" role="alert">
          {error}
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          POPUP CALENDAR MODAL (GREENISH PALETTE MATCHING SYSTEM)
         ══════════════════════════════════════════════════════════════════════ */}
      {isOpen && !disabled && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-payroll-light bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: "268px" }}
        >
          {/* Header Bar — System Emerald/Forest Green */}
          <div className="rounded-t-lg bg-linear-to-r from-payroll-primary to-emerald-700 px-2 py-1.5 flex items-center justify-between text-white shadow-xs">
            {/* Previous Month Arrow Button */}
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="w-6 h-6 rounded-full bg-payroll-primary-hover hover:opacity-90 text-white flex items-center justify-center transition-transform active:scale-95 shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <div className="relative">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="appearance-none bg-white text-payroll-navy text-xs font-bold pl-2.5 pr-5 py-0.5 rounded-md border border-payroll-light focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer shadow-xs"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {isBS ? `${BS_MONTHS_EN[m]} (${BS_MONTHS_NAMES[m]})` : AD_MONTHS_NAMES[m]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-payroll-primary absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Year Dropdown */}
              <div className="relative">
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="appearance-none bg-white text-payroll-navy text-xs font-bold pl-2.5 pr-5 py-0.5 rounded-md border border-payroll-light focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer shadow-xs font-mono"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {isBS ? `${y} (${toNepaliNumerals(y)})` : y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-payroll-primary absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Next Month Arrow Button */}
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="w-6 h-6 rounded-full bg-payroll-primary-hover hover:opacity-90 text-white flex items-center justify-center transition-transform active:scale-95 shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Row Header */}
          <div className="grid grid-cols-7 text-center pt-2 pb-1 text-xs font-extrabold text-payroll-navy">
            {(isBS ? BS_WEEKDAYS : AD_WEEKDAYS).map((dayName, idx) => (
              <div key={idx} className="py-0.5">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank offset blocks for days prior to the 1st */}
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7 w-full" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysCount }, (_, idx) => idx + 1).map((day) => {
              const selected = isSelectedDay(day);
              const isToday = isTodayDay(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "h-7 w-full flex items-center justify-center rounded-xs text-xs font-bold transition-all cursor-pointer select-none",
                    selected
                      ? "bg-[#fee56b] hover:bg-[#fdd842] text-payroll-navy border border-[#f5d742] shadow-xs scale-105 z-10"
                      : "bg-[#f0f8f1] hover:bg-[#d8eedb] text-payroll-primary-hover border border-[#d2ead5]",
                    isToday && !selected && "ring-1.5 ring-payroll-primary font-black text-payroll-navy",
                  )}
                >
                  {isBS ? toNepaliNumerals(day) : day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
