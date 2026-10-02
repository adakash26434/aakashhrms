import { UsersRound } from "lucide-react";
import { Panel } from "@/components/kit/panel";

/** Active employees by department (scoped). */
export function DashboardHeadcountCard({ headcount }: { headcount: { name: string; count: number }[] }) {
  const total = headcount.reduce((n, d) => n + d.count, 0);
  const max = Math.max(...headcount.map((d) => d.count), 1);
  const shown = headcount.slice(0, 7);
  const rest = headcount.slice(7).reduce((n, d) => n + d.count, 0);
  return (
    <Panel level={3} id="dashboard-headcount" title="Headcount" icon={<UsersRound />} meta={`${total.toLocaleString("en-IN")} active`} href="/workforce/organization" hrefLabel="Organisation">
      {total === 0 ? (
        <p className="p-4 text-xs text-ink-muted">No active employees yet.</p>
      ) : (
        <ul className="space-y-1.5 p-4">
          {shown.map((d) => (
            <li key={d.name} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-2 text-xs">
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
