import { Card } from "@/components/ui/card";
import { Users, CheckCircle2, CalendarDays, AlertCircle } from "lucide-react";
import type { EmployeeKPIs } from "@/lib/types/employee";

interface EmployeeKPIsGridProps {
  kpis: EmployeeKPIs;
  incompleteCount?: number;
}

export function EmployeeKPIsGrid({ kpis, incompleteCount }: EmployeeKPIsGridProps) {
  const incompleteValue =
    typeof incompleteCount === "number"
      ? incompleteCount
      : (kpis.terminated ?? 0) + (kpis.inactive ?? 0) > 0
      ? (kpis.terminated ?? 0) + (kpis.inactive ?? 0)
      : Math.max(0, kpis.total - kpis.active - (kpis.onLeave ?? 0));

  const items = [
    {
      value: kpis.total,
      label: "Total Employees",
      subtext: "across all branches",
      icon: Users,
      iconColor: "text-gray-400 group-hover:text-payroll-primary",
    },
    {
      value: kpis.active,
      label: "Active",
      subtext: "currently working",
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
    },
    {
      value: kpis.onLeave ?? 0,
      label: "On Leave",
      subtext: "approved leaves",
      icon: CalendarDays,
      iconColor: "text-amber-500",
    },
    {
      value: incompleteValue,
      label: "Incomplete Profiles",
      subtext: "need attention",
      icon: AlertCircle,
      iconColor: "text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="group relative flex flex-col justify-between p-4.5 bg-white border-payroll-border hover:border-payroll-border/80 transition-all rounded-xl shadow-payroll-xs"
          >
            <div>
              <div className="flex items-start justify-between">
                <p className="text-[13px] font-medium text-gray-500">
                  {item.label}
                </p>
                <Icon className={`h-4 w-4 transition-colors ${item.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-gray-950 font-sans">
                  {item.value}
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
              {item.subtext}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
