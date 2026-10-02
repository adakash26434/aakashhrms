"use client";

import { CalendarClock } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { TONE_CLASSES } from "@/components/kit/status-chip";
import { deadlineTone, deadlineWhen } from "@/lib/engines/dashboard.engine";
import type { DashboardDeadline } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

/** Statutory deposit dates (TDS, SSF) with the amount from payroll when known. */
export function DashboardDeadlinesCard({ deadlines }: { deadlines: DashboardDeadline[] }) {
  return (
    <Panel level={3} id="dashboard-deadlines" title="Statutory deadlines" icon={<CalendarClock />} href="/reports/tax-ird" hrefLabel="Tax reports">
      {deadlines.length === 0 ? (
        <p className="p-4 text-xs text-ink-muted">Nothing statutory is due in the next month.</p>
      ) : (
        <ul className="divide-y divide-line">
          {deadlines.map((d) => {
            const tone = deadlineTone(d.daysLeft);
            return (
              <li key={d.id} className="flex items-start gap-2.5 px-4 py-2.5" title={d.basis}>
                <span className="mt-0.5 flex h-7 w-10 shrink-0 items-center justify-center rounded border border-line bg-surface-sunken font-code text-2xs font-semibold text-ink">
                  {d.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-ink">{d.forPeriod}</span>
                  <span className={cn("block text-2xs", d.daysLeft < 0 ? "text-danger" : "text-ink-muted")}>
                    {d.daysLeft < 0 ? "Was due " : "Due "}
                    <DateCell value={d.dueDate} variant="long" />
                    {d.amount !== null && d.amount > 0 && (
                      <>
                        {" · "}
                        <Amount value={d.amount} />
                      </>
                    )}
                  </span>
                </span>
                <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-2xs font-semibold tabular-nums", TONE_CLASSES[tone])}>
                  {deadlineWhen(d.daysLeft)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line px-4 py-1.5 text-3xs text-ink-faint">Standard deposit dates. Confirm with your tax advisor.</p>
    </Panel>
  );
}
