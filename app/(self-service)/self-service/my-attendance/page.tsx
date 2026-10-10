import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Hourglass } from "lucide-react";
import { getSessionEmployeeId } from "@/lib/services/self-service.service";
import { myMonth } from "@/lib/services/checkin.service";
import { DayCode } from "@/components/attendance/attendance-shared";
import { dayName, hoursText, localClock } from "@/lib/engines/attendance-day.engine";
import { bsDayOf, shiftPeriod, weekdayOf } from "@/lib/engines/pay-period.engine";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";

import { essLang } from "@/lib/i18n/ess-server";
import { t } from "@/lib/i18n/ess";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Attendance | Self-Service Portal",
  description: "Your days this month with the rule that decided each one, and clock-ins waiting for approval.",
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AD_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * My attendance (4.5c): the month with the same day rules HR and payroll
 * use (not only closed months, as before): each day's code, in, out, hours
 * and why; month totals; clock-ins outside the office and their approval.
 * Always the signed-in employee.
 */
export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const lang = await essLang();
  const sp = await searchParams;
  let data: Awaited<ReturnType<typeof myMonth>>;
  try {
    const { employeeId } = await getSessionEmployeeId();
    data = await myMonth(employeeId, Number(sp.year) || undefined, Number(sp.month) || undefined);
  } catch (error: unknown) {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-12 text-center text-sm text-ink-muted">
        <Clock className="mx-auto mb-2 h-8 w-8 text-brand" />
        {error instanceof Error ? error.message : "Your attendance could not be loaded. Contact HR."}
      </div>
    );
  }
  const { period, today, days, summary, requests } = data;
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const ad = (iso: string) => `${Number(iso.slice(8))} ${AD_MONTH[Number(iso.slice(5, 7)) - 1]}`;
  const tiles: [string, string, string?][] = [
    ["Paid days", String(summary.payableDays), "so far this month"],
    ["Unpaid days", String(summary.unpaidDays + summary.notEmployedDays), summary.unpaidDays ? "absent, unpaid leave or half days" : undefined],
    ["Late days", String(summary.lateDays)],
    ["Overtime", hoursText(summary.otWorkDayMinutes + summary.otOffDayMinutes)],
  ];
  const waiting = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{t(lang, "attendance.title")}</h1>
          <p className="mt-0.5 text-xs text-ink-muted">{t(lang, "attendance.description")}</p>
        </div>
        <nav aria-label="Month" className="inline-flex items-center gap-1 rounded-md border border-line bg-surface p-0.5">
          <Link href={`?year=${prev.year}&month=${prev.month}`} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-32 px-2 text-center text-sm font-semibold text-ink">{period.label}</span>
          <Link href={`?year=${next.year}&month=${next.month}`} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section aria-label="Month totals" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <p className="text-2xs text-ink-muted">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
            {hint && <p className="text-3xs text-ink-faint">{hint}</p>}
          </div>
        ))}
      </section>

      {requests.length > 0 && (
        <section aria-label="Clock-ins outside the office" className="rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">
            Clock-ins outside the office {waiting.length > 0 && <span className="ml-1 rounded-full bg-warning-subtle px-1.5 text-3xs font-semibold text-warning">{waiting.length} waiting</span>}
          </h2>
          <ul className="divide-y divide-line text-xs">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="w-32 tabular-nums text-ink">
                  {ad(r.at.slice(0, 10))} · {localClock(r.at)}
                </span>
                <span className="text-ink-muted">{r.kind === "remote_in" ? "Clock-in" : "Clock-out"}</span>
                <span className={r.status === "pending" ? "font-medium text-warning" : r.status === "approved" ? "font-medium text-success" : "font-medium text-danger"}>
                  {r.status === "pending" ? (
                    <>
                      <Hourglass className="mr-1 inline h-3 w-3" />
                      Waiting for approval
                    </>
                  ) : r.status === "approved" ? (
                    "Approved"
                  ) : r.status === "rejected" ? (
                    "Not approved"
                  ) : (
                    "Withdrawn"
                  )}
                </span>
                <span className="min-w-40 flex-1 text-ink-muted">“{r.reason}”</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Days" className="overflow-hidden rounded-lg border border-line bg-surface">
        <table className="w-full text-xs">
          <thead className="bg-surface-sunken text-left text-3xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-2 py-2 font-medium" aria-label="Day code" />
              <th className="hidden px-2 py-2 font-medium sm:table-cell">Shift</th>
              <th className="px-2 py-2 font-medium">In</th>
              <th className="px-2 py-2 font-medium">Out</th>
              <th className="hidden px-2 py-2 font-medium sm:table-cell">Worked</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d) => {
              const bs = bsDayOf(d.date);
              return (
                <tr key={d.date} className={d.date === today ? "bg-brand-subtle/50" : undefined}>
                  <td className="px-3 py-1.5">
                    <span className="font-medium tabular-nums text-ink">
                      {bs.day} {BS_MONTHS_EN[bs.month]?.slice(0, 3)}
                    </span>
                    <span className="ml-1.5 text-ink-faint">
                      {WEEKDAY[weekdayOf(d.date)]} · {ad(d.date)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <DayCode day={d} />
                      <span className="hidden text-ink-muted lg:inline">{dayName(d, today)}</span>
                    </span>
                  </td>
                  <td className="hidden px-2 py-1.5 text-ink-muted sm:table-cell">{d.shift ? `${d.shift.code} ${d.shift.start}–${d.shift.end}` : "—"}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ink">{localClock(d.firstIn) || "—"}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ink">{localClock(d.lastOut) || "—"}</td>
                  <td className="hidden px-2 py-1.5 tabular-nums text-ink sm:table-cell">{d.workMinutes ? hoursText(d.workMinutes) : "—"}</td>
                  <td className="hidden max-w-80 truncate px-3 py-1.5 text-ink-muted md:table-cell" title={d.rule}>
                    {d.rule}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
