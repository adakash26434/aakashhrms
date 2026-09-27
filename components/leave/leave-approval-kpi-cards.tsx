"use client";

import { Clock, CheckCircle, XCircle, Users } from "lucide-react";

interface ApprovalKPIs {
  totalPending: number;
  approvedToday: number;
  rejectedToday: number;
  awaitingMyReview: number;
}

interface LeaveApprovalKPIGridProps {
  kpis: ApprovalKPIs;
}

export function LeaveApprovalKPIGrid({ kpis }: LeaveApprovalKPIGridProps) {
  const metrics = [
    {
      label: "Pending approvals",
      value: kpis.totalPending,
      subtext: "Across all teams",
      icon: Clock,
      iconColor: "text-amber-500",
    },
    {
      label: "Approved today",
      value: kpis.approvedToday,
      subtext: "Resolved requests",
      icon: CheckCircle,
      iconColor: "text-emerald-700",
    },
    {
      label: "Rejected today",
      value: kpis.rejectedToday,
      subtext: "Declined requests",
      icon: XCircle,
      iconColor: "text-rose-500",
    },
    {
      label: "Awaiting my review",
      value: kpis.awaitingMyReview,
      subtext: "Assigned to your queue",
      icon: Users,
      iconColor: "text-zinc-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">{m.label}</p>
                <Icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {m.value}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {m.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}