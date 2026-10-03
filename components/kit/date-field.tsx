"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { formatDateInput } from "@/lib/utils/date-input-formatter";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import { DATE_YEARS, dayToIso, isoToDay, isoToDisplay, monthLayout, shiftIsoDays, shiftIsoMonths } from "@/lib/kit/date-field";
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
  // The calendar picks on Enter only once the user moved in it (or a date is already set),
  // so opening it by mouse and pressing Enter never fills in today by accident.
  const [moved, setMoved] = useState(false);
  // Enter on a half-typed date shows this instead of moving on.
  const [unfinished, setUnfinished] = useState(false);
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
    setMoved(false);
    setOpen(true);
  };

  const commit = (iso: string) => {
    if (iso !== value) onChange(iso);
    setTyped(null);
    setOpen(false);
  };

  const years = isBS ? DATE_YEARS.BS : DATE_YEARS.AD;
  const onType = (raw: string) => {
    setUnfinished(false);
    const result = formatDateInput({ raw, prevValue: text, isBS, minYear: years.min, maxYear: years.max });
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
    if (!open) {
      // A half-typed date: say so and stay, rather than moving on with the old value.
      if (e.key === "Enter" && !e.shiftKey && typed && typed !== isoToDisplay(value, isBS)) {
        e.preventDefault();
        setUnfinished(true);
      }
      return;
    }
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      setMoved(true);
      setCursor((c) => shiftIsoDays(c || today, step[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setMoved(true);
      setCursor((c) => shiftIsoMonths(c || today, e.key === "PageUp" ? -1 : 1, isBS));
    } else if (e.key === "Enter" && !e.shiftKey) {
      if (!moved && !value) {
        // Nothing chosen yet: close and let the form check the field.
        setOpen(false);
        return;
      }
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
        data-incomplete={unfinished || undefined}
        onBlur={() => {
          setTyped(null); // an unfinished date falls back to the stored one
          setUnfinished(false);
        }}
        className={cn(inputClass, "max-w-none pr-8 font-code tabular-nums", unfinished && "border-danger")}
        {...aria}
      />
      <span className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1">
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

      {unfinished ? (
        <p role="alert" className="mt-0.5 text-3xs font-medium text-danger">
          Finish the date as YYYY/MM/DD ({isBS ? "BS" : "AD"}).
        </p>
      ) : (
        otherCalendar && <p className="mt-0.5 text-3xs tabular-nums text-ink-faint">{otherCalendar}</p>
      )}

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
              onClick={() => {
                setMoved(true);
                setCursor((c) => shiftIsoMonths(c || today, -1, isBS));
                inputRef.current?.focus();
              }}
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
              onClick={() => {
                setMoved(true);
                setCursor((c) => shiftIsoMonths(c || today, 1, isBS));
                inputRef.current?.focus();
              }}
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
                  onClick={() => {
                    commit(iso);
                    // Keep the keyboard in the field so Enter moves on next.
                    inputRef.current?.focus();
                  }}
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
