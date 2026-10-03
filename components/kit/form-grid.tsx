"use client";

import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact desktop form layout (4.2), after SAP Fiori's responsive form grid
 * and Business Central's FastTabs: label-and-field pairs flow into columns
 * (1 on phones, 2 from 768px, 3 from 1280px), captions sit left of their
 * fields, and each field is only as wide as its data. Rows are 28px.
 */
export function FormGrid({ children, className, columns = 3 }: { children: ReactNode; className?: string; columns?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-2.5 px-4 py-3 md:grid-cols-2",
        columns === 3 && "xl:grid-cols-3",
        // Dense desktop rows: every text-like control is 28px high in a form grid.
        "[&_input:not([type=checkbox])]:h-7 [&_button[data-enter-field]]:h-7",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Field widths by the data they hold, so short values never get long boxes. */
const SIZE = {
  xs: "w-20", // ward no., grade count
  code: "w-36", // codes, PAN, mobile
  date: "w-40", // dates
  amount: "w-44", // money
  md: "w-full max-w-60", // choices, short names
  lg: "w-full max-w-96", // names, emails
  full: "w-full", // addresses, reasons
} as const;

export type GridFieldSize = keyof typeof SIZE;

type Control = ReactElement<{
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}>;

/**
 * One label + field pair in a FormGrid. `span` widens it across columns;
 * `size` caps the control's width. Help is not printed under the field (that
 * makes rows jump): the form's status line shows it for the focused field
 * (useFieldHelp), and screen readers get it through aria-describedby.
 * Errors always show under the field.
 */
export function GridField({
  label,
  children,
  required,
  error,
  help,
  span = 1,
  size = "md",
  suffix,
  className,
}: {
  label: string;
  children: Control | ReactNode;
  /** Shown right of the control (a unit, an age, a calculated hint). */
  suffix?: ReactNode;
  required?: boolean;
  error?: string | null;
  help?: string;
  span?: 1 | 2 | 3;
  size?: GridFieldSize;
  className?: string;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const helpId = help ? `${id}-help` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as Control, {
        id,
        "aria-describedby": [errorId, helpId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div
      data-field-help={help || undefined}
      className={cn(
        "group grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3",
        span === 2 && "md:col-span-2",
        span === 3 && "md:col-span-2 xl:col-span-3",
        className
      )}
    >
      <label htmlFor={id} className="truncate pt-1 text-xs text-ink-muted sm:text-right" title={label}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      <div className="min-w-0">
        {/* Same element tree with or without a suffix: switching trees would remount the
            control and drop focus while the user types (e.g. when "Age 31" appears). */}
        <div className="flex items-start gap-2">
          <div className={cn("min-w-0 max-w-full [&>*]:max-w-none", SIZE[size], size !== "full" && "shrink-0")}>{control}</div>
          {suffix ? <div className="shrink-0 whitespace-nowrap pt-1.5 text-2xs text-ink-faint">{suffix}</div> : null}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="mt-0.5 text-3xs font-medium text-danger">
            {error}
          </p>
        ) : null}
        {help && (
          <span id={helpId} className="sr-only">
            {help}
          </span>
        )}
      </div>
    </div>
  );
}

/** A value shown in the grid without an input (e.g. a calculated total). */
export function GridValue({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 | 3 }) {
  return (
    <div className={cn("grid grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center sm:gap-3", span === 2 && "md:col-span-2", span === 3 && "md:col-span-2 xl:col-span-3")}>
      <span className="text-xs text-ink-muted sm:text-right">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

/**
 * The help text of the field that has focus, for a status line (like the
 * hint bar of desktop accounting software). Empty when the field has none.
 */
export function useFieldHelp(): string {
  const [help, setHelp] = useState("");
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const owner = (e.target as Element | null)?.closest?.("[data-field-help]");
      setHelp(owner?.getAttribute("data-field-help") ?? "");
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  return help;
}
