"use client";

import { DAY_CODE, type DayResult, type DayType } from "@/lib/types/attendance";
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

/** A day's code ("P", "A", "½" …) with its tone; a dot marks an HR override, a ring a late day. */
export function DayCode({ day, className }: { day: DayResult; className?: string }) {
  const meta = DAY_CODE[day.dayType];
  return (
    <span
      title={`${meta.name}: ${day.rule}`}
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
        <span className="h-1.5 w-1.5 rounded-full bg-ink" /> set by HR
      </li>
      <li className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded ring-1 ring-warning" /> late
      </li>
    </ul>
  );
}
