"use client";

import { cloneElement, isValidElement, useId, useRef, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FormNavContext, useEnterNavigation, type EnterNavigationOptions } from "./use-enter-navigation";

/**
 * Property form (3.5): desktop-style "label left, value right" layout from
 * 768px, stacked below. Groups give long forms a scannable structure.
 *
 * `enterNavigation` (4.2) turns on Enter-to-next: Enter checks the field and
 * moves on, Shift+Enter goes back, and the form never submits on Enter.
 */
export function PropertyForm({
  children,
  className,
  onSubmit,
  id,
  enterNavigation,
}: {
  children: ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  id?: string;
  enterNavigation?: boolean | EnterNavigationOptions;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { onKeyDown, nav } = useEnterNavigation(formRef, typeof enterNavigation === "object" ? enterNavigation : {});
  const form = (
    <form
      ref={formRef}
      id={id}
      noValidate
      onKeyDown={enterNavigation ? onKeyDown : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
      }}
      // Keep a field clear of sticky headers and footers when Enter scrolls to it.
      className={cn("space-y-5 [&_input]:scroll-my-24 [&_select]:scroll-my-24 [&_textarea]:scroll-my-24", className)}
    >
      {children}
    </form>
  );
  return enterNavigation ? <FormNavContext.Provider value={nav}>{form}</FormNavContext.Provider> : form;
}

export function FieldGroup({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Right-aligned controls in the group header (e.g. "Copy from permanent address"). */
  aside?: ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-line">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-2.5">
        <div>
          <p aria-hidden className="text-xs font-semibold text-ink">
            {title}
          </p>
          {description && <p className="mt-0.5 text-2xs text-ink-faint">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </fieldset>
  );
}

type FieldControl = ReactElement<{
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  readOnly?: boolean;
}>;

/**
 * One labelled field. The control is cloned with id / aria-describedby /
 * aria-invalid / aria-required, so screen readers announce the label, help
 * text and error without extra wiring at every call site.
 */
export function FieldRow({
  label,
  children,
  help,
  error,
  required,
  readOnly,
  wide,
}: {
  label: string;
  children: FieldControl | ReactNode;
  help?: string;
  error?: string | null;
  required?: boolean;
  /** Shows the value as plain text on the sunken background. */
  readOnly?: boolean;
  /** Control spans the full width (e.g. addresses, notes). */
  wide?: boolean;
}) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as FieldControl, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        readOnly: readOnly || (children as FieldControl).props.readOnly,
      })
    : children;

  return (
    <div className={cn("grid gap-1.5 px-4 py-3 md:items-start md:gap-4", wide ? "md:grid-cols-1" : "md:grid-cols-[200px_minmax(0,1fr)]")}>
      <label htmlFor={id} className="pt-1.5 text-xs font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className={cn("min-w-0", readOnly && "[&_input]:bg-surface-sunken [&_select]:bg-surface-sunken [&_textarea]:bg-surface-sunken")}>
        {control}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-2xs font-medium text-danger">
            {error}
          </p>
        )}
        {help && !error && (
          <p id={helpId} className="mt-1 text-2xs text-ink-faint">
            {help}
          </p>
        )}
      </div>
    </div>
  );
}

/** Standard text-like input styling for kit forms. */
export const inputClass =
  "h-8 w-full max-w-md rounded-md border border-line-strong bg-white px-2.5 text-sm text-ink placeholder:text-ink-faint read-only:cursor-default read-only:border-line aria-[invalid=true]:border-danger";
