"use client";

import { DollarSign, Percent, PiggyBank, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
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
      color: "text-emerald-700",
      bgColor: "bg-emerald-50 border border-emerald-200/60",
    },
    {
      title: "Total Gross",
      value: `Rs. ${Number(run.totalGross).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: PiggyBank,
      color: "text-payroll-primary",
      bgColor: "bg-payroll-cream border border-payroll-light/80",
    },
    {
      title: "Total TDS (Tax)",
      value: `Rs. ${Number(run.totalTds).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      icon: Percent,
      color: "text-rose-700",
      bgColor: "bg-rose-50 border border-rose-200/60",
    },
    {
      title: "Employee Count",
      value: `${run.employeeCount} Staff`,
      icon: Users,
      color: "text-amber-700",
      bgColor: "bg-amber-50 border border-amber-200/60",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <Card
          key={idx}
          className="flex items-center gap-3.5 p-4 shadow-payroll-xs hover:shadow-payroll-sm transition-all hover:-translate-y-0.5"
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.bgColor} ${card.color}`}
          >
            <card.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">
              {card.title}
            </p>
            <p className="mt-0.5 text-base sm:text-lg font-bold text-payroll-navy tabular-nums truncate">
              {card.value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
