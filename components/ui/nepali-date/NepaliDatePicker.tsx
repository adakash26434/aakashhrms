"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BS_MONTHS_EN,
  adToBS,
  bsToAD,
  formatADDate,
  getDaysInBSMonth,
  isValidBSDate,
} from "@/lib/utils/bs-calendar";
import { useDateFormat } from "@/lib/contexts/date-format-context";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface NepaliDatePickerProps {
  /** Current value as an AD `Date` (from your form state). */
  value: Date | null;
  /** Called with the AD `Date` when a valid date is selected. */
  onChange: (adDate: Date) => void;
  /** Field label shown above the picker. */
  label?: string;
  /** Shows a red asterisk on the label. */
  required?: boolean;
  /** Disables all controls. */
  disabled?: boolean;
  /** Earliest selectable BS year. Defaults to 1976. */
  minBSYear?: number;
  /** Latest selectable BS year. Defaults to 2100. */
  maxBSYear?: number;
  /** Validation error shown below the picker. */
  error?: string;
  className?: string;
}

interface InternalState {
  year: number | "";
  month: number | "";
  day: number | "";
}

function fromValue(value: Date | null): InternalState {
  if (!value || isNaN(value.getTime())) return { year: "", month: "", day: "" };
  const bs = adToBS(value);
  return { year: bs.year, month: bs.month, day: bs.day };
}

/**
 * Controlled form input that picks a date in either B.S. (Year / Month
 * / Day dropdowns) or A.D. (native date input) — whichever the user
 * has selected globally via `DateFormatContext`. The output is always
 * a standard AD `Date` object.
 *
 * BS mode: the day dropdown auto-clamps to the actual number of days
 * in the selected BS month (28–32).
 *
 * AD mode: renders a single native `<input type="date">`. Day
 * validation is handled by the browser, and the value is fed straight
 * into `onChange`.
 */
export function NepaliDatePicker(props: NepaliDatePickerProps) {
  const { isAD } = useDateFormat();
  // Compute BS internal state always (cheap, only used in BS branch).
  const [state, setState] = useState<InternalState>(() => fromValue(props.value));

  // Sync internal state whenever props.value changes
  useEffect(() => {
    setState(fromValue(props.value));
  }, [props.value]);

  // Always compute the day-clamp memo so hook order is stable.
  const daysInSelectedMonth = useMemo(() => {
    if (state.year === "" || state.month === "") return 32;
    return getDaysInBSMonth(state.year, state.month) || 32;
  }, [state.year, state.month]);

  if (isAD) {
    return <ADPicker {...props} />;
  }
  return (
    <BSPicker
      {...props}
      state={state}
      setState={setState}
      daysInSelectedMonth={daysInSelectedMonth}
    />
  );
}

// ---------------------------------------------------------------------------
// AD mode — native date input
// ---------------------------------------------------------------------------

