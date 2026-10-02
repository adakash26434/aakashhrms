"use client";

import Link from "next/link";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/kit/panel";
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
    <Panel
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
        <p className="flex items-center gap-2 p-3 text-xs text-ink-muted">
          <CheckCircle2 className="h-4 w-4 text-success" /> No leave requests are waiting.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={APPROVALS_HREF} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-surface-sunken">
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
          {total > items.length && <li className="px-3 py-1.5 text-2xs text-ink-muted">and {total - items.length} more</li>}
        </ul>
      )}
    </Panel>
  );
}
