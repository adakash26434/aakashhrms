"use client";

import {
  useDateFormat,
  type DateFormat,
} from "@/lib/contexts/date-format-context";
import {
  formatADDate,
  formatBSDate,
  formatBSDateWithDay,
  type BSDateFormat,
} from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";

/**
 * Calendar-aware format. Pass one of these to force a specific
 * calendar + presentation combination.
 *
 *   "bs-long" | "bs-numeric"  →  formatBSDate (Bikram Sambat)
 *   "ad-iso"  | "ad-long"     →  formatADDate (Anno Domini)
 */
type CalendarFormat = DateFormat;

interface BSDateDisplayProps {
  /**
   * The date to display. Accepts:
   * - a JS `Date` (preferred)
   * - an ISO date string (`"YYYY-MM-DD"` or full ISO) — parsed as AD
   * - `null` / `undefined` — renders the `fallback`
   */
  date: Date | string | null | undefined;
  /**
   * Optional format override. If omitted, the active `DateFormat` from
   * the context is used.
   *
   * Calendar-aware values ("bs-long" | "bs-numeric" | "ad-iso" | "ad-long")
   * are unambiguous and preferred. Legacy per-calendar engine keys
   * ("long" | "numeric" | "iso" | "short" | "month-year" | "day-month")
   * are still accepted for back-compat and are resolved via the
   * active `isAD` flag.
   */
  format?: CalendarFormat | BSDateFormat | "iso" | "long" | "short";
  /** Append the weekday name, e.g. "Mangsir 15, 2081 · Monday". */
  withDay?: boolean;
  /** Text shown when `date` is null/undefined or unparseable. */
  fallback?: string;
  className?: string;
}

/**
 * Read-only display of a date in the active user-selected format.
 *
 * Respects the global `DateFormat` from the context unless an explicit
 * `format` prop is passed. Works in both server and client components.
 *
 * @example
 *   <BSDateDisplay date={employee.joiningDate} />
 *   <BSMonthYear date={run.periodStart} />
 */
export function BSDateDisplay({
  date,
  format,
  withDay = false,
  fallback = "—",
  className,
}: BSDateDisplayProps) {
  const { format: activeFormat, isAD } = useDateFormat();
  const ad = toDate(date);
  if (!ad) {
    return (
      <span className={cn("text-gray-400", className)}>{fallback}</span>
    );
  }

  // Resolve the effective format: explicit prop wins, otherwise the
  // active context format. The context value is "bs-long" | "bs-numeric"
  // | "ad-iso" | "ad-long"; we map to the engine's format keys.
  let text: string;
  if (format) {
    if (isCalendarFormat(format)) {
      // Calendar-aware: use the prefix to pick BS vs AD formatter.
      if (format.startsWith("bs-")) {
        const bsFmt: BSDateFormat =
          format === "bs-long" ? "long" : "numeric";
        text = withDay
          ? formatBSDateWithDay(ad)
          : formatBSDate(ad, bsFmt);
      } else {
        const adFmt: "iso" | "long" =
          format === "ad-long" ? "long" : "iso";
        text = withDay
          ? `${formatADDate(ad, adFmt)} · ${ad.toLocaleDateString("en-US", { weekday: "long" })}`
          : formatADDate(ad, adFmt);
      }
    } else {
      // Legacy per-calendar engine key. Use the active isAD flag to
      // decide which formatter to call.
      if (isAD) {
        const adFmt: "iso" | "long" | "short" = format as
          | "iso"
          | "long"
          | "short";
        text = withDay
          ? `${formatADDate(ad, adFmt)} · ${ad.toLocaleDateString("en-US", { weekday: "long" })}`
          : formatADDate(ad, adFmt);
      } else {
        const bsFmt = format as BSDateFormat;
        text = withDay
          ? formatBSDateWithDay(ad)
          : formatBSDate(ad, bsFmt);
      }
    }
  } else {
    // No explicit format — derive from the active context format.
    if (isAD) {
      const adFmt: "iso" | "long" =
        activeFormat === "ad-long" ? "long" : "iso";
      text = withDay
        ? `${formatADDate(ad, adFmt)} · ${ad.toLocaleDateString("en-US", { weekday: "long" })}`
        : formatADDate(ad, adFmt);
    } else {
      const bsFmt: BSDateFormat =
        activeFormat === "bs-long" ? "long" : "numeric";
      text = withDay
        ? formatBSDateWithDay(ad)
        : formatBSDate(ad, bsFmt);
    }
  }

  return (
    <time dateTime={ad.toISOString()} className={className}>
      {text}
    </time>
  );
}

/** Type guard for the calendar-aware format union. */
function isCalendarFormat(f: string): f is CalendarFormat {
  return (
    f === "bs-long" ||
    f === "bs-numeric" ||
    f === "ad-iso" ||
    f === "ad-long"
  );
}

/** Shorthand: "Mangsir 2081" or "Jul 2024" depending on context. */
export function BSMonthYear({
  date,
  fallback,
  className,
}: Omit<BSDateDisplayProps, "format" | "withDay">) {
  const { isAD } = useDateFormat();
  return (
    <BSDateDisplay
      date={date}
      format={isAD ? "long" : "month-year"}
      fallback={fallback}
      className={className}
    />
  );
}

/** Shorthand: "15 Mangsir" or "17 Jul" depending on context. */
export function BSDayMonth({
  date,
  fallback,
  className,
}: Omit<BSDateDisplayProps, "format" | "withDay">) {
  const { isAD } = useDateFormat();
  return (
    <BSDateDisplay
      date={date}
      format={isAD ? "short" : "day-month"}
      fallback={fallback}
      className={className}
    />
  );
}

/** Parse a value into a `Date` if possible, else `null`. */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
