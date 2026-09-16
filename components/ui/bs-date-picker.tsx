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
} from "@/lib/utils/date-input-formatter";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown, Eraser } from "lucide-react";

export { toNepaliNumerals, fromNepaliNumerals };

export interface BSDatePickerProps {
  value: string;
  onChange: (next: string) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  hasError?: boolean;
  ariaLabel?: string;
  idPrefix?: string;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseBSString(s: string): {
  year: number | null;
  month: number | null;
  day: number | null;
} {
  if (!s) return { year: null, month: null, day: null };
  const normalized = fromNepaliNumerals(s.trim());
  const match = normalized.match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
  if (!match) return { year: null, month: null, day: null };
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: match[3] ? Number(match[3]) : null,
  };
}

/**
 * Greenish BS Calendar popup picker matching system theme:
 * - Smart auto-slash formatting on keyboard input
 * - Forest-green gradient header with < > month/year navigators
 * - Weekday initials header (आ सो मं बु बि शु श)
 * - Mint-green day buttons with signature soft-yellow highlight for selected dates
 * - Attached deep forest green eraser button
 */
export function BSDatePicker({
  value,
  onChange,
  minYear = 1976,
  maxYear = 2100,
  disabled = false,
  hasError = false,
  label,
  required = false,
  error,
  className,
}: BSDatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevInputRef = useRef<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const parsed = useMemo(() => parseBSString(value), [value]);

  const today = useMemo(() => new Date(), []);
  const todayBS = useMemo(() => adToBS(today), [today]);

  const [viewYear, setViewYear] = useState<number>(() => {
    return parsed.year || todayBS.year || 2081;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    return parsed.month || todayBS.month || 1;
  });

  const [inputText, setInputText] = useState<string>(() => {
    if (parsed.year && parsed.month && parsed.day) {
      const str = `${parsed.year}/${pad2(parsed.month)}/${pad2(parsed.day)}`;
      prevInputRef.current = str;
      return str;
    }
    prevInputRef.current = value || "";
    return value || "";
  });

  // Sync state when value changes externally
  useEffect(() => {
    const p = parseBSString(value);
    if (p.year && p.month && p.day) {
      const str = `${p.year}/${pad2(p.month)}/${pad2(p.day)}`;
      setInputText(str);
      prevInputRef.current = str;
      setViewYear(p.year);
      setViewMonth(p.month);
    } else {
      setInputText(value || "");
      prevInputRef.current = value || "";
    }
  }, [value]);

  // Click outside to close popup
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

  function handlePrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const daysCount = useMemo(() => {
    return getDaysInBSMonth(viewYear, viewMonth) || 30;
  }, [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    try {
      const firstDayAD = bsToAD(viewYear, viewMonth, 1);
      return firstDayAD.getDay();
    } catch {
      return 0;
    }
  }, [viewYear, viewMonth]);

  function handleSelectDay(day: number) {
    const formatted = `${viewYear}-${pad2(viewMonth)}-${pad2(day)}`;
    const displayFormatted = `${viewYear}/${pad2(viewMonth)}/${pad2(day)}`;
    setInputText(displayFormatted);
    prevInputRef.current = displayFormatted;
    onChange(formatted);
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setInputText("");
    prevInputRef.current = "";
    onChange("");
  }

  /**
   * Automatic slash insertion on typing with strict month and day clamping:
   * - Month strictly clamped between 01 and 12
   * - Day strictly clamped to maximum days for that specific BS month (28-32)
   */
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const result = formatDateInput({
      raw,
      prevValue: prevInputRef.current,
      isBS: true,
      minYear,
      maxYear,
    });

    prevInputRef.current = result.formatted;
    setInputText(result.formatted);

    // Live calendar navigation as user types
    if (result.year && result.year >= minYear && result.year <= maxYear) {
      setViewYear(result.year);
    }
    if (result.month && result.month >= 1 && result.month <= 12) {
      setViewMonth(result.month);
    }

    if (result.isValid && result.year && result.month && result.day) {
      onChange(`${result.year}-${pad2(result.month)}-${pad2(result.day)}`);
    }
  }

  function handleBlur() {
    if (!inputText.trim()) {
      if (value) onChange("");
      return;
    }
    const parts = inputText.split("/").map(Number);
    const isComplete =
      parts.length === 3 && parts[0] > 0 && parts[1] > 0 && parts[2] > 0;
    if (!isComplete) {
      const p = parseBSString(value);
      if (p.year && p.month && p.day) {
        const str = `${p.year}/${pad2(p.month)}/${pad2(p.day)}`;
        setInputText(str);
        prevInputRef.current = str;
      } else {
        setInputText("");
        prevInputRef.current = "";
      }
    }
  }

  const yearOptions = useMemo(() => {
    const start = Math.min(minYear, viewYear);
    const end = Math.max(maxYear, viewYear);
    const list: number[] = [];
    for (let y = start; y <= end; y++) list.push(y);
    return list;
  }, [minYear, maxYear, viewYear]);

  const isSelectedDay = (day: number) => {
    return (
      parsed.year === viewYear &&
      parsed.month === viewMonth &&
      parsed.day === day
    );
  };

  const isTodayDay = (day: number) => {
    return (
      todayBS.year === viewYear &&
      todayBS.month === viewMonth &&
      todayBS.day === day
    );
  };

  const adPreview = useMemo(() => {
    if (parsed.year && parsed.month && parsed.day) {
      try {
        if (isValidBSDate(parsed.year, parsed.month, parsed.day)) {
          const ad = bsToAD(parsed.year, parsed.month, parsed.day);
          return formatADDate(ad, "long");
        }
      } catch {}
    }
    return null;
  }, [parsed]);

  return (
    <div ref={containerRef} className={cn("relative inline-block w-full", className)}>
      {label && (
        <label className="mb-1 block text-xs font-bold text-payroll-navy">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}

      {/* Input Group with Right Attached Eraser Button */}
      <div
        className={cn(
          "relative flex items-center rounded-lg border bg-white shadow-xs transition-all text-payroll-navy",
          isOpen
            ? "border-payroll-primary ring-2 ring-payroll-primary/20"
            : hasError || error
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
          placeholder="YYYY/MM/DD"
          disabled={disabled}
          className="w-full bg-transparent py-2 pl-3 pr-10 text-xs sm:text-sm font-mono font-medium placeholder-gray-400 focus:outline-none"
        />

        {/* Attached Eraser Button (Deep Forest Green) */}
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

      {/* AD Preview Hint */}
      {adPreview && (
        <p className="mt-1 text-[11px] text-gray-500 font-mono">
          AD: {adPreview}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-rose-600 font-semibold" role="alert">
          {error}
        </p>
      )}

      {/* Popup Calendar Dropdown */}
      {isOpen && !disabled && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-payroll-light bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: "268px" }}
        >
          {/* Header Bar — System Emerald/Forest Green */}
          <div className="rounded-t-lg bg-linear-to-r from-payroll-primary to-emerald-700 px-2 py-1.5 flex items-center justify-between text-white shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="w-6 h-6 rounded-full bg-payroll-primary-hover hover:opacity-90 text-white flex items-center justify-center transition-transform active:scale-95 shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <div className="relative">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="appearance-none bg-white text-payroll-navy text-xs font-bold pl-2.5 pr-5 py-0.5 rounded-md border border-payroll-light focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer shadow-xs"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {BS_MONTHS_EN[m]} ({BS_MONTHS_NAMES[m]})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-payroll-primary absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="appearance-none bg-white text-payroll-navy text-xs font-bold pl-2.5 pr-5 py-0.5 rounded-md border border-payroll-light focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer shadow-xs font-mono"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y} ({toNepaliNumerals(y)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-payroll-primary absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

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
            {BS_WEEKDAYS.map((dayName, idx) => (
              <div key={idx} className="py-0.5">
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-7 w-full" />
            ))}

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
                  {toNepaliNumerals(day)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
