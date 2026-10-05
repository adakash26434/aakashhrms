"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { CompanyWorkSchedule } from "@/lib/types/company-setup";

interface WorkScheduleTabProps {
  schedule: CompanyWorkSchedule;
  onScheduleChange?: (schedule: CompanyWorkSchedule) => void;
}

/**
 * Work schedule (read-only since 4.5b): working hours are set per shift in
 * Time & Leave → Attendance → Shifts. What shows here is the company default
 * shift, copied whenever it changes, for the screens that still read it.
 */
export function WorkScheduleTab({ schedule }: WorkScheduleTabProps) {
  const rows: [string, string][] = [
    ["Office hours", `${schedule.coreStartTime} – ${schedule.coreEndTime}`],
    ["Weekly off", schedule.weeklyOffDays.length ? schedule.weeklyOffDays.join(", ") : "None"],
    ["Working days a week", String(schedule.workingDaysPerWeek)],
    ["Break", `${schedule.lunchBreakMinutes} minutes`],
    ["Grace", `${schedule.gracePeriodMinutes} minutes`],
    ["Half day from", `${schedule.halfDayThresholdHours} hours`],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Work schedule</h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Working hours, weekly offs, break, grace and half day are set per shift, so branches and teams can work different hours. This is the company default shift.
        </p>
      </div>
      <dl className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-line bg-surface p-4 text-xs sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-b-0 sm:nth-last-2:border-b-0">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="font-medium tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/timeAndLeave/attendance?tab=shifts"
        className="inline-flex items-center gap-1.5 rounded-md border border-line-input bg-surface px-3 py-1.5 text-xs font-medium text-brand-strong hover:bg-surface-sunken"
      >
        <Clock3 className="h-3.5 w-3.5" /> Edit in Attendance → Shifts
      </Link>
    </div>
  );
}
