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
      label: "Total employees",
      subtext: "Across all branches",
      icon: Users,
      iconColor: "text-zinc-400 group-hover:text-zinc-600",
    },
    {
      value: kpis.active,
      label: "Active personnel",
      subtext: "Currently operational",
      icon: CheckCircle2,
      iconColor: "text-emerald-700",
    },
    {
      value: kpis.onLeave ?? 0,
      label: "On leave",
      subtext: "Approved leave requests",
      icon: CalendarDays,
      iconColor: "text-amber-600",
    },
    {
      value: incompleteValue,
      label: "Incomplete profiles",
      subtext: "Action required",
      icon: AlertCircle,
      iconColor: "text-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">
                  {item.label}
                </p>
                <Icon className={`h-4 w-4 transition-colors ${item.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {item.value}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {item.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}
