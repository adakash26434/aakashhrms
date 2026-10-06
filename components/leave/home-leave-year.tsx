"use client";

import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { fmt } from "@/lib/engines/leave.engine";
import type { StatusKey } from "@/lib/kit/status";
import type { HomeLeaveYear } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

// The kit's status vocabulary (icon + label), so these read like every other status.
const STATUS: Record<HomeLeaveYear["months"][number]["status"], { key: StatusKey; label: string }> = {
  closed: { key: "approved", label: "Added" },
  waiting: { key: "pending", label: "Waiting for month close" },
  open: { key: "review", label: "This month" },
  to_come: { key: "draft", label: "To come" },
  before: { key: "inactive", label: "In the starting balance" },
  outside: { key: "inactive", label: "Not employed" },
};

/**
 * Home leave for the leave year, laid out the way it is earned (Labour Act
 * §43): what was brought forward, earned so far, taken and the balance, the
 * most the year can give, and month by month what each attendance month
 * added (or is earning while it is open). Used on the Balances pane, the
 * employee record and self-service.
 */
export function HomeLeaveYearView({ year, mine = false, className }: { year: HomeLeaveYear; mine?: boolean; className?: string }) {
  const months = year.months.filter((m) => m.status !== "outside");
  const facts: [string, string, string?][] = [
    ["Brought forward", fmt(year.broughtForward), "From earlier years, or the starting balance entered when the company started using AakashHRMS"],
    ["Earned so far", fmt(year.earned), "Months closed this year"],
    ["Taken", fmt(year.taken)],
    ["Balance now", fmt(year.balance), "What can be taken today"],
    ["Up to this year", fmt(year.upTo), "If every remaining day is paid"],
  ];
  return (
    <section aria-label={`Home leave ${year.yearLabel}`} className={cn("@container rounded-lg border border-line bg-surface px-3 py-2.5 text-xs", className)}>
      <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
        <span>Home leave · {year.yearLabel}</span>
        <span className="font-normal normal-case tracking-normal">1 day for every 20 paid days</span>
      </h3>

      {year.givenUpFront !== null && (
        <Notice tone="warning" className="mb-2">
          {fmt(year.givenUpFront)} days were given up front for this year by the old system. {mine ? "Once HR switches to earned home leave, your balance becomes the days you have actually earned." : "After the switch to earned home leave (Balances tab), the balance becomes the days actually earned."}
        </Notice>
      )}

      <dl className="grid grid-cols-2 gap-1.5 @md:grid-cols-5">
        {facts.map(([label, value, hint]) => (
          <div key={label} className={cn("rounded-md px-2 py-1.5", label === "Balance now" ? "bg-brand-subtle" : "bg-surface-sunken")} title={hint}>
            <dt className="text-3xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
            <dd className={cn("text-sm font-semibold tabular-nums", label === "Balance now" ? (year.balance < 0 ? "text-danger" : "text-brand-strong") : "text-ink")}>{value}</dd>
          </div>
        ))}
      </dl>
      {year.other !== 0 && <p className="mt-1 text-2xs text-ink-muted">Other changes this year: {year.other > 0 ? "+" : ""}{fmt(year.other)} (adjustments by HR or days paid out).</p>}

      <table className="mt-2.5 w-full text-2xs">
        <thead>
          <tr className="text-left text-ink-muted">
            <th scope="col" className="py-1 pr-2 font-medium">Month</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">Paid days</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">Earned</th>
            <th scope="col" className="py-1 font-medium">
              <span className="sr-only">Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.start} className="border-t border-line">
              <td className={cn("py-1 pr-2", m.status === "to_come" ? "text-ink-muted" : "text-ink")}>{m.label}</td>
              <td className="py-1 pr-2 text-right tabular-nums text-ink-muted">{m.paidDays === null ? "—" : `${fmt(m.paidDays)}${m.status === "open" ? " so far" : ""}`}</td>
              <td className={cn("py-1 pr-2 text-right font-medium tabular-nums", m.status === "closed" ? "text-success" : "text-ink-muted")}>
                {m.earned === null ? "—" : m.status === "closed" ? `+${fmt(m.earned)}` : `≈ ${fmt(m.earned)}`}
              </td>
              <td className="py-1">
                <StatusChip status={STATUS[m.status].key} label={STATUS[m.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-2xs text-ink-muted">
        Paid days are days worked, weekly offs, holidays and paid leave; absences and unpaid leave don&apos;t count. Each month&apos;s home leave is added when its attendance is closed{mine ? " by HR" : ""}. Up to 90 days can be kept; above that is paid out at basic salary.
      </p>
    </section>
  );
}
