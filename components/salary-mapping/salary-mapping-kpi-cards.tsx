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
  const cards = [
    {
      label: "Total Mappings",
      value: kpis.totalMappings.toString(),
      icon: Users,
      tone: "bg-green-50 text-[#2e7d32]",
    },
    {
      label: "Average Basic",
      value: formatNPR(kpis.averageBasic),
      icon: Banknote,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Total Payroll",
      value: formatNPR(kpis.totalPayroll),
      icon: DollarSign,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Unmapped Employees",
      value: kpis.unmappedCount.toString(),
      icon: UserMinus,
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-[#d7e8d0]/80 bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {card.label}
                </p>
                <p className="mt-0.5 text-xl font-semibold text-[#1b3a1f] tabular-nums">
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}