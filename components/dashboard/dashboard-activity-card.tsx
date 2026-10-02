"use client";

import { History } from "lucide-react";
import { Panel } from "@/components/kit/panel";
import { DateCell } from "@/components/kit/date-cell";
import { TONE_CLASSES } from "@/components/kit/status-chip";
import type { DashboardActivity } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

const RESULT_LABEL: Record<string, string> = { SUCCESS: "", DENIED_PERMISSION: "Denied", DENIED_SCOPE: "Denied", DENIED_SELF_APPROVAL: "Denied" };

function timeLabel(iso: string, todayIso: string) {
  const d = new Date(iso);
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(d) === todayIso;
  return sameDay
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" }).format(d)
    : null;
}

/** The latest audit-log entries (AUDIT_LOG permission only); denials are highlighted. */
export function DashboardActivityCard({ activity, todayIso }: { activity: DashboardActivity[]; todayIso: string }) {
  return (
    <Panel level={3} id="dashboard-activity" title="Recent activity" icon={<History />} href="/admin/audit-log" hrefLabel="Audit log">
      {activity.length === 0 ? (
        <p className="p-4 text-xs text-ink-muted">Changes people make will be listed here.</p>
      ) : (
        <table className="w-full text-xs">
          <caption className="sr-only">Latest audit log entries</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {activity.map((a) => {
              const denied = a.result.startsWith("DENIED");
              const time = timeLabel(a.at, todayIso);
              return (
                <tr key={a.id} className={cn(denied && "bg-danger-subtle/40")}>
                  <td className="w-16 whitespace-nowrap px-4 py-1.5 align-top tabular-nums text-ink-faint">{time ?? <DateCell value={a.at} />}</td>
                  <td className="max-w-40 truncate px-1 py-1.5 align-top font-medium text-ink">{a.actor}</td>
                  <td className="px-4 py-1.5 align-top text-ink-muted">
                    <span className="font-code text-2xs text-ink">{a.action}</span> · {a.module}
                    {denied && <span className={cn("ml-1.5 inline-flex h-4 items-center rounded-full border px-1.5 text-3xs font-semibold", TONE_CLASSES.danger)}>{RESULT_LABEL[a.result] || "Denied"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
