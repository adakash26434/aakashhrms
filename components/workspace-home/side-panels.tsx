"use client";

import Link from "next/link";
import { CalendarClock, ClipboardCheck, History, ShieldCheck, Sun, UsersRound } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { EmptyState } from "@/components/kit/empty-state";
import { TONE_CLASSES } from "@/components/kit/status-chip";
import { deadlineTone, deadlineWhen } from "@/lib/home/deadlines";
import type { HomeActivity, HomeDeadline, HomeWorkforceToday } from "@/lib/home/types";
import type { ReadinessIssue } from "@/lib/home/readiness";
import { cn } from "@/lib/utils";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

/* ---------------------------------------------------------------- Today -- */

export function TodayPanel({ today, showAttendance }: { today: HomeWorkforceToday; showAttendance: boolean }) {
  const notRecorded = Math.max(0, today.total - today.recorded - today.onLeave.length);
  const segments = [
    { label: "Present", value: today.present, className: "bg-success" },
    { label: "On leave", value: today.onLeave.length, className: "bg-info" },
    { label: "Absent", value: today.absent, className: "bg-danger" },
  ];
  return (
    <Panel id="home-today" title="Today" icon={<Sun />} meta={plural(today.total, "employee")} href={showAttendance ? "/timeAndLeave/attendance" : undefined} hrefLabel="Attendance">
      <div className="space-y-3 p-3">
        {showAttendance && (
          <div>
            {today.recorded === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-3 py-2 text-xs text-ink-muted">
                No attendance recorded yet today.
              </p>
            ) : (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                  {segments.map((s) =>
                    s.value > 0 ? <span key={s.label} className={s.className} style={{ width: `${(s.value / Math.max(today.total, 1)) * 100}%` }} /> : null
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
                  {[...segments, { label: "Late", value: today.late, className: "" }].map((s) => (
                    <div key={s.label}>
                      <dd className="text-sm font-semibold tabular-nums text-ink">{s.value}</dd>
                      <dt className="text-3xs text-ink-muted">{s.label}</dt>
                    </div>
                  ))}
                </dl>
                {notRecorded > 0 && <p className="mt-1.5 text-2xs text-warning">{plural(notRecorded, "employee")} not recorded yet</p>}
              </>
            )}
          </div>
        )}
        <div>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">On leave today</p>
          {today.onLeave.length === 0 ? (
            <p className="text-xs text-ink-muted">Everyone is in.</p>
          ) : (
            <ul className="space-y-1">
              {today.onLeave.slice(0, 6).map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-ink">{p.name}</span>
                  <span className="shrink-0 text-2xs text-ink-muted">
                    {p.leaveType} · until <DateCell value={p.until} />
                  </span>
                </li>
              ))}
              {today.onLeave.length > 6 && <li className="text-2xs text-ink-muted">and {today.onLeave.length - 6} more</li>}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ Deadlines -- */

export function DeadlinesPanel({ deadlines }: { deadlines: HomeDeadline[] }) {
  return (
    <Panel id="home-deadlines" title="Statutory deadlines" icon={<CalendarClock />} href="/reports/tax-ird" hrefLabel="Tax reports">
      {deadlines.length === 0 ? (
        <EmptyState title="No deposits due" description="Nothing statutory is due in the next month." />
      ) : (
        <ul className="divide-y divide-line">
          {deadlines.map((d) => {
            const tone = deadlineTone(d.daysLeft);
            return (
              <li key={d.id} className="flex items-start gap-3 px-3 py-2.5" title={d.basis}>
                <span className="mt-0.5 flex h-8 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface-sunken font-code text-2xs font-semibold text-ink">{d.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-ink">
                    {d.title} for {d.forPeriod}
                  </span>
                  <span className={cn("block text-2xs", d.daysLeft < 0 ? "text-danger" : "text-ink-muted")}>
                    {d.daysLeft < 0 ? "Was due " : "Due "}
                    <DateCell value={d.dueDate} variant="long" />
                    {d.daysLeft < 0 && " · check it was deposited"}
                    {d.amount !== null && (
                      <>
                        {" · "}
                        <Amount value={d.amount} prefix="NPR" />
                      </>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-2xs font-semibold tabular-nums",
                    tone === "neutral" ? TONE_CLASSES.neutral : TONE_CLASSES[tone]
                  )}
                >
                  {deadlineWhen(d.daysLeft)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line px-3 py-1.5 text-3xs text-ink-faint">Standard monthly deposit dates. Confirm with your tax advisor.</p>
    </Panel>
  );
}

/* ------------------------------------------------------------ Readiness -- */

export function ReadinessPanel({ checked, issues }: { checked: number; issues: ReadinessIssue[] }) {
  const affected = issues.reduce((n, i) => n + i.count, 0);
  return (
    <Panel
      id="home-readiness"
      title="Payroll readiness"
      icon={<ClipboardCheck />}
      count={affected}
      countTone="attention"
      meta={`${checked.toLocaleString("en-IN")} checked`}
      href="/workforce/employees"
      hrefLabel="Employees"
    >
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-4 text-xs text-success">
          <ShieldCheck className="h-4 w-4" /> Every active employee has a PAN, a bank account and a basic salary.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {issues.map((issue) => (
            <li key={issue.id} className="px-3 py-2.5">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs [&::-webkit-details-marker]:hidden">
                  <span className={cn("inline-flex h-5 min-w-7 items-center justify-center rounded-full border px-1.5 text-2xs font-semibold tabular-nums", TONE_CLASSES.warning)}>{issue.count}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{issue.label}</span>
                    <span className="block truncate text-2xs text-ink-muted">{issue.impact}</span>
                  </span>
                  <span className="text-2xs text-brand-strong group-open:hidden">Show</span>
                  <span className="hidden text-2xs text-brand-strong group-open:inline">Hide</span>
                </summary>
                <ul className="mt-2 space-y-1 pl-9">
                  {issue.sample.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-2 text-xs">
                      <Link href={`/workforce/employees/${e.id}/edit`} className="truncate text-ink hover:text-brand-strong hover:underline">
                        {e.name}
                      </Link>
                      <span className="shrink-0 font-code text-2xs text-ink-faint">{e.code}</span>
                    </li>
                  ))}
                  {issue.count > issue.sample.length && <li className="text-2xs text-ink-muted">and {issue.count - issue.sample.length} more</li>}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ Headcount -- */

export function HeadcountPanel({ headcount }: { headcount: { name: string; count: number }[] }) {
  const total = headcount.reduce((n, d) => n + d.count, 0);
  const max = Math.max(...headcount.map((d) => d.count), 1);
  const shown = headcount.slice(0, 8);
  const rest = headcount.slice(8).reduce((n, d) => n + d.count, 0);
  return (
    <Panel id="home-headcount" title="Headcount" icon={<UsersRound />} meta={plural(total, "active employee")} href="/workforce/organization" hrefLabel="Organisation">
      {total === 0 ? (
        <EmptyState title="No active employees" description="Add employees to see them by department." />
      ) : (
        <ul className="space-y-1.5 p-3">
          {shown.map((d) => (
            <li key={d.name} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-xs">
              <span className="truncate text-ink-muted">{d.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span className="block h-full rounded-full bg-brand/70" style={{ width: `${(d.count / max) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums text-ink">{d.count}</span>
            </li>
          ))}
          {rest > 0 && <li className="text-2xs text-ink-muted">Other departments: {rest}</li>}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------- Activity -- */

const RESULT_LABEL: Record<string, string> = { SUCCESS: "", DENIED_PERMISSION: "Denied", DENIED_SCOPE: "Denied", DENIED_SELF_APPROVAL: "Denied" };

function timeLabel(iso: string, todayIso: string) {
  const d = new Date(iso);
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(d) === todayIso;
  return sameDay
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }).format(d)
    : null;
}

export function ActivityPanel({ activity, todayIso }: { activity: HomeActivity[]; todayIso: string }) {
  return (
    <Panel id="home-activity" title="Recent activity" icon={<History />} href="/admin/audit-log" hrefLabel="Audit log">
      {activity.length === 0 ? (
        <EmptyState title="No activity yet" description="Changes people make will be listed here." />
      ) : (
        <table className="w-full text-xs">
          <caption className="sr-only">Latest audit log entries</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {activity.map((a) => {
              const denied = a.result.startsWith("DENIED");
              const time = timeLabel(a.at, todayIso);
              return (
                <tr key={a.id} className={cn(denied && "bg-danger-subtle/40")}>
                  <td className="w-16 whitespace-nowrap px-3 py-1.5 align-top tabular-nums text-ink-faint">{time ?? <DateCell value={a.at} />}</td>
                  <td className="max-w-40 truncate px-1 py-1.5 align-top font-medium text-ink">{a.actor}</td>
                  <td className="px-3 py-1.5 align-top text-ink-muted">
                    <span className="font-code text-2xs text-ink">{a.action}</span> · {a.module}
                    {denied && <span className={cn("ml-1.5 inline-flex h-4 items-center rounded-full border px-1.5 text-3xs font-semibold", TONE_CLASSES.danger)}>{RESULT_LABEL[a.result] || "Denied"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
