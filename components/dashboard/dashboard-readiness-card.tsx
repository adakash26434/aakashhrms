import Link from "next/link";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";
import { TONE_CLASSES } from "@/components/kit/status-chip";
import type { ReadinessIssue } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

/** Employee records that will break or weaken the next payroll run. */
export function DashboardReadinessCard({ checked, issues }: { checked: number; issues: ReadinessIssue[] }) {
  const affected = issues.reduce((n, i) => n + i.count, 0);
  return (
    <Panel level={3}
      id="dashboard-readiness"
      title="Records to fix"
      icon={<ClipboardCheck />}
      count={affected}
      countTone="attention"
      meta={`${checked.toLocaleString("en-IN")} checked`}
      href="/workforce/employees"
      hrefLabel="Employees"
    >
      {issues.length === 0 ? (
        <EmptyState className="flex-1 py-6" icon={<ShieldCheck className="h-5 w-5 text-success" />} title="All records ready" description="Every active employee has a PAN, a bank account and a basic salary." />
      ) : (
        <ul className="divide-y divide-line">
          {issues.map((issue) => (
            <li key={issue.id} className="px-4 py-2.5">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs [&::-webkit-details-marker]:hidden">
                  <span className={cn("inline-flex h-5 min-w-7 items-center justify-center rounded-full border px-1.5 text-2xs font-semibold tabular-nums", TONE_CLASSES.warning)}>
                    {issue.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{issue.label}</span>
                    <span className="block truncate text-2xs text-ink-muted">{issue.impact}</span>
                  </span>
                  <span className="text-2xs text-brand-strong group-open:hidden">Show</span>
                  <span className="hidden text-2xs text-brand-strong group-open:inline">Hide</span>
                </summary>
                <ul className="mt-1.5 space-y-1 pl-9">
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
