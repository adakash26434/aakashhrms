"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { formatDateInput } from "@/lib/utils/date-input-formatter";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { dayToIso, isoToDay, isoToDisplay, monthLayout, shiftIsoDays, shiftIsoMonths } from "@/lib/kit/date-field";
import { useFormNav } from "./use-enter-navigation";
import { inputClass } from "./property-form";
import { cn } from "@/lib/utils";

const AD_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface DateFieldProps {
  /** Stored AD date "YYYY-MM-DD", or "" when empty. */
  value: string;
  onChange: (iso: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Forces a calendar; by default it follows the BS/AD switch in the title bar. */
  calendar?: "BS" | "AD";
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * Date field (4.2). Type the date (slashes are added for you) or pick it.
 * Keyboard: Alt+↓ opens the calendar, arrows move a day / week, PageUp and
 * PageDown move a month, Enter picks and moves to the next field, Esc closes.
 * With the calendar closed, Enter moves on like any other field.
 */
export function DateField({
  value,
  onChange,
  name,
  id,
  disabled,
  readOnly,
  calendar,
  className,
  ...aria
}: DateFieldProps) {
  const { isBS: globalBS } = useDateFormat();
  const isBS = calendar ? calendar === "BS" : globalBS;
  const nav = useFormNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState<string | null>(null); // null = showing the stored value
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string>(""); // AD iso of the highlighted day
  const text = typed ?? isoToDisplay(value, isBS);
  const today = useMemo(() => nepalDateIso(), []);

  const view = isoToDay(cursor || value || today, isBS) ?? { year: 2083, month: 1, day: 1 };
  const layout = monthLayout(view.year, view.month, isBS);

  // Close when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openCalendar = () => {
    if (disabled || readOnly) return;
    setCursor(value || today);
    setOpen(true);
  };

  const commit = (iso: string) => {
    if (iso !== value) onChange(iso);
    setTyped(null);
    setOpen(false);
  };

  const onType = (raw: string) => {
    const result = formatDateInput({ raw, prevValue: text, isBS });
    setTyped(result.formatted);
    if (!result.formatted) {
      if (value) onChange("");
      return;
    }
    if (result.isValid && result.year && result.month && result.day) {
      const iso = dayToIso({ year: result.year, month: result.month, day: result.day }, isBS);
      if (iso) {
        if (iso !== value) onChange(iso);
        if (open) setCursor(iso);
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      return open ? setOpen(false) : openCalendar();
    }
    if (!open) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      setCursor((c) => shiftIsoDays(c || today, step[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setCursor((c) => shiftIsoMonths(c || today, e.key === "PageUp" ? -1 : 1, isBS));
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit(cursor || today);
      nav?.advanceFrom(inputRef.current);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const months = isBS ? BS_MONTHS_EN : AD_MONTHS;
  const otherCalendar = value ? `${isBS ? "AD" : "BS"} ${isoToDisplay(value, !isBS)}` : "";

  return (
    <div ref={wrapRef} className={cn("relative w-full max-w-md", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={`YYYY/MM/DD (${isBS ? "BS" : "AD"})`}
        disabled={disabled}
        readOnly={readOnly}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTyped(null)} // an unfinished date falls back to the stored one
        className={cn(inputClass, "max-w-none pr-28 font-code tabular-nums")}
        {...aria}
      />
      <span className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
        {otherCalendar && <span className="hidden text-2xs tabular-nums text-ink-faint sm:inline">{otherCalendar}</span>}
        {!readOnly && (
          <button
            type="button"
            tabIndex={-1}
            data-enter-skip
            disabled={disabled}
            aria-label="Open calendar"
            title="Open calendar (Alt+↓)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              inputRef.current?.focus();
              if (open) setOpen(false);
              else openCalendar();
            }}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ink-faint hover:bg-surface-sunken hover:text-ink"
          >
            <CalendarDays aria-hidden className="h-4 w-4" />
          </button>
        )}
      </span>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          onMouseDown={(e) => e.preventDefault()} // keep focus (and the keyboard) in the field
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-line-strong bg-surface p-2 shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Previous month"
              onClick={() => setCursor((c) => shiftIsoMonths(c || today, -1, isBS))}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-surface-sunken"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <p className="text-xs font-semibold text-ink">
              {months[view.month]} {view.year} <span className="font-normal text-ink-faint">{isBS ? "BS" : "AD"}</span>
            </p>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Next month"
              onClick={() => setCursor((c) => shiftIsoMonths(c || today, 1, isBS))}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-surface-sunken"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-3xs font-medium uppercase text-ink-faint">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: layout.firstWeekday }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: layout.days }, (_, i) => {
              const day = i + 1;
              const iso = dayToIso({ year: view.year, month: view.month, day }, isBS) ?? "";
              const isCursor = iso === cursor;
              const isValue = iso === value;
              return (
                <button
                  key={day}
                  type="button"
                  tabIndex={-1}
                  aria-label={isoToDisplay(iso, isBS)}
                  aria-pressed={isValue}
                  onClick={() => commit(iso)}
                  className={cn(
                    "h-7 cursor-pointer rounded text-xs tabular-nums text-ink hover:bg-surface-sunken",
                    iso === today && "font-semibold text-brand-strong",
                    isValue && "bg-brand text-white hover:bg-brand",
                    isCursor && !isValue && "ring-2 ring-inset ring-focus"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 border-t border-line pt-1.5 text-3xs text-ink-faint">Arrows move · PgUp/PgDn month · Enter picks · Esc closes</p>
        </div>
      )}
    </div>
  );
}
