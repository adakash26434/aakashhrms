"use client";

import { useDateFormat } from "@/lib/contexts/date-format-context";
import { formatADDate, formatBSDate } from "@/lib/utils/bs-calendar";
import { cn } from "@/lib/utils";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Date (3.6, E7): follows the global BS/AD choice; the other calendar is in
 * the tooltip, so users can always cross-check against AD paperwork.
 */
export function DateCell({
  value,
  variant = "numeric",
  className,
}: {
  value: Date | string | null | undefined;
  variant?: "numeric" | "long";
  className?: string;
}) {
  const { isAD } = useDateFormat();
  const date = toDate(value);
  if (!date) return <span className={cn("text-ink-faint", className)}>—</span>;
  const bs = formatBSDate(date, variant === "long" ? "long" : "numeric");
  const ad = formatADDate(date, variant === "long" ? "long" : "iso");
  return (
    <time
      dateTime={formatADDate(date, "iso")}
      title={isAD ? `${bs} BS` : `${ad} AD`}
      className={cn("tabular-nums whitespace-nowrap", className)}
    >
      {isAD ? ad : bs}
    </time>
  );
}

/**
 * The same date as text, for titles, messages and other places where a
 * `<DateCell>` element does not fit. Follows the global BS/AD choice.
 */
export function useDateText(): (value: Date | string | null | undefined, variant?: "numeric" | "long") => string {
  const { isAD } = useDateFormat();
  return (value, variant = "numeric") => {
    const date = toDate(value);
    if (!date) return "—";
    return isAD ? formatADDate(date, variant === "long" ? "long" : "iso") : formatBSDate(date, variant === "long" ? "long" : "numeric");
  };
}

/** Both calendars for formal documents (letters): "1 Ashwin 2083 (2026-09-17)". */
export function bothCalendars(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? `${formatBSDate(date, "long")} (${formatADDate(date, "iso")})` : "—";
}
