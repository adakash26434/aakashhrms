"use client";

import { Users, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import type { AttendanceKPIs } from "@/lib/types/attendance";

export function AttendanceKPIsGrid({ kpis }: { kpis: AttendanceKPIs }) {
  const cards = [
    { label: "Total Employees", value: kpis.totalEmployees, icon: Users, color: "text-[#1b3a1f]", bg: "bg-[#d7e8d0]/30" },
    { label: "Present Today", value: kpis.presentCount, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Absent / LWOP", value: kpis.absentCount, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Late Arrivals", value: kpis.lateCount, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total OT Hours", value: `${kpis.totalOtHours} hrs`, icon: Clock, color: "text-[#2e7d32]", bg: "bg-[#2e7d32]/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <div key={idx} className="flex items-center gap-3 rounded-xl border border-[#d7e8d0] bg-white p-4 shadow-sm">
            <div className={`rounded-lg p-2.5 ${c.bg}`}>
              <Icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{c.label}</p>
              <p className="mt-0.5 text-lg font-bold text-[#1b3a1f]">{c.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}