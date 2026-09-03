"use client";

import { Users, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AttendanceKPIs } from "@/lib/types/attendance";

export function AttendanceKPIsGrid({ kpis }: { kpis: AttendanceKPIs }) {
  const cards = [
    {
      label: "Total Employees",
      value: kpis.totalEmployees,
      icon: Users,
      color: "text-payroll-navy",
      bg: "bg-payroll-light/60 border border-payroll-light",
    },
    {
      label: "Present Today",
      value: kpis.presentCount,
      icon: CheckCircle,
      color: "text-emerald-700",
      bg: "bg-emerald-50 border border-emerald-200/60",
    },
    {
      label: "Absent / LWOP",
      value: kpis.absentCount,
      icon: XCircle,
      color: "text-rose-700",
      bg: "bg-rose-50 border border-rose-200/60",
    },
    {
      label: "Late Arrivals",
      value: kpis.lateCount,
      icon: AlertTriangle,
      color: "text-amber-700",
      bg: "bg-amber-50 border border-amber-200/60",
    },
    {
      label: "Total OT Hours",
      value: `${kpis.totalOtHours} hrs`,
      icon: Clock,
      color: "text-payroll-primary",
      bg: "bg-payroll-cream text-payroll-primary border border-payroll-light/80",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <Card
            key={idx}
            className="flex items-center gap-3 p-3.5 shadow-payroll-xs hover:shadow-payroll-sm transition-all hover:-translate-y-0.5"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
              <Icon className={`h-4.5 w-4.5 ${c.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
                {c.label}
              </p>
              <p className="mt-0.5 text-lg font-bold text-payroll-navy tabular-nums truncate">
                {c.value}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}