import {
  Building2,
  CheckCircle2,
  Briefcase,
  Users,
} from "lucide-react";
import type { DepartmentCounts } from "@/lib/engines/department.engine";

interface DepartmentKpiCardsProps {
  counts: DepartmentCounts;
}

export function DepartmentKpiCards({ counts }: DepartmentKpiCardsProps) {
  const metrics = [
    {
      label: "Total departments",
      value: counts.total,
      subtext: "Organisational units",
      icon: Building2,
      iconColor: "text-zinc-400",
    },
    {
      label: "Active units",
      value: counts.active,
      subtext: "Operational departments",
      icon: CheckCircle2,
      iconColor: "text-emerald-700",
    },
    {
      label: "Total designations",
      value: counts.totalDesignations,
      subtext: "Assigned job titles",
      icon: Briefcase,
      iconColor: "text-amber-600",
    },
    {
      label: "Assigned personnel",
      value: counts.totalEmployees,
      subtext: "Active departmental staff",
      icon: Users,
      iconColor: "text-zinc-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">{m.label}</p>
                <Icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
              <div className="mt-2.5">
                <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                  {m.value}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
              {m.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
}
