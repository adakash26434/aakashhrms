"use client";

import { Users, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { AttendanceKPIs } from "@/lib/types/attendance";

export function AttendanceKPIsGrid({ kpis }: { kpis: AttendanceKPIs }) {
  const metrics = [
    {
      label: "Total employees",
      value: kpis.totalEmployees,
      subtext: "Roster headcount",
      icon: Users,
      iconColor: "text-zinc-400",
    },
    {
      label: "Present today",
      value: kpis.presentCount,
      subtext: "Logged attendance",
      icon: CheckCircle,
      iconColor: "text-emerald-700",
    },
    {
      label: "Absent / LWOP",
      value: kpis.absentCount,
      subtext: "Unexcused or leave without pay",
      icon: XCircle,
      iconColor: "text-rose-500",
    },
    {
      label: "Late arrivals",
      value: kpis.lateCount,
      subtext: "Past grace threshold",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
    },
    {
      label: "Total OT hours",
      value: `${kpis.totalOtHours}h`,
      subtext: "Approved overtime",
      icon: Clock,
      iconColor: "text-zinc-600",
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