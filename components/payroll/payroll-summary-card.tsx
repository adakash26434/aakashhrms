"use client";

import { DollarSign, Percent, PiggyBank, Users } from "lucide-react";
import type { PayrollRun } from "@/lib/types/payroll";

interface PayrollSummaryCardProps {
  run: PayrollRun;
}

export function PayrollSummaryCard({ run }: PayrollSummaryCardProps) {
  const metrics = [
    {
      title: "Net payable",
      value: `NPR ${Number(run.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      subtext: "Total disbursed take-home",
      icon: DollarSign,
      iconColor: "text-emerald-700",
    },
    {
      title: "Total gross earnings",
      value: `NPR ${Number(run.totalGross).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      subtext: "Pre-deduction payroll commitment",
      icon: PiggyBank,
      iconColor: "text-zinc-600",
    },
    {
      title: "Withholding TDS (tax)",
      value: `NPR ${Number(run.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      subtext: "Statutory tax withheld",
      icon: Percent,
      iconColor: "text-rose-500",
    },
    {
      title: "Audited employee count",
      value: `${run.employeeCount} staff`,
      subtext: "Processed in current cycle",
      icon: Users,
      iconColor: "text-zinc-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.title}
            className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500">{m.title}</p>
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
