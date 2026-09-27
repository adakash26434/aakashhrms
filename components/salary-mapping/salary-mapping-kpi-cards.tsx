"use client";

import { Banknote, Users, DollarSign, UserMinus } from "lucide-react";
import type { SalaryMappingKPIs } from "@/lib/types/salary-mapping";

interface SalaryMappingKPIsGridProps {
  kpis: SalaryMappingKPIs;
}

function formatNPR(value: number): string {
  return `NPR ${value.toLocaleString("en-IN")}`;
}

export function SalaryMappingKPIsGrid({ kpis }: SalaryMappingKPIsGridProps) {
  const metrics = [
    {
      label: "Total mappings",
      value: kpis.totalMappings.toString(),
      subtext: "Configured salary structures",
      icon: Users,
      iconColor: "text-zinc-400",
    },
    {
      label: "Average basic",
      value: formatNPR(kpis.averageBasic),
      subtext: "Base rate per mapped employee",
      icon: Banknote,
      iconColor: "text-emerald-700",
    },
    {
      label: "Total payroll commitment",
      value: formatNPR(kpis.totalPayroll),
      subtext: "Estimated monthly liability",
      icon: DollarSign,
      iconColor: "text-zinc-600",
    },
    {
      label: "Unmapped employees",
      value: kpis.unmappedCount.toString(),
      subtext: "Awaiting salary profile assignment",
      icon: UserMinus,
      iconColor: kpis.unmappedCount > 0 ? "text-amber-500" : "text-zinc-400",
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
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
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