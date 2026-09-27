import {
  Banknote,
  CircleDollarSign,
  Wallet,
  CheckCircle2,
  TrendingUp,
  FileText,
} from "lucide-react";
import type { LoanKPIs } from "@/lib/types/loan";

interface LoanKPICardsProps {
  kpis: LoanKPIs;
}

export function LoanKPICards({ kpis }: LoanKPICardsProps) {
  const topMetrics = [
    {
      label: "Total outstanding principal",
      value: `NPR ${kpis.totalRemaining.toLocaleString()}`,
      subtext: `${kpis.totalActive} active loan facilities`,
      icon: Banknote,
      iconColor: "text-rose-600",
    },
    {
      label: "Total disbursed principal",
      value: `NPR ${kpis.totalDisbursed.toLocaleString()}`,
      subtext: `Cumulative across ${kpis.totalActive + kpis.totalClosed} loans`,
      icon: CircleDollarSign,
      iconColor: "text-emerald-700",
    },
    {
      label: "Monthly EMI recovery",
      value: `NPR ${kpis.monthlyEMI.toLocaleString()}`,
      subtext: "Scheduled monthly deduction",
      icon: Wallet,
      iconColor: "text-zinc-600",
    },
  ];

  const bottomMetrics = [
    {
      label: "Total recovered principal",
      value: `NPR ${kpis.totalRecovered.toLocaleString()}`,
      subtext: "Reimbursed to date",
      icon: CheckCircle2,
      iconColor: "text-emerald-700",
    },
    {
      label: "Recovery progress",
      value: `${kpis.recoveryProgress}%`,
      subtext: "Repayment fulfillment rate",
      icon: TrendingUp,
      iconColor: "text-emerald-700",
    },
    {
      label: "Active loan accounts",
      value: kpis.totalActive.toString(),
      subtext: kpis.totalClosed > 0 ? `${kpis.totalClosed} closed loans` : "No closed loans",
      icon: FileText,
      iconColor: "text-zinc-400",
    },
  ];

  return (
    <div className="space-y-4 py-2">
      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 pb-3 border-b border-zinc-300/60">
        {topMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="group flex flex-col justify-between py-2 px-4 sm:first:pl-0 sm:last:pr-0"
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

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        {bottomMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="group flex flex-col justify-between py-2 px-4 sm:first:pl-0 sm:last:pr-0"
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
    </div>
  );
}
