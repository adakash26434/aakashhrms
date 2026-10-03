import { Network } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";
import { formatAmount } from "@/lib/kit/amount";
import type { DepartmentCost } from "@/lib/types/dashboard";

/** Payroll cost by department for the selected period, largest first (horizontal bars). */
export function DashboardDepartmentCostCard({ departments, periodLabel }: { departments: DepartmentCost[]; periodLabel: string }) {
  const max = Math.max(...departments.map((d) => d.cost), 1);
  const total = departments.reduce((n, d) => n + d.cost, 0);
  return (
    <Panel level={3} id="dashboard-department-cost" title="Cost by department" icon={<Network />} meta={periodLabel} href="/reports/salary-sheet" hrefLabel="Salary sheet">
      {departments.length === 0 ? (
        <EmptyState className="flex-1 py-6" icon={<Network className="h-5 w-5" />} title="No payroll in this period" description="Cost by department appears once payroll is calculated." />
      ) : (
        <table className="w-full text-xs">
          <caption className="sr-only">Payroll cost and employees paid by department</caption>
          <thead className="text-3xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th scope="col" className="px-4 pb-1 pt-2.5 text-left font-medium">Department</th>
              <th scope="col" className="hidden w-[40%] px-1 pb-1 pt-2.5 text-left font-medium sm:table-cell">
                <span className="sr-only">Share</span>
              </th>
              <th scope="col" className="px-1 pb-1 pt-2.5 text-right font-medium">Paid</th>
              <th scope="col" className="px-4 pb-1 pt-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.name}>
                <th scope="row" className="max-w-40 truncate px-4 py-1.5 text-left font-normal text-ink">
                  {d.name}
                </th>
                <td className="hidden px-1 py-1.5 sm:table-cell" aria-hidden>
                  <span className="block h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <span className="block h-full rounded-full bg-brand/75" style={{ width: `${(d.cost / max) * 100}%` }} />
                  </span>
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums text-ink-muted">{d.employees}</td>
                <td className="whitespace-nowrap px-4 py-1.5 text-right font-medium tabular-nums text-ink" title={formatAmount(d.cost, { prefix: "NPR" })}>
                  {formatAmount(d.cost, { compact: true })}
                  <span className="ml-1 text-3xs font-normal text-ink-faint">{total ? Math.round((d.cost / total) * 100) : 0}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
