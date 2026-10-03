import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";
import { Amount } from "@/components/kit/amount";
import type { StatutorySummary } from "@/lib/types/dashboard";

/**
 * Statutory liabilities for the period (Zoho's "benefits and deductions
 * summary"): what has to be deposited, by head, with employee and employer
 * sides apart. Bars show each head's share of the total.
 */
export function DashboardStatutoryCard({ statutory, periodLabel }: { statutory: StatutorySummary; periodLabel: string }) {
  const { total, rows } = statutory;
  return (
    <Panel level={3} bodyMaxHeight="max-h-80" id="dashboard-statutory" title="Statutory liabilities" icon={<ShieldCheck />} meta={periodLabel} href="/reports/tax-ird" hrefLabel="Tax reports">
      {rows.length === 0 ? (
        <EmptyState className="h-full py-6" icon={<ShieldCheck className="h-5 w-5" />} title="Nothing to deposit" description="No statutory deductions in this period." />
      ) : (
        <div className="p-4">
          <p className="text-2xs text-ink-muted">To deposit</p>
          <p className="text-xl font-semibold leading-tight">
            <Amount value={total} prefix="NPR" />
          </p>
          <ul className="mt-4 space-y-2.5">
            {rows.map((r) => (
              <li key={r.id} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-muted">{r.label}</span>
                  <Amount value={r.amount} className="font-medium text-ink" />
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                  <span className="block h-full rounded-full bg-brand/60" style={{ width: `${total ? (r.amount / total) * 100 : 0}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
