"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  adToBS,
  BS_MONTHS_EN,
  bsStringToAD,
  formatADDate,
  getDaysInBSMonth,
} from "@/lib/utils/bs-calendar";

/**
 * Bikram Sambat date picker.
 *
 * Three cascading dropdowns (Year / Month / Day) plus a live
 * AD equivalent preview. Replaces free-text date entry with
 * a guided picker that respects the variable month lengths
 * (28..32 days) of the BS calendar.
 */

export interface BSDatePickerProps {
  value: string;
  onChange: (next: string) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  hasError?: boolean;
  ariaLabel: string;
  idPrefix?: string;
}

const MIN_YEAR_DEFAULT = 2070;
const MAX_YEAR_DEFAULT = 2095;

function parseBSValue(s: string): {
  year: number | null;
  month: number | null;
  day: number | null;
} {
  if (!s) return { year: null, month: null, day: null };
  const match = s.trim().match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!match) return { year: null, month: null, day: null };
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: match[3] ? Number(match[3]) : null,
  };
}

function formatBSValue(
  year: number | null,
  month: number | null,
  day: number | null,
): string {
  if (year == null || month == null) return "";
  const mm = String(month).padStart(2, "0");
  if (day == null) return `${year}-${mm}`;
  return `${year}-${mm}-${String(day).padStart(2, "0")}`;
}

interface MiniSelectProps {
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  ariaLabel: string;
  buttonId: string;
  widthClass?: string;
}

function MiniSelect({
  value,
  placeholder,
  options,
  onChange,
  disabled,
  hasError,
  ariaLabel,
  buttonId,
  widthClass = "flex-1",
}: MiniSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function measure() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          widthClass,
          "h-9 rounded-lg border bg-white px-2.5 text-sm text-[#1b3a1f] focus:outline-none focus:ring-1 flex items-center justify-between gap-1 transition-colors",
          disabled
            ? "cursor-not-allowed border-[#d7e8d0]/60 bg-[#f6faf6] text-gray-500"
            : hasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-[#d7e8d0] hover:border-[#2e7d32]/40 focus:border-[#2e7d32] focus:ring-[#2e7d32]",
          open && "border-[#2e7d32] ring-1 ring-[#2e7d32]",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selected && "text-gray-400",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && pos && typeof document !== "undefined" && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            maxHeight: 240,
            zIndex: 9999,
          }}
          className="overflow-y-auto rounded-md border border-[#d7e8d0] bg-white shadow-lg animate-[dialogIn_180ms_ease-out]"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-[#d7e8d0]/40 text-[#1b3a1f]"
                    : "text-gray-700 hover:bg-[#f6faf6]",
                )}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && (
                  <span className="text-xs font-semibold text-[#2e7d32]">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * Bikram Sambat date picker — 3 cascading dropdowns with live
 * AD preview and a quick "clear" / "today" action row.
 */
export function BSDatePicker({
  value,
  onChange,
  minYear = MIN_YEAR_DEFAULT,
  maxYear = MAX_YEAR_DEFAULT,
  disabled,
  hasError,
  ariaLabel,
  idPrefix = "bs-date",
}: BSDatePickerProps) {
  const parsed = useMemo(() => parseBSValue(value), [value]);

  const [year, setYear] = useState<number | null>(parsed.year);
  const [month, setMonth] = useState<number | null>(parsed.month);
  const [day, setDay] = useState<number | null>(parsed.day);

  const yearOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      out.push({ value: String(y), label: `${y} BS` });
    }
    return out;
  }, [minYear, maxYear]);

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      out.push({ value: String(m), label: BS_MONTHS_EN[m] });
    }
    return out;
  }, []);

  const daysInSelectedMonth = useMemo(() => {
    if (year == null || month == null) return 32;
    const d = getDaysInBSMonth(year, month);
    return d || 32;
  }, [year, month]);

  const displayDay =
    day != null && day > daysInSelectedMonth ? daysInSelectedMonth : day;

  const dayOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      out.push({ value: String(d), label: String(d) });
    }
    return out;
  }, [daysInSelectedMonth]);

  // Track the last value we pushed up so we can avoid an
  // infinite re-sync loop.
  const lastPushedRef = useRef<string>(value);

  // Push local edits upward.
  useEffect(() => {
    const safeDay =
      day != null && day > daysInSelectedMonth ? daysInSelectedMonth : day;
    const next = formatBSValue(year, month, safeDay);
    if (next !== lastPushedRef.current) {
      lastPushedRef.current = next;
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, daysInSelectedMonth]);

  // Re-sync from outside (parent reset, edit-mode remount, etc.).
  useEffect(() => {
    if (value !== lastPushedRef.current) {
      setYear(parsed.year);
      setMonth(parsed.month);
      setDay(parsed.day);
      lastPushedRef.current = value;
    }
  }, [value, parsed.year, parsed.month, parsed.day]);

  const fullBS = formatBSValue(year, month, displayDay);
  const adDate = fullBS ? bsStringToAD(fullBS) : null;
  const adLabel = adDate ? formatADDate(adDate, "long") : null;

  function handleClear() {
    setYear(null);
    setMonth(null);
    setDay(null);
  }

  function handleSetToday() {
    const today = adToBS(new Date());
    setYear(today.year);
    setMonth(today.month);
    setDay(today.day);
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "rounded-lg border bg-white p-2 transition-colors",
        hasError
          ? "border-red-300"
          : disabled
            ? "border-[#d7e8d0]/60 bg-[#f6faf6]"
            : "border-[#d7e8d0]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <MiniSelect
          value={year != null ? String(year) : ""}
          placeholder="Year"
          options={yearOptions}
          onChange={(v) => setYear(v ? Number(v) : null)}
          disabled={disabled}
          hasError={hasError}
          ariaLabel={`${ariaLabel} year`}
          buttonId={`${idPrefix}-year`}
          widthClass="w-[34%]"
        />
        <MiniSelect
          value={month != null ? String(month) : ""}
          placeholder="Month"
          options={monthOptions}
          onChange={(v) => setMonth(v ? Number(v) : null)}
          disabled={disabled}
          hasError={hasError}
          ariaLabel={`${ariaLabel} month`}
          buttonId={`${idPrefix}-month`}
          widthClass="w-[42%]"
        />
        <MiniSelect
          value={displayDay != null ? String(displayDay) : ""}
          placeholder="Day"
          options={dayOptions}
          onChange={(v) => setDay(v ? Number(v) : null)}
          disabled={disabled}
          hasError={hasError}
          ariaLabel={`${ariaLabel} day`}
          buttonId={`${idPrefix}-day`}
          widthClass="w-[24%]"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-1.5 text-gray-500 tabular-nums">
          {adLabel ? (
            <>
              <CalendarDays className="h-3 w-3 shrink-0 text-[#2e7d32]/60" />
              <span className="rounded bg-[#f6faf6] px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                AD
              </span>
              <span className="truncate text-[#1b3a1f]">{adLabel}</span>
            </>
          ) : (
            <span className="text-gray-400">Pick year, month, and day</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleSetToday}
            disabled={disabled}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#2e7d32] transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Set to today's BS date"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={
              disabled || (year == null && month == null && day == null)
            }
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 transition-colors hover:bg-[#d7e8d0]/60 disabled:cursor-not-allowed disabled:opacity-50"
            title="Clear the date"
          >
            <X className="h-2.5 w-2.5" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