function ADPicker({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  error,
  className,
}: NepaliDatePickerProps) {
  const adValue = value ? toISODateInput(value) : "";
  return (
    <div className={className}>
      <style>{`
        .custom-date-input::-webkit-calendar-picker-indicator {
          display: none;
          -webkit-appearance: none;
        }
      `}</style>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-gray-400 pointer-events-none">
          <Calendar className="h-4 w-4" />
        </span>
        <input
          type="date"
          value={adValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const [y, m, d] = v.split("-").map(Number);
            if (!y || !m || !d) return;
            const d2 = new Date(y, m - 1, d);
            if (!isNaN(d2.getTime())) onChange(d2);
          }}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {}
          }}
          onFocus={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {}
          }}
          disabled={disabled}
          className={cn(
            "custom-date-input h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm text-payroll-navy transition-all",
            "focus:outline-none focus:ring-1 focus:border-payroll-primary focus:ring-payroll-primary",
            "hover:border-gray-300",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-payroll-light",
            disabled && "cursor-not-allowed bg-payroll-cream text-gray-400",
          )}
        />
      </div>
      {value && (
        <p className="mt-1.5 text-xs text-gray-500">
          AD: {formatADDate(value, "long")} — BS:{" "}
          {(() => {
            const bs = adToBS(value);
            return `${bs.monthName} ${bs.day}, ${bs.year}`;
          })()}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BS mode — three dropdowns
// ---------------------------------------------------------------------------

interface BSPickerProps extends NepaliDatePickerProps {
  state: InternalState;
  setState: React.Dispatch<React.SetStateAction<InternalState>>;
  daysInSelectedMonth: number;
}

function BSPicker({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  minBSYear = 1976,
  maxBSYear = 2100,
  error,
  className,
  state,
  setState,
  daysInSelectedMonth,
}: BSPickerProps) {
  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = minBSYear; y <= maxBSYear; y++) out.push(y);
    return out;
  }, [minBSYear, maxBSYear]);

  const dayOptions = useMemo(() => {
    const out: number[] = [];
    for (let d = 1; d <= daysInSelectedMonth; d++) out.push(d);
    return out;
  }, [daysInSelectedMonth]);

  function emitIfComplete(next: InternalState) {
    if (
      typeof next.year === "number" &&
      typeof next.month === "number" &&
      typeof next.day === "number" &&
      isValidBSDate(next.year, next.month, next.day)
    ) {
      onChange(bsToAD(next.year, next.month, next.day));
    }
  }

  function setField<K extends keyof InternalState>(key: K, raw: string) {
    if (raw === "") {
      const next: InternalState = { ...state, [key]: "" };
      setState(next);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;

    if (key === "month" || key === "year") {
      const newYear = key === "year" ? n : state.year;
      const newMonth = key === "month" ? n : state.month;
      const newMax =
        typeof newYear === "number" && typeof newMonth === "number"
          ? getDaysInBSMonth(newYear, newMonth)
          : 0;
      const clampedDay =
        typeof state.day === "number" && newMax > 0 && state.day > newMax
          ? ""
          : state.day;
      const next: InternalState = {
        ...state,
        year: key === "year" ? n : state.year,
        month: key === "month" ? n : state.month,
        day: clampedDay,
      };
      setState(next);
      emitIfComplete(next);
      return;
    }

    const next: InternalState = { ...state, day: n };
    setState(next);
    emitIfComplete(next);
  }

  // Confirmation hint shown when a complete date is selected.
  const confirmation = useMemo(() => {
    if (
      typeof state.year === "number" &&
      typeof state.month === "number" &&
      typeof state.day === "number" &&
      isValidBSDate(state.year, state.month, state.day)
    ) {
      const ad = bsToAD(state.year, state.month, state.day);
      const bs = adToBS(ad);
      return { bs, ad };
    }
    return null;
    // Note: we suppress the unused warning for `value` since it would
    // be redundant — when `value` changes we want the hint to follow it.
    void value;
  }, [state, value]);

  const selectClass = (hasError: boolean) =>
    cn(
      "h-9 rounded-md border bg-white px-2 text-sm text-[#1b3a1f] transition-colors",
      "focus:outline-none focus:ring-1",
      hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-[#2e7d32]",
      disabled && "cursor-not-allowed bg-[#f6faf6] text-gray-400",
    );

  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div className="flex items-center gap-2">
        <select
          aria-label="Year (B.S.)"
          value={state.year === "" ? "" : String(state.year)}
          onChange={(e) => setField("year", e.target.value)}
          disabled={disabled}
          className={cn(selectClass(Boolean(error)), "w-24")}
        >
          <option value="">Year</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          aria-label="Month (B.S.)"
          value={state.month === "" ? "" : String(state.month)}
          onChange={(e) => setField("month", e.target.value)}
          disabled={disabled || state.year === ""}
          className={cn(selectClass(Boolean(error)), "min-w-27.5 flex-1")}
        >
          <option value="">Month</option>
          {BS_MONTHS_EN.slice(1).map((name, i) => {
            const m = i + 1;
            return (
              <option key={m} value={m}>
                {name}
              </option>
            );
          })}
        </select>

        <select
          aria-label="Day (B.S.)"
          value={state.day === "" ? "" : String(state.day)}
          onChange={(e) => setField("day", e.target.value)}
          disabled={disabled || state.month === ""}
          className={cn(selectClass(Boolean(error)), "w-20")}
        >
          <option value="">Day</option>
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {confirmation && (
        <p className="mt-1.5 text-xs text-gray-500">
          BS: {confirmation.bs.monthName} {confirmation.bs.day},{" "}
          {confirmation.bs.year} — AD:{" "}
          {toISODateInput(confirmation.ad)}
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Format a Date as a `YYYY-MM-DD` string in the local timezone. */
function toISODateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
