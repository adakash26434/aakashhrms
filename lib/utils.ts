import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ClockHour,
  Meridiem,
  OfficeTimeValue,
} from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNPR(
  value: number,
  unit?: "full" | "cr" | "lakh",
): string {
  void unit; // Intentionally ignored: full-number NPR formatting is globally enforced
  const num = Number(value) || 0;
  const isNegative = num < 0;
  const absValue = Math.abs(num);
  const formatted = absValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-NPR ${formatted}` : `NPR ${formatted}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AD_MONTHS = [
  "",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BS_MONTH_NAMES = [
  "",
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

/**
 * Format month label for payroll cycles according to selected calendar (BS vs AD).
 * In BS mode: returns Nepali month name (e.g. "Shrawan 2083").
 * In AD mode: returns English month name (e.g. "July 2026").
 */
export function formatPayrollCycleMonth(
  monthNum?: number,
  year?: number,
  startDate?: string,
  calendar: "bs" | "ad" = "bs"
): string {
  if (calendar === "bs") {
    const m = monthNum && monthNum >= 1 && monthNum <= 12 ? monthNum : 4;
    const name = BS_MONTH_NAMES[m] || `Month ${m}`;
    return year ? `${name} ${year}` : name;
  }

  // AD calendar
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  }

  const m = monthNum && monthNum >= 1 && monthNum <= 12 ? monthNum : 4;
  const adMonthIndex = ((m + 2) % 12) + 1; // BS 1 (Baisakh) -> 4 (April), BS 4 (Shrawan) -> 7 (July)
  const adMonthName = AD_MONTHS[adMonthIndex] || `Month ${m}`;
  const adYear = year ? (m >= 10 ? year - 56 : year - 57) : new Date().getFullYear();
  return `${adMonthName} ${adYear}`;
}

/**
 * Convert a free-form string to a URL-safe slug (lowercase, kebab-case,
 * ASCII-only). Returns an empty string if the result would be empty.
 *
 * Examples:
 *   "FY 2081/2082" -> "fy-2081-2082"
 *   "  Hello, World! " -> "hello-world"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, " ")    // non-alphanumerics -> space
    .trim()
    .replace(/\s+/g, "-")            // spaces -> hyphen
    .replace(/-+/g, "-")             // collapse repeated hyphens
    .replace(/^-+|-+$/g, "");        // trim leading/trailing hyphens
}

const CLOCK_HOURS: readonly ClockHour[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

function toClockHour(n: number): ClockHour {
  return (CLOCK_HOURS.includes(n as ClockHour) ? n : 12) as ClockHour;
}

/**
 * Format a 12-hour time value as a human-readable string.
 * Examples: { hour: 10, minute: 0, meridiem: "AM" } -> "10:00 AM"
 *           { hour: 4, minute: 30, meridiem: "PM" } -> "4:30 PM"
 */
export function formatOfficeTime(value: OfficeTimeValue): string {
  const hh = String(value.hour);
  const mm = String(value.minute).padStart(2, "0");
  return `${hh}:${mm} ${value.meridiem}`;
}

/** Parse a string like "10:00 AM" / "4:30 pm" into an OfficeTimeValue. */
export function parseOfficeTime(raw: string): OfficeTimeValue | null {
  const match = raw
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (!match) return null;
  const hourNum = Number(match[1]);
  const minuteNum = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hourNum) || hourNum < 1 || hourNum > 12) return null;
  if (!Number.isFinite(minuteNum) || minuteNum < 0 || minuteNum > 59) {
    return null;
  }
  return {
    hour: toClockHour(hourNum),
    minute: minuteNum,
    meridiem: match[3].toUpperCase() as Meridiem,
  };
}

/** Convert an OfficeTimeValue to a 24-hour "HH:MM" string (for native time inputs). */
export function officeTimeTo24(value: OfficeTimeValue): string {
  const hour24 =
    value.meridiem === "AM"
      ? value.hour === 12
        ? 0
        : value.hour
      : value.hour === 12
        ? 12
        : value.hour + 12;
  return `${String(hour24).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
}

/** Convert a 24-hour "HH:MM" string back to an OfficeTimeValue. */
export function officeTimeFrom24(raw: string): OfficeTimeValue {
  const [hhRaw = "0", mmRaw = "0"] = raw.split(":");
  const hour24 = Number(hhRaw);
  const minute = Number(mmRaw);
  const safeHour = Number.isFinite(hour24) ? hour24 : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  const meridiem: Meridiem = safeHour >= 12 ? "PM" : "AM";
  const hour12 = safeHour === 0 ? 12 : safeHour > 12 ? safeHour - 12 : safeHour;
  return {
    hour: toClockHour(hour12),
    minute: safeMinute,
    meridiem,
  };
}
