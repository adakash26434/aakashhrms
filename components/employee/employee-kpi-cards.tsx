import { Card } from "@/components/ui/card";
import { Users, CheckCircle2, CalendarDays, UserX, Building2 } from "lucide-react";
import type { EmployeeKPIs } from "@/lib/types/employee";

export function EmployeeKPIsGrid({ kpis }: { kpis: EmployeeKPIs }) {
  const metrics = [
    { label: "All Employees", value: kpis.total, icon: Users, tone: "bg-green-50 text-[#2e7d32]" },
    { label: "Active", value: kpis.active, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
    { label: "On Leave", value: kpis.onLeave, icon: CalendarDays, tone: "bg-amber-50 text-amber-600" },
    { label: "Terminated", value: kpis.terminated, icon: UserX, tone: "bg-red-50 text-red-600" },
    { label: "Departments", value: kpis.departmentsCount, icon: Building2, tone: "bg-violet-50 text-violet-600" },
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
