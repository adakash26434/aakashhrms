"use client";

import { Card } from "@/components/ui/card";
import { CalendarCheck, Clock, XCircle, CheckCircle, CalendarX } from "lucide-react";
import type { LeaveKPIs } from "@/lib/types/leave";

interface LeaveKPIGridProps {
  kpis: LeaveKPIs;
}

export function LeaveKPIGrid({ kpis }: LeaveKPIGridProps) {
  const metrics = [
    {
      label: "Total Applications",
      value: kpis.total,
      icon: CalendarCheck,
      tone: "bg-payroll-cream text-payroll-primary border border-payroll-light/80",
    },
    {
      label: "Pending",
      value: kpis.pending,
      icon: Clock,
      tone: "bg-amber-50 text-amber-700 border border-amber-200/60",
    },
    {
      label: "Approved",
      value: kpis.approved,
      icon: CheckCircle,
      tone: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    },
    {
      label: "Rejected",
      value: kpis.rejected,
      icon: XCircle,
      tone: "bg-rose-50 text-rose-700 border border-rose-200/60",
    },
    {
      label: "Cancelled",
      value: kpis.cancelled,
      icon: CalendarX,
      tone: "bg-gray-50 text-gray-700 border border-gray-200/60",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((m) => (
        <Card
          key={m.label}
          className="p-3.5 shadow-payroll-xs hover:shadow-payroll-sm transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
                {m.label}
              </p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-payroll-navy">
                {m.value}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 ${m.tone}`}>
              <m.icon className="h-4.5 w-4.5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}