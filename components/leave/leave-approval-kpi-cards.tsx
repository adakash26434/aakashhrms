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
    { label: "Pending Approvals", value: kpis.totalPending, icon: Clock, tone: "bg-amber-50 text-amber-600" },
    { label: "Approved Today", value: kpis.approvedToday, icon: CheckCircle, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Rejected Today", value: kpis.rejectedToday, icon: XCircle, tone: "bg-red-50 text-red-600" },
    { label: "Awaiting My Review", value: kpis.awaitingMyReview, icon: Users, tone: "bg-green-50 text-[#2e7d32]" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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