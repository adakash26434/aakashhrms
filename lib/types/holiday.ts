

import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  PartyPopper,
  MapPin,
  Flag,
  Globe,
  CalendarDays,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * The five categories observed in Nepal payroll:
 *   - major-festival       : large multi-day festivals (Dashain, Tihar)
 *   - cultural-festival    : cultural / religious (Maghe Sankranti, Shree Panchami)
 *   - regional-festival    : locally-observed festivals (Chhath, Holi, Ghode Jatra, Indra Jatra)
 *   - national-holiday     : gazetted public holidays (Republic Day, Constitution Day, New Year)
 *   - international-holiday: internationally observed (Labour Day)
 */
export const HOLIDAY_CATEGORIES = [
  "major-festival",
  "cultural-festival",
  "regional-festival",
  "national-holiday",
  "international-holiday",
] as const;

export type HolidayCategory = (typeof HOLIDAY_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export interface HolidayCategoryMeta {
  /** Human label, e.g. "Major Festival". */
  label: string;
  /** Short label for compact contexts (chips, tooltips). */
  short: string;
  /** Description used in the form's helper text. */
  description: string;
  icon: LucideIcon;
  /** Tonal accent for badges / category pill. */
  tone: "amber" | "rose" | "violet" | "blue" | "emerald";
}

export const HOLIDAY_CATEGORY_META: Record<
  HolidayCategory,
  HolidayCategoryMeta
> = {
  "major-festival": {
    label: "Major Festival",
    short: "Major",
    description: "Large multi-day national festivals",
    icon: Sparkles,
    tone: "amber",
  },
  "cultural-festival": {
    label: "Cultural Festival",
    short: "Cultural",
    description: "Cultural / religious observances",
    icon: PartyPopper,
    tone: "rose",
  },
  "regional-festival": {
    label: "Regional Festival",
    short: "Regional",
    description: "Locally-observed regional festivals",
    icon: MapPin,
    tone: "violet",
  },
  "national-holiday": {
    label: "National Holiday",
    short: "National",
    description: "Gazetted public holidays",
    icon: Flag,
    tone: "blue",
  },
  "international-holiday": {
    label: "International Holiday",
    short: "Intl.",
    description: "Internationally observed holidays",
    icon: Globe,
    tone: "emerald",
  },
};

// ---------------------------------------------------------------------------
// Main entity
// ---------------------------------------------------------------------------

export interface Holiday {
  id: string;
  name: string;
  category: HolidayCategory;
  /** Inclusive start of the holiday, BS ISO "YYYY-MM-DD". */
  startDate: string;
  /** Inclusive end of the holiday, BS ISO "YYYY-MM-DD". */
  endDate: string;
  
  // NEW: Store the AD dates as actual Date objects
  startDateAD: Date;
  endDateAD: Date;

  branchIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Form data (subset edited by the modal)
// ---------------------------------------------------------------------------

export interface HolidayFormData {
  name: string;
  category: HolidayCategory;
  startDate: string;
  endDate: string;
  startDateAD: Date;
  endDateAD: Date;
  branchIds: string[];
}

// ---------------------------------------------------------------------------
// Aggregate shape returned by the data layer
// ---------------------------------------------------------------------------

export interface HolidayData {
  fiscalYears: { id: string; label: string; isLocked: boolean }[];
  holidays: Holiday[];
  branches: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Display formatters
// ---------------------------------------------------------------------------

export function formatCategory(c: HolidayCategory): string {
  return HOLIDAY_CATEGORY_META[c].label;
}

/**
 * Pretty-print the day count. We follow the design's wording:
 * "1 days", "2 days", "8 days" (always plural, even for one).
 */
export function formatDays(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "—";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Format a BS ISO date string for compact display. Falls back to the
 * raw string if the input is malformed.
 */
export function formatBSDisplayDate(bsString: string): string {
  return bsString || "—";
}

/**
 * Format the "Date Range" label value. Single-day holidays show
 * just the start date; multi-day shows `start – end` (en-dash).
 */
export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "—";
  if (startDate === endDate) return startDate;
  return `${startDate} – ${endDate}`;
}

// ---------------------------------------------------------------------------
// Type filter (placeholder for symmetry with pay-head — currently
// unused by the page but kept for future category filtering)
// ---------------------------------------------------------------------------

export type CategoryFilter = "all" | HolidayCategory;

export const CATEGORY_FILTERS: CategoryFilter[] = [
  "all",
  "major-festival",
  "cultural-festival",
  "regional-festival",
  "national-holiday",
  "international-holiday",
];

export function formatCategoryFilter(f: CategoryFilter): string {
  if (f === "all") return "All";
  return formatCategory(f);
}

// Re-export the lucide icon import for consumers that want to render
// the category icons alongside other markers.
export { CalendarDays };
