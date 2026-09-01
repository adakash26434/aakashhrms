"use client";

import { Card } from "@/components/ui/card";
import { CalendarCheck, Clock, XCircle, CheckCircle, CalendarX } from "lucide-react";
import type { LeaveKPIs } from "@/lib/types/leave";

interface LeaveKPIGridProps {
  kpis: LeaveKPIs;
}

export function LeaveKPIGrid({ kpis }: LeaveKPIGridProps) {
  const metrics = [
    { label: "Total Applications", value: kpis.total, icon: CalendarCheck, tone: "bg-green-50 text-[#2e7d32]" },
    { label: "Pending", value: kpis.pending, icon: Clock, tone: "bg-amber-50 text-amber-600" },
    { label: "Approved", value: kpis.approved, icon: CheckCircle, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Rejected", value: kpis.rejected, icon: XCircle, tone: "bg-red-50 text-red-600" },
    { label: "Cancelled", value: kpis.cancelled, icon: CalendarX, tone: "bg-gray-50 text-gray-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {metrics.map((m) => (
        <Card key={m.label} className="overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {m.label}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-[#1b3a1f]">
                {m.value}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${m.tone}`}>
              <m.icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}