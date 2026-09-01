import { Card } from "@/components/ui/card";
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
  const topRow = [
    {
      label: "Total Outstanding",
      value: kpis.totalRemaining.toLocaleString(),
      sub: `${kpis.totalActive} active loans`,
      icon: Banknote,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      borderColor: "border-l-red-500",
    },
    {
      label: "Total Disbursed",
      value: kpis.totalDisbursed.toLocaleString(),
      sub: `All-time across ${kpis.totalActive + kpis.totalClosed} loans`,
      icon: CircleDollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-l-emerald-500",
    },
    {
      label: "Monthly Recovery",
      value: kpis.monthlyEMI.toLocaleString(),
      sub: "Expected EMI per month",
      icon: Wallet,
      iconBg: "bg-green-50",
      iconColor: "text-[#2e7d32]",
      borderColor: "border-l-[#2e7d32]",
    },
  ];

  const bottomRow = [
    {
      label: "Total Recovered",
      value: kpis.totalRecovered.toLocaleString(),
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-l-emerald-500",
    },
    {
      label: "Recovery Progress",
      value: `${kpis.recoveryProgress}%`,
      icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-[#2e7d32]",
      borderColor: "border-l-[#2e7d32]",
    },
    {
      label: "Active Loans",
      value: kpis.totalActive.toString(),
      sub: kpis.totalClosed > 0 ? `${kpis.totalClosed} closed` : undefined,
      icon: FileText,
      iconBg: "bg-green-50",
      iconColor: "text-[#2e7d32]",
      borderColor: "border-l-[#2e7d32]",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topRow.map((m) => (
          <Card
            key={m.label}
            className={`overflow-hidden border-l-4 ${m.borderColor}`}
          >
            <div className="flex items-center gap-3.5 p-4">
              <div className={`shrink-0 rounded-xl p-2.5 ${m.iconBg} ${m.iconColor}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {m.label}
                </p>
                <p className="text-xl font-bold tabular-nums text-[#1b3a1f]">
                  {m.value}
                </p>
                {m.sub && (
                  <p className="text-[11px] text-gray-400">{m.sub}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bottomRow.map((m) => (
          <Card
            key={m.label}
            className={`overflow-hidden border-l-4 ${m.borderColor}`}
          >
            <div className="flex items-center gap-3.5 p-4">
              <div className={`shrink-0 rounded-xl p-2.5 ${m.iconBg} ${m.iconColor}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {m.label}
                </p>
                <p className="text-xl font-bold tabular-nums text-[#1b3a1f]">
                  {m.value}
                </p>
                {m.sub && (
                  <p className="text-[11px] text-gray-400">{m.sub}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
