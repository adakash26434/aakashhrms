"use client";

import Link from "next/link";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { EmptyState } from "@/components/kit/empty-state";
import { DateCell } from "@/components/kit/date-cell";
import type { ApprovalPreviewItem } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

export const APPROVALS_HREF = "/timeAndLeave/leaves?tab=approvals";

/**
 * Pending leave approvals (4.1): the count and the five oldest requests.
 * Decisions are made on the Leave Approvals page, which shows the full
 * request, balance and team calendar.
 */
export function DashboardApprovalsCard({ total, items, scopeLabel }: { total: number; items: ApprovalPreviewItem[]; scopeLabel: string | null }) {
  return (
    <Panel level={3} bodyMaxHeight="max-h-80"
      id="dashboard-approvals"
      title="Pending approvals"
      icon={<CalendarCheck2 />}
      count={total}
      countTone="attention"
      meta={scopeLabel ?? undefined}
      href={APPROVALS_HREF}
      hrefLabel={total > 0 ? "Review" : "Open"}
    >
      {total === 0 ? (
        <EmptyState className="h-full py-6" icon={<CheckCircle2 className="h-5 w-5 text-success" />} title="All caught up" description="No leave requests are waiting for a decision." />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={APPROVALS_HREF} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-surface-sunken">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{item.employeeName}</span>
                  <span className="block truncate text-2xs text-ink-muted">
                    {item.leaveType} · {item.days} {item.days === 1 ? "day" : "days"} · <DateCell value={item.from} />
                  </span>
                </span>
                {item.waitingDays !== null && (
                  <span className={cn("shrink-0 text-2xs tabular-nums", item.waitingDays > 3 ? "font-semibold text-warning" : "text-ink-faint")}>
                    {item.waitingDays === 0 ? "today" : `${item.waitingDays}d`}
                  </span>
                )}
              </Link>
            </li>
          ))}
          {total > items.length && <li className="px-4 py-1.5 text-2xs text-ink-muted">and {total - items.length} more</li>}
        </ul>
      )}
    </Panel>
  );
}
