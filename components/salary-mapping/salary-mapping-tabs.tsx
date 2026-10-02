"use client";

import { DollarSign, Users, CreditCard, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SalaryMappingTab = "all" | "allowances" | "with-loans" | "unmapped";

interface SalaryMappingTabMeta {
  id: SalaryMappingTab;
  label: string;
  count: number;
  icon: typeof DollarSign;
}

interface SalaryMappingTabsProps {
  active: SalaryMappingTab;
  allCount: number;
  allowancesCount: number;
  withLoansCount: number;
  unmappedCount: number;
  onChange: (next: SalaryMappingTab) => void;
}

export function SalaryMappingTabs({
  active,
  allCount,
  allowancesCount,
  withLoansCount,
  unmappedCount,
  onChange,
}: SalaryMappingTabsProps) {
  const tabs: SalaryMappingTabMeta[] = [
    {
      id: "all",
      label: "All Mappings",
      count: allCount,
      icon: DollarSign,
    },
    {
      id: "allowances",
      label: "With Allowances",
      count: allowancesCount,
      icon: Users,
    },
    {
      id: "with-loans",
      label: "With Loans",
      count: withLoansCount,
      icon: CreditCard,
    },
    {
      id: "unmapped",
      label: "Unmapped",
      count: unmappedCount,
      icon: UserMinus,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Salary mapping views"
      className="inline-flex w-full max-w-3xl rounded-xl border border-payroll-border bg-white p-1"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors",
              isActive
                ? "bg-payroll-primary text-white shadow-sm"
                : "text-payroll-navy hover:bg-payroll-cream",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-payroll-primary-light-2 text-payroll-primary",
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}