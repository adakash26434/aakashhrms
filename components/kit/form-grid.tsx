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
        "grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-4 md:grid-cols-2",
        columns === 3 && "xl:grid-cols-3",
        // Dense desktop rows: every text-like control is 28px high in a form grid.
        "[&_input:not([type=checkbox])]:h-7.5 [&_button[data-enter-field]]:h-7.5",
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
  date: "w-full max-w-52", // dates (room for the other-calendar line under them)
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
        // The row being edited is tinted with a brand marker on its left, as desktop forms mark the current field.
        "group -mx-2 grid min-w-0 grid-cols-1 gap-1 rounded-md px-2 py-1 transition-colors focus-within:bg-brand-subtle focus-within:shadow-[inset_3px_0_0_var(--color-brand)] sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3",
        span === 2 && "md:col-span-2",
        span === 3 && "md:col-span-2 xl:col-span-3",
        className
      )}
    >
      <label
        htmlFor={id}
        className="pt-1.5 text-xs font-medium leading-tight text-ink-label group-focus-within:text-brand-strong sm:text-right"
        title={label}
      >
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
        <div className="flex flex-wrap items-start gap-x-2">
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
      <span className="text-xs font-medium text-ink-label sm:text-right">{label}</span>
      <div className="min-w-0 text-sm text-ink">{children}</div>
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

// ---------------------------------------------------------------------------
// Group box and view mode
// ---------------------------------------------------------------------------

/**
 * A numbered group box (a desktop "group box" / Business Central FastTab):
 * title bar with its step number, a short description, a progress chip for
 * required fields, and the fields in a FormGrid. `id` is what a section index
 * jumps to.
 */
export function FormGroup({
  id,
  index,
  title,
  description,
  aside,
  progress,
  columns = 3,
  children,
}: {
  id?: string;
  index?: number;
  title: string;
  description?: string;
  aside?: ReactNode;
  /** Required fields filled; omit for view mode or optional groups. */
  progress?: { filled: number; required: number; errors?: number };
  columns?: 2 | 3;
  children: ReactNode;
}) {
  const done = progress && progress.required > 0 && progress.filled === progress.required && !progress.errors;
  return (
    <section id={id} aria-label={title} className="scroll-mt-4 rounded-lg border border-line-card bg-surface shadow-sm">
      <header className="flex items-center gap-3 rounded-t-lg border-b border-line-card bg-surface px-4 py-2.5">
        {index !== undefined && (
          <span
            aria-hidden
            className={cn(
              "flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-3xs font-semibold tabular-nums",
              done ? "bg-success text-white" : progress?.errors ? "bg-danger text-white" : "bg-ink/80 text-white"
            )}
          >
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="truncate text-3xs text-ink-faint">{description}</p>}
        </div>
        {aside}
        {progress && progress.required > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-3xs font-medium tabular-nums",
              progress.errors ? "bg-danger-subtle text-danger" : done ? "bg-success-subtle text-success" : "bg-surface-sunken text-ink-muted"
            )}
          >
            {progress.errors ? `${progress.errors} to fix` : done ? "Complete" : `${progress.filled} of ${progress.required} required`}
          </span>
        )}
      </header>
      {/* Grey dialog surface: white, outlined fields stand out from their labels at a glance. */}
      <div className="rounded-b-lg bg-surface-panel">
        <FormGrid columns={columns}>{children}</FormGrid>
      </div>
    </section>
  );
}

/**
 * A value in view mode, drawn as a read-only box of the same width the field
 * has in the editor, so a record looks the same viewed and edited (as desktop
 * card pages do). Empty values show a dash.
 */
export function ViewField({
  label,
  value,
  size = "md",
  span = 1,
  mono,
  tone,
  suffix,
}: {
  label: string;
  value: ReactNode;
  size?: GridFieldSize;
  span?: 1 | 2 | 3;
  mono?: boolean;
  tone?: "warning" | "danger" | "success";
  suffix?: ReactNode;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3",
        span === 2 && "md:col-span-2",
        span === 3 && "md:col-span-2 xl:col-span-3"
      )}
    >
      <span className="pt-1.5 text-xs font-medium leading-tight text-ink-label sm:text-right">{label}</span>
      <div className="flex min-w-0 items-start gap-2">
        <div
          className={cn(
            "flex min-h-7.5 max-w-full items-center rounded-md border border-line bg-white px-2.5 py-1 text-sm font-medium leading-tight text-ink",
            SIZE[size],
            size !== "full" && "shrink-0",
            mono && "font-code tabular-nums",
            empty && "text-ink-faint",
            tone === "warning" && "border-warning/40 bg-warning-subtle text-warning",
            tone === "danger" && "border-danger/40 bg-danger-subtle text-danger",
            tone === "success" && "text-success"
          )}
        >
          <span className="min-w-0 break-words">{empty ? "—" : value}</span>
        </div>
        {suffix ? <div className="shrink-0 whitespace-nowrap pt-1.5 text-2xs text-ink-faint">{suffix}</div> : null}
      </div>
    </div>
  );
}
