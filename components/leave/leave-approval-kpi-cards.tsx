"use client";

import { Card } from "@/components/ui/card";
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
      label: "Pending Approvals",
      value: kpis.totalPending,
      icon: Clock,
      tone: "bg-amber-50 text-amber-700 border border-amber-200/60",
    },
    {
      label: "Approved Today",
      value: kpis.approvedToday,
      icon: CheckCircle,
      tone: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    },
    {
      label: "Rejected Today",
      value: kpis.rejectedToday,
      icon: XCircle,
      tone: "bg-rose-50 text-rose-700 border border-rose-200/60",
    },
    {
      label: "Awaiting My Review",
      value: kpis.awaitingMyReview,
      icon: Users,
      tone: "bg-payroll-cream text-payroll-primary border border-payroll-light/80",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card
          key={m.label}
          className="p-3.5 shadow-payroll-xs hover:shadow-payroll-sm transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
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