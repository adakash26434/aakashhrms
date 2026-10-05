"use client";

import { DAY_CODE, type DayResult, type DayType, type ShiftColor } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

// Shared by the attendance screens: day codes and their tones.

export const DAY_TONE: Record<DayType, string> = {
  present: "bg-success-subtle text-success",
  on_duty: "bg-success-subtle text-success",
  half_day: "bg-warning-subtle text-warning",
  missing_punch: "bg-warning-subtle text-warning",
  absent: "bg-danger-subtle text-danger",
  unpaid_leave: "bg-danger-subtle text-danger",
  paid_leave: "bg-info-subtle text-info",
  holiday: "bg-brand-subtle text-brand-strong",
  weekly_off: "bg-surface-sunken text-ink-muted",
  not_employed: "text-ink-faint",
  upcoming: "text-ink-faint",
};

/** A day's name; a day still to come today is "Not in yet". */
export function dayName(day: Pick<DayResult, "dayType" | "date">, today?: string): string {
  if (day.dayType === "upcoming") return today && day.date === today ? "Not in yet" : "Still to come";
  return DAY_CODE[day.dayType].name;
}

/** A day's code ("P", "A", "½" …) with its tone; a dot marks an HR override, a ring a late day. */
export function DayCode({ day, className }: { day: DayResult; className?: string }) {
  const meta = DAY_CODE[day.dayType];
  return (
    <span
      title={`${dayName(day)}: ${day.rule}`}
      className={cn(
        "relative inline-flex h-5 min-w-6 items-center justify-center rounded px-1 text-2xs font-semibold",
        DAY_TONE[day.dayType],
        day.flags.includes("late") && "ring-1 ring-warning",
        className
      )}
    >
      {meta.code}
      {day.flags.includes("override") && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-ink" />}
    </span>
  );
}

/** The legend of day codes. */
export function DayLegend() {
  const shown: DayType[] = ["present", "half_day", "absent", "missing_punch", "on_duty", "paid_leave", "unpaid_leave", "holiday", "weekly_off"];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-muted" aria-label="Day codes">
      {shown.map((t) => (
        <li key={t} className="inline-flex items-center gap-1">
          <span className={cn("inline-flex h-4 min-w-5 items-center justify-center rounded px-1 text-3xs font-semibold", DAY_TONE[t])}>{DAY_CODE[t].code}</span>
          {DAY_CODE[t].name}
        </li>
      ))}
      <li className="inline-flex items-center gap-1">
        <span className="inline-flex h-4 min-w-5 items-center justify-center rounded px-1 text-3xs font-semibold text-ink-faint">·</span>
        not yet (today before the shift ends, or later)
      </li>
      <li className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ink" /> set by HR
      </li>
      <li className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded ring-1 ring-warning" /> late
      </li>
    </ul>
  );
}

/** Shift colours (tokens). */
export const SHIFT_TONE: Record<ShiftColor, string> = {
  green: "bg-success-subtle text-success",
  blue: "bg-info-subtle text-info",
  amber: "bg-warning-subtle text-warning",
  rose: "bg-danger-subtle text-danger",
  slate: "bg-surface-sunken text-ink",
};

/** A shift code chip in its colour ("OFF" for a day off). */
export function ShiftChip({ code, color, off, strong, title, className }: { code: string; color?: ShiftColor; off?: boolean; strong?: boolean; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-2xs",
        off ? "text-ink-faint" : SHIFT_TONE[color ?? "slate"],
        strong ? "font-bold ring-1 ring-ink/30" : "font-medium",
        className
      )}
    >
      {off ? "OFF" : code}
    </span>
  );
}
