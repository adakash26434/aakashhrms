"use client";

import { DollarSign, Percent, PiggyBank, Users } from "lucide-react";
import type { PayrollRun } from "@/lib/types/payroll";

interface PayrollSummaryCardProps {
  run: PayrollRun;
}

export function PayrollSummaryCard({ run }: PayrollSummaryCardProps) {
  const cards = [
    {
      title: "Net Payable",
      value: `Rs. ${Number(run.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Total Gross",
      value: `Rs. ${Number(run.totalGross).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: PiggyBank,
      color: "text-[#2e7d32]",
      bgColor: "bg-[#d7e8d0]/30",
    },
    {
      title: "Total TDS (Tax)",
      value: `Rs. ${Number(run.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: Percent,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Employee Count",
      value: `${run.employeeCount} Staff`,
      icon: Users,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card, idx) => (
        <div key={idx} className="flex items-center gap-4 rounded-xl border border-[#d7e8d0] bg-white p-5 shadow-sm">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.bgColor} ${card.color}`}>
            <card.icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.title}</p>
            <p className="mt-1 text-lg font-bold text-[#1b3a1f] tabular-nums">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
