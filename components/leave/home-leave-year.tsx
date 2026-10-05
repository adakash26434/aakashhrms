"use client";

import { Info } from "lucide-react";
import { fmt } from "@/lib/engines/leave.engine";
import type { HomeLeaveYear } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

const STATUS: Record<HomeLeaveYear["months"][number]["status"], { label: string; className: string }> = {
  closed: { label: "Added", className: "bg-success-subtle text-success" },
  waiting: { label: "Waiting for month close", className: "bg-warning-subtle text-warning" },
  open: { label: "This month · added when closed", className: "bg-info-subtle text-info" },
  to_come: { label: "To come", className: "bg-surface-sunken text-ink-muted" },
  before: { label: "In the starting balance", className: "bg-surface-sunken text-ink-muted" },
  outside: { label: "Not employed", className: "bg-surface-sunken text-ink-faint" },
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
        <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            {fmt(year.givenUpFront)} days were given up front for this year by the old system. {mine ? "Once HR switches to earned home leave, your balance becomes the days you have actually earned." : "After the switch to earned home leave (Balances tab), the balance becomes the days actually earned."}
          </span>
        </p>
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
                <span className={cn("inline-block rounded px-1.5 py-0.5 text-3xs font-medium", STATUS[m.status].className)}>{STATUS[m.status].label}</span>
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
