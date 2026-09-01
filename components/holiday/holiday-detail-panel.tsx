"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import { bsStringToAD, formatADDate, formatBSDate } from "@/lib/utils/bs-calendar";
import {
  formatCategory,
  formatDateRange,
  formatDays,
  HOLIDAY_CATEGORY_META,
  type Holiday,
} from "@/lib/types/holiday";
import { holidayDayCount } from "@/lib/engines/holiday.engine";

interface HolidayDetailPanelProps {
  open: boolean;
  holiday: Holiday | null;
  branchNameById: Map<string, string>;
  totalBranchCount: number;
  onClose: () => void;
  /** When user clicks the pencil — opens the form modal. */
  onEdit: (holiday: Holiday) => void;
}

/**
 * Right-side slide-in panel showing the full breakdown of a
 * single holiday. Read-only — the "Edit" action is exposed via
 * a pencil button in the header (which opens the form modal)
 * and a full-width "Edit Holiday" button in the footer.
 *
 * Sections (mirrors the form modal, read-only):
 *   OVERVIEW
 *     - Category
 *     - Date Range (BS + AD)
 *     - Days
 *   APPLICABILITY
 *     - Applicable Branches (chips)
 */
export function HolidayDetailPanel({
  open,
  holiday,
  branchNameById,
  totalBranchCount,
  onClose,
  onEdit,
}: HolidayDetailPanelProps) {
  const days = holiday ? holidayDayCount(holiday) : 0;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="md"
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-[#1b3a1f]">
              {holiday?.name ?? ""}
            </h2>
            <button
              type="button"
              onClick={() => holiday && onEdit(holiday)}
              disabled={!holiday}
              className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-[#f6faf6] hover:text-[#2e7d32] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Edit holiday"
              title="Edit holiday"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          {holiday && (
            <p className="mt-0.5 font-mono text-[11px] text-gray-500">
              {holiday.id}
            </p>
          )}
        </div>
      }
      subtitle={
        holiday ? (
          <span>{formatCategory(holiday.category)}</span>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => holiday && onEdit(holiday)}
            disabled={!holiday}
          >
            <Pencil className="h-4 w-4" />
            Edit Holiday
          </Button>
        </>
      }
    >
      {holiday && (
        <div className="space-y-6">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OverviewRow
                label="Category"
                value={formatCategory(holiday.category)}
                tone={HOLIDAY_CATEGORY_META[holiday.category].tone}
              />
              <OverviewRow
                label="Days"
                value={formatDays(days)}
                tone={days > 1 ? "blue" : "gray"}
              />
              <div className="sm:col-span-2">
                <DateRangeBlock
                  bsStart={holiday.startDate}
                  bsEnd={holiday.endDate}
                />
              </div>
            </div>
          </Section>

          {/* Applicability */}
          <Section title="Applicability">
            <BranchGroup
              ids={holiday.branchIds}
              nameById={branchNameById}
              totalCount={totalBranchCount}
            />
          </Section>
        </div>
      )}
    </SidePanel>
  );
}

// ----- Internal helpers ----------------------------------------------------

function Section({
  title,
  rightMeta,
  children,
}: {
  title: string;
  rightMeta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
        {rightMeta}
      </div>
      {children}
    </div>
  );
}

type Tone = "blue" | "amber" | "rose" | "violet" | "gray" | "emerald";

const toneClasses: Record<Tone, string> = {
  blue: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  gray: "bg-gray-100 text-gray-700",
  emerald: "bg-emerald-50 text-emerald-700",
};

function OverviewRow({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#d7e8d0]/60 bg-white p-2.5",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <div className="mt-1">
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
            toneClasses[tone],
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/**
 * Read-only "Date Range" block that shows BS as the primary and
 * AD as the secondary. Used in the detail panel where there's
 * more room than in the card.
 */
function DateRangeBlock({
  bsStart,
  bsEnd,
}: {
  bsStart: string;
  bsEnd: string;
}) {
  const startAD = bsStringToAD(bsStart);
  const endAD = bsStringToAD(bsEnd);
  const startBS = startAD ? formatBSDate(startAD, "long") : null; // "Mangsir 15, 2081"
  const endBS = endAD ? formatBSDate(endAD, "long") : null;
  const startADStr = startAD ? formatADDate(startAD, "long") : null; // "November 30, 2024"
  const endADStr = endAD ? formatADDate(endAD, "long") : null;

  return (
    <div className="rounded-lg border border-[#d7e8d0]/60 bg-white p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        Date Range
      </p>
      <div className="mt-1.5 space-y-1">
        {/* Primary: BS */}
        <p className="text-xs font-semibold text-[#1b3a1f] tabular-nums">
          {formatDateRange(bsStart, bsEnd)}
        </p>
        {/* Secondary: BS pretty */}
        {startBS && endBS && (
          <p className="text-[11px] text-gray-600 tabular-nums">
            {bsStart === bsEnd ? startBS : `${startBS} → ${endBS}`}
          </p>
        )}
        {/* Tertiary: AD */}
        {startADStr && endADStr && (
          <div className="mt-1 flex items-center gap-1.5 border-t border-[#d7e8d0]/60 pt-1.5 text-[11px] text-gray-500 tabular-nums">
            <span className="rounded bg-[#f6faf6] px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              AD
            </span>
            <span>
              {bsStart === bsEnd
                ? endADStr
                : `${startADStr} → ${endADStr}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BranchGroup({
  ids,
  nameById,
  totalCount,
}: {
  ids: string[];
  nameById: Map<string, string>;
  totalCount: number;
}) {
  const isAll = ids.length === 0;
  const visible = isAll ? [] : ids.map((id) => nameById.get(id) ?? id);
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
        Applicable Branches
      </p>
      {isAll ? (
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-[#2e7d32]/20 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            All Branches
          </span>
          <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[10px] font-semibold text-[#1b3a1f] tabular-nums">
            +{totalCount}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((name) => (
            <span
              key={name}
              className="rounded-md border border-[#d7e8d0] bg-[#f6faf6] px-2 py-0.5 text-xs text-[#1b3a1f]"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
