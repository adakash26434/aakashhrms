"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { formatDateInput } from "@/lib/utils/date-input-formatter";
import { BS_MONTHS_EN, formatADDate } from "@/lib/utils/bs-calendar";
import { nepalDateIso, toLocalDate } from "@/lib/utils/nepal-time";
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
 * Date field (4.2) in the design of the original AakashHRMS date picker:
 * a text box with an attached eraser, the other-calendar equivalent under it,
 * and a calendar with a green header, round ‹ › buttons and Month / Year
 * drop-downs. Type the date (slashes are added for you) or pick it.
 * Keyboard: Alt+↓ opens the calendar, arrows move a day / week, PageUp and
 * PageDown move a month, Enter picks and moves to the next field, Esc closes.
 * With the calendar closed, Enter moves on like any other field; clicking the
 * box opens the calendar, as before.
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
  // Open the calendar to the left when there is no room on the right (fields in the last column).
  const [alignRight, setAlignRight] = useState(false);
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
    const rect = wrapRef.current?.getBoundingClientRect();
    setAlignRight(!!rect && rect.left + 300 > window.innerWidth - 12);
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
  const valueDate = toLocalDate(value || null);
  // The original picker's line under the field: the other calendar's date, and which calendar this is.
  const equivalent = valueDate
    ? isBS
      ? `AD Equivalent: ${formatADDate(valueDate, "long")}`
      : (() => {
          const bs = isoToDay(value, true);
          return bs ? `BS Equivalent: ${isoToDisplay(value, true)} (${BS_MONTHS_EN[bs.month]})` : "";
        })()
    : "";

  /** Jump the calendar to another month or year from the header drop-downs, keeping the day where possible. */
  const showMonth = (year: number, month: number) => {
    const { days } = monthLayout(year, month, isBS);
    const iso = dayToIso({ year, month, day: Math.min(view.day, days) }, isBS);
    if (iso) {
      setCursor(iso);
      setMoved(true);
    }
    // Back to the field so the keyboard (and Enter) keep working.
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const yearOptions = Array.from({ length: years.max - years.min + 1 }, (_, i) => years.min + i);

  const roundButton = "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 active:scale-95";
  const headerSelect =
    "cursor-pointer appearance-none rounded-md border border-white/40 bg-white py-0.5 pl-2 pr-5 text-xs font-semibold text-ink shadow-xs focus:outline-none focus:ring-1 focus:ring-white";

  return (
    // pb-4 keeps room for the equivalent line, which is drawn on one line under the box and may
    // extend to the left (under the field's label) so it never stretches the row.
    <div ref={wrapRef} className={cn("relative w-full max-w-md pb-4", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY/MM/DD"
          disabled={disabled}
          readOnly={readOnly}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          onClick={() => !open && openCalendar()}
          data-incomplete={unfinished || undefined}
          onBlur={() => {
            setTyped(null); // an unfinished date falls back to the stored one
            setUnfinished(false);
          }}
          className={cn(inputClass, "max-w-none pr-10 font-code font-medium tabular-nums", unfinished && "border-danger", open && "border-brand ring-2 ring-brand/20")}
          {...aria}
        />
        {/* Attached eraser, as on the original picker: clears the date (mouse only; Backspace clears by keyboard). */}
        {!readOnly && (
          <button
            type="button"
            tabIndex={-1}
            data-enter-skip
            disabled={disabled}
            aria-label="Clear date"
            title="Clear date"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTyped(null);
              setOpen(false);
              if (value) onChange("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-px right-px flex w-8 cursor-pointer items-center justify-center rounded-r-[5px] border-l border-line-input bg-surface-sunken text-ink-muted transition-colors hover:bg-canvas hover:text-ink disabled:cursor-not-allowed"
          >
            <Eraser aria-hidden className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {unfinished ? (
        <p role="alert" className="absolute bottom-0 right-0 w-max max-w-[22rem] whitespace-nowrap text-3xs font-medium text-danger">
          Finish the date as YYYY/MM/DD ({isBS ? "BS" : "AD"}).
        </p>
      ) : (
        equivalent && (
          <p className="absolute bottom-0 right-0 flex w-max items-center gap-2 whitespace-nowrap font-code text-3xs text-ink-muted">
            <span>{equivalent}</span>
            <span className="shrink-0 font-sans text-3xs font-bold uppercase tracking-wider text-brand">{isBS ? "B.S. Calendar" : "A.D. Calendar"}</span>
          </p>
        )
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className={cn("absolute top-full z-50 mt-1.5 w-72 rounded-lg border border-line-strong bg-white p-2.5 shadow-2xl", alignRight ? "right-0" : "left-0")}
        >
          {/* Green header with round buttons and Month / Year drop-downs (the original design). */}
          <div className="flex items-center justify-between rounded-md bg-brand px-2.5 py-1.5 text-white shadow-xs" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Previous month"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMoved(true);
                setCursor((c) => shiftIsoMonths(c || today, -1, isBS));
                inputRef.current?.focus();
              }}
              className={roundButton}
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="relative">
                <select aria-label="Month" tabIndex={-1} value={view.month} onChange={(e) => showMonth(view.year, Number(e.target.value))} className={headerSelect}>
                  {months.slice(1, 13).map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-faint" />
              </span>
              <span className="relative">
                <select aria-label="Year" tabIndex={-1} value={view.year} onChange={(e) => showMonth(Number(e.target.value), view.month)} className={cn(headerSelect, "font-code")}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-faint" />
              </span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Next month"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setMoved(true);
                setCursor((c) => shiftIsoMonths(c || today, 1, isBS));
                inputRef.current?.focus();
              }}
              className={roundButton}
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 pb-1 pt-2 text-center text-2xs font-semibold text-ink-muted" onMouseDown={(e) => e.preventDefault()}>
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-0.5">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center" onMouseDown={(e) => e.preventDefault()}>
            {Array.from({ length: layout.firstWeekday }, (_, i) => (
              <span key={`blank-${i}`} className="h-7" />
            ))}
            {Array.from({ length: layout.days }, (_, i) => {
              const day = i + 1;
              const iso = dayToIso({ year: view.year, month: view.month, day }, isBS) ?? "";
              const isCursor = iso === cursor && moved;
              const isValue = iso === value;
              const isToday = iso === today;
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
                    "flex h-7 w-full cursor-pointer select-none items-center justify-center rounded-sm text-xs font-medium tabular-nums transition-colors",
                    isValue ? "z-10 bg-brand font-bold text-white shadow-xs" : "text-ink hover:bg-surface-sunken",
                    isToday && !isValue && "font-bold text-brand ring-1 ring-brand",
                    isCursor && !isValue && "bg-brand-subtle ring-2 ring-inset ring-focus"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 border-t border-line pt-1.5 text-center text-3xs text-ink-faint">Arrows move · PgUp/PgDn month · Enter picks · Esc closes</p>
        </div>
      )}
    </div>
  );
}
