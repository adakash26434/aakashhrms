import { Card } from "@/components/ui/card";
import { Users, CheckCircle2, CalendarDays, UserX, Building2 } from "lucide-react";
import type { EmployeeKPIs } from "@/lib/types/employee";

export function EmployeeKPIsGrid({ kpis }: { kpis: EmployeeKPIs }) {
  const metrics = [
    {
      label: "All Employees",
      value: kpis.total,
      icon: Users,
      tone: "bg-payroll-cream text-payroll-primary border border-payroll-light/80",
    },
    {
      label: "Active",
      value: kpis.active,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    },
    {
      label: "On Leave",
      value: kpis.onLeave,
      icon: CalendarDays,
      tone: "bg-amber-50 text-amber-700 border border-amber-200/60",
    },
    {
      label: "Terminated",
      value: kpis.terminated,
      icon: UserX,
      tone: "bg-rose-50 text-rose-700 border border-rose-200/60",
    },
    {
      label: "Departments",
      value: kpis.departmentsCount,
      icon: Building2,
      tone: "bg-payroll-light/60 text-payroll-navy border border-payroll-light",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {metrics.map((m) => (
        <Card
          key={m.label}
          className="overflow-hidden p-3.5 transition-all duration-200 hover:-translate-y-0.5 shadow-payroll-xs hover:shadow-payroll-sm"
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
