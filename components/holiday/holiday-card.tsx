"use client";

import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { bsStringToAD, formatADDate } from "@/lib/utils/bs-calendar";
import {
  formatCategory,
  formatDateRange,
  formatDays,
  HOLIDAY_CATEGORY_META,
  type Holiday,
} from "@/lib/types/holiday";
import { holidayDayCount } from "@/lib/engines/holiday.engine";

interface HolidayCardProps {
  holiday: Holiday;
  /** Resolved branch names by id. */
  branchNameById: Map<string, string>;
  /** Total branch count — used to decide "All Branches" badge. */
  totalBranchCount: number;
  onView: (holiday: Holiday) => void;
  onEdit: (holiday: Holiday) => void;
  onDelete: (holiday: Holiday) => void;
}

/**
 * Single holiday card. Mirrors the design screenshot:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [icon] Name                       ✏  🗑     │
 *   │        Category                             │
 *   │ ─────────────────────────────────────────── │
 *   │ Date Range    2081-06-15 → 2081-06-22 (BS)  │
 *   │               Nov 30 → Dec 16, 2024    (AD) │
 *   │ Days          8 days                        │
 *   │ Branches      All Branches                  │
 *   └──────────────────────────────────────────────┘
 *
 * - Calendar icon in a soft amber circle (echoes the screenshot)
 * - Edit / Delete icon buttons on the top-right
 * - Divider between header and details
 * - Date Range shows both BS (primary) and AD (secondary) for
 *   cross-checking against the Gregorian calendar
 * - "Days" rendered as a rounded pill
 * - "Branches" shows "All Branches" or comma-separated names
 */
export function HolidayCard({
  holiday,
  branchNameById,
  totalBranchCount,
  onView,
  onEdit,
  onDelete,
}: HolidayCardProps) {
  const categoryMeta = HOLIDAY_CATEGORY_META[holiday.category];
  const days = holidayDayCount(holiday);

  return (
    <div className="group relative flex flex-col rounded-xl border border-[#d7e8d0]/80 bg-white p-5 transition-shadow hover:shadow-sm">
      {/* Header row: icon + name + actions */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onView(holiday)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md cursor-pointer text-left transition-colors hover:bg-[#f6faf6] "
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 ">
            <CalendarDays className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#1b3a1f]">
              {holiday.name}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatCategory(holiday.category)}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <ActionButton
            label={`Edit ${holiday.name}`}
            onClick={() => onEdit(holiday)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton
            label={`Delete ${holiday.name}`}
            onClick={() => onDelete(holiday)}
            danger
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-[#d7e8d0]/60" />

      {/* Detail rows */}
      <dl className="space-y-2.5 text-sm">
        {/* Date Range — BS primary, AD secondary */}
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5">
          <dt className="text-xs text-gray-500">Date Range</dt>
          <dd className="min-w-0">
            <p className="text-[13px] font-medium text-[#1b3a1f] tabular-nums">
              {formatDateRange(holiday.startDate, holiday.endDate)}
            </p>
            <DualDateLabel
              bsStart={holiday.startDate}
              bsEnd={holiday.endDate}
            />
          </dd>
        </div>

        {/* Days — pill */}
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
          <dt className="text-xs text-gray-500">Days</dt>
          <dd>
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                days > 1
                  ? "bg-green-50 text-green-700"
                  : "bg-[#d7e8d0]/60 text-[#1b3a1f]",
              )}
            >
              {formatDays(days)}
            </span>
          </dd>
        </div>

        {/* Branches — "All Branches" or comma-separated names */}
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
          <dt className="text-xs text-gray-500">Branches</dt>
          <dd className="min-w-0">
            <BranchesCell
              ids={holiday.branchIds}
              branchNameById={branchNameById}
              totalBranchCount={totalBranchCount}
            />
          </dd>
        </div>
      </dl>

      {/* Hidden — used by the screen reader to describe the row */}
      <span className="sr-only">
        {holiday.name}, {formatCategory(holiday.category)},{" "}
        {formatDateRange(holiday.startDate, holiday.endDate)},{" "}
        {formatDays(days)}, {categoryMeta.description}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer",
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
          : "text-gray-500 hover:bg-[#d7e8d0]/60 hover:text-[#2e7d32]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Renders the AD (Gregorian) equivalent of a BS ISO date range
 * underneath the primary BS line. Shown in a smaller, muted font
 * with a tiny "AD" chip so users can cross-check at a glance.
 *
 * Falls back to `—` if the BS string is malformed.
 */
function DualDateLabel({
  bsStart,
  bsEnd,
}: {
  bsStart: string;
  bsEnd: string;
}) {
  const start = bsStringToAD(bsStart);
  const end = bsStringToAD(bsEnd);

  if (!start || !end) {
    return (
      <p className="mt-0.5 text-[11px] text-gray-400 tabular-nums">
        <span className="mr-1.5 inline-block rounded bg-[#f6faf6] px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-gray-500">
          AD
        </span>
        —
      </p>
    );
  }

  const startAD = formatADDate(start, "short"); // "30 Nov 2024"
  const endAD = formatADDate(end, "short");
  const sameYear = start.getFullYear() === end.getFullYear();
  // For multi-year ranges (rare but possible) we show the year on both.
  const startStr = sameYear
    ? startAD
    : formatADDate(start, "long"); // "November 30, 2023"
  const endStr = formatADDate(end, "long"); // "December 16, 2024"

  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 tabular-nums">
      <span className="inline-block rounded bg-[#f6faf6] px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-gray-500">
        AD
      </span>
      <span>
        {bsStart === bsEnd ? endStr : `${startStr} → ${endStr}`}
      </span>
    </p>
  );
}

function BranchesCell({
  ids,
  branchNameById,
  totalBranchCount,
}: {
  ids: string[];
  branchNameById: Map<string, string>;
  totalBranchCount: number;
}) {
  // Empty list = "All Branches" (per engine/model convention)
  if (ids.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-[#1b3a1f]">All Branches</span>
      </div>
    );
  }

  const visible = ids
    .slice(0, 2)
    .map((id) => branchNameById.get(id) ?? id);
  const overflow = ids.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <span className="truncate text-[13px] text-[#1b3a1f]">
        {visible.join(", ")}
      </span>
      {overflow > 0 && (
        <span className="shrink-0 rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums">
          +{overflow}
        </span>
      )}
    </div>
  );
}
