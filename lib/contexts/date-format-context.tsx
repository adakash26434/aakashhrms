"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * The four user-selectable date display formats.
 *
 *   bs-long    — "Baisakh 1, 2081"     (BS text long)
 *   bs-numeric — "2081-04-01"          (BS ISO, default for tables)
 *   ad-iso     — "2024-07-17"          (AD ISO, mirrors BS-numeric)
 *   ad-long    — "Jul 17, 2024"        (AD text long, more readable)
 *
 * The first segment is the calendar (BS vs AD); the second is the
 * presentation (numeric/iso vs long). Switching calendar preserves
 * the presentation (e.g. "bs-long" → "ad-long").
 */
export type DateFormat = "bs-long" | "bs-numeric" | "ad-iso" | "ad-long";

export type Calendar = "bs" | "ad";
export type DateFormatVariant = "long" | "iso" | "numeric";

const STORAGE_KEY = "payroll.dateFormat";
const DEFAULT_FORMAT: DateFormat = "bs-numeric";

interface DateFormatContextValue {
  /** The full format (calendar + presentation). */
  format: DateFormat;
  /** Update the full format. Persists to localStorage. */
  setFormat: (f: DateFormat) => void;
  /** True iff the current format is BS. */
  isBS: boolean;
  /** True iff the current format is AD. */
  isAD: boolean;
  /** Just the calendar segment — useful for the segmented control. */
  calendar: Calendar;
  /**
   * Switch calendar while preserving the presentation
   * (e.g. "bs-long" → "ad-long", "bs-numeric" → "ad-iso").
   */
  setCalendar: (c: Calendar) => void;
}

const DateFormatContext = createContext<DateFormatContextValue | null>(null);

function isDateFormat(s: string): s is DateFormat {
  return (
    s === "bs-long" ||
    s === "bs-numeric" ||
    s === "ad-iso" ||
    s === "ad-long"
  );
}

function calendarOf(f: DateFormat): Calendar {
  return f.startsWith("bs-") ? "bs" : "ad";
}

function variantOf(f: DateFormat): DateFormatVariant {
  if (f.endsWith("-long")) return "long";
  if (f.endsWith("-iso")) return "iso";
  return "numeric";
}

function formatForCalendar(
  c: Calendar,
  variant: DateFormatVariant,
): DateFormat {
  if (c === "bs") {
    return variant === "long" ? "bs-long" : "bs-numeric";
  }
  return variant === "long" ? "ad-long" : "ad-iso";
}

/**
 * Provider that holds the user's chosen date display format.
 *
 * Persists to `localStorage` under the key `payroll.dateFormat` so the
 * choice survives page reloads. SSR-safe: defaults to `bs-numeric` on
 * the server and reads localStorage inside a `useEffect` (avoids
 * hydration mismatches).
 */
export function DateFormatProvider({ children }: { children: React.ReactNode }) {
  const [format, setFormatState] = useState<DateFormat>(DEFAULT_FORMAT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount.
  //
  // We deliberately use the "setState in useEffect" pattern here even
  // though the React 19 linter flags it. Justification: this is the
  // canonical "hydrate from an external system (localStorage)" pattern
  // — the initial state is the SSR-safe default, and the client-only
  // value is read in a once-on-mount effect to avoid hydration mismatch.
  // See https://react.dev/learn/you-might-not-need-an-effect#reading-latest-props-and-state-from-an-effect
   
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isDateFormat(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormatState(stored);
      }
    } catch {
      /* localStorage may be disabled (private mode, etc.) — ignore. */
    } finally {
      setHydrated(true);
    }
  }, []);

  const setFormat = useCallback((f: DateFormat) => {
    setFormatState(f);
    try {
      window.localStorage.setItem(STORAGE_KEY, f);
    } catch {
      /* ignore */
    }
  }, []);

  const calendar = calendarOf(format);
  const setCalendar = useCallback(
    (c: Calendar) => {
      setFormat(formatForCalendar(c, variantOf(format)));
    },
    [format, setFormat],
  );

  // Until hydration is complete we render with the default format
  // (bs-numeric). After hydration the value updates and React reconciles.
  // This keeps server-rendered output deterministic.
  void hydrated;

  return (
    <DateFormatContext.Provider
      value={{
        format,
        setFormat,
        isBS: calendar === "bs",
        isAD: calendar === "ad",
        calendar,
        setCalendar,
      }}
    >
      {children}
    </DateFormatContext.Provider>
  );
}

/**
 * Read the current date format. Throws if used outside the provider.
 */
export function useDateFormat(): DateFormatContextValue {
  const ctx = useContext(DateFormatContext);
  if (!ctx) {
    throw new Error("useDateFormat must be used within <DateFormatProvider>");
  }
  return ctx;
}
