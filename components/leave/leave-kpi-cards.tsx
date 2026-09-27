"use client";

import { CalendarCheck, Clock, XCircle, CheckCircle, CalendarX } from "lucide-react";
import type { LeaveKPIs } from "@/lib/types/leave";

interface LeaveKPIGridProps {
  kpis: LeaveKPIs;
}

export function LeaveKPIGrid({ kpis }: LeaveKPIGridProps) {
  const metrics = [
    {
      label: "Total applications",
      value: kpis.total,
      subtext: "Logged leave requests",
      icon: CalendarCheck,
      iconColor: "text-zinc-400",
    },
    {
      label: "Pending review",
      value: kpis.pending,
      subtext: "Awaiting supervisor sign-off",
      icon: Clock,
      iconColor: "text-amber-500",
    },
    {
      label: "Approved leaves",
      value: kpis.approved,
      subtext: "Authorized and scheduled",
      icon: CheckCircle,
      iconColor: "text-emerald-700",
    },
    {
      label: "Rejected requests",
      value: kpis.rejected,
      subtext: "Declined applications",
      icon: XCircle,
      iconColor: "text-rose-500",
    },
    {
      label: "Cancelled requests",
      value: kpis.cancelled,
      subtext: "Withdrawn by employee",
      icon: CalendarX,
      iconColor: "text-zinc-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
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