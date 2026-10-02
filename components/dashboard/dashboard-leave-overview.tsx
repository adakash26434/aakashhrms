"use client";

import { Plane } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { DateCell } from "@/components/kit/date-cell";

/** Leave taken this fiscal year by type, and who is away today. */
export function DashboardLeaveOverview({
  leaveByType,
  onLeaveToday,
}: {
  leaveByType: { fiscalYear: string; types: { name: string; days: number }[] } | null;
  onLeaveToday: { name: string; leaveType: string; until: string }[] | null;
}) {
  const types = leaveByType?.types ?? [];
  const max = Math.max(...types.map((t) => t.days), 1);
  const total = types.reduce((n, t) => n + t.days, 0);
  return (
    <Panel level={3} id="dashboard-leave" title="Leave" icon={<Plane />} meta={leaveByType?.fiscalYear} href="/timeAndLeave/leaves" hrefLabel="Leave">
      <div className="space-y-3 p-4">
        {leaveByType && (
          <div>
            <p className="mb-1.5 flex items-baseline justify-between text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              Days taken this year <span className="font-medium normal-case tracking-normal tabular-nums text-ink">{total.toLocaleString("en-IN")} days</span>
            </p>
            {types.length === 0 ? (
              <p className="text-xs text-ink-muted">No approved leave this fiscal year yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {types.slice(0, 6).map((t) => (
                  <li key={t.name} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 text-xs">
                    <span className="truncate text-ink-muted">{t.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                      <span className="block h-full rounded-full bg-info/70" style={{ width: `${(t.days / max) * 100}%` }} />
                    </span>
                    <span className="text-right font-medium tabular-nums text-ink">{t.days}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {onLeaveToday && (
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">On leave today</p>
            {onLeaveToday.length === 0 ? (
              <p className="text-xs text-ink-muted">Everyone is in.</p>
            ) : (
              <ul className="space-y-1">
                {onLeaveToday.slice(0, 5).map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-ink">{p.name}</span>
                    <span className="shrink-0 text-2xs text-ink-muted">
                      {p.leaveType} · until <DateCell value={p.until} />
                    </span>
                  </li>
                ))}
                {onLeaveToday.length > 5 && <li className="text-2xs text-ink-muted">and {onLeaveToday.length - 5} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
