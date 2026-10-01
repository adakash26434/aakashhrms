"use client";

import React from "react";
import {
  Building2,
  Clock,
  FileBadge2,
  Layers,
  CalendarDays,
  Percent,
  FileText,
  Sliders,
  Network,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CompanySetupSection =
  | "company_profile"
  | "work_schedule"
  | "employment_types"
  | "shreni"
  | "fiscal_year"
  | "tax_rates"
  | "pay_heads"
  | "system_control"
  | "payroll_rules"
  | "organization";

export interface NavItemConfig {
  id: CompanySetupSection;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  badge?: string | number | null;
}

export interface NavGroupConfig {
  groupTitle: string;
  items: NavItemConfig[];
}

interface CompanySetupInnerNavProps {
  activeSection: CompanySetupSection;
  onSelectSection: (section: CompanySetupSection) => void;
  sectionCounts?: {
    workDays?: number;
    employmentTypesCount?: number;
    shreniCount?: number;
  };
}

export function CompanySetupInnerNav({
  activeSection,
  onSelectSection,
  sectionCounts,
}: CompanySetupInnerNavProps) {
  const navGroups: NavGroupConfig[] = [
    {
      groupTitle: "General configuration",
      items: [
        {
          id: "company_profile",
          label: "Company profile",
          sublabel: "Legal identity & signatories",
          icon: Building2,
          badge: null,
        },
        {
          id: "work_schedule",
          label: "Work schedule",
          sublabel: "Hours, shifts & weekly off-days",
          icon: Clock,
          badge: sectionCounts?.workDays ? `${sectionCounts.workDays}d/wk` : null,
        },
        {
          id: "employment_types",
          label: "Employment types",
          sublabel: "Contracts & statutory eligibility",
          icon: FileBadge2,
          badge: sectionCounts?.employmentTypesCount ?? null,
        },
        {
          id: "shreni",
          label: "Shreni grades",
          sublabel: "Hierarchy & career progression",
          icon: Layers,
          badge: sectionCounts?.shreniCount ?? null,
        },
      ],
    },
    {
      groupTitle: "Payroll & statutory rules",
      items: [
        {
          id: "fiscal_year",
          label: "Fiscal year cycles",
          sublabel: "Bikram Sambat calendar periods",
          icon: CalendarDays,
          badge: null,
        },
        {
          id: "tax_rates",
          label: "Tax Rates",
          sublabel: "Individual & couple slabs",
          icon: Percent,
          badge: null,
        },
        {
          id: "pay_heads",
          label: "Salary pay heads",
          sublabel: "Allowances & deduction master",
          icon: FileText,
          badge: null,
        },
        {
          id: "system_control",
          label: "Rules & controls",
          sublabel: "Statutory thresholds & calculation engine",
          icon: Sliders,
          badge: null,
        },
      ],
    },
    {
      groupTitle: "Organization structure",
      items: [
        {
          id: "organization",
          label: "Organization units",
          sublabel: "Branches, departments & designations",
          icon: Network,
          badge: null,
        },
      ],
    },
  ];

  const allItems = navGroups.flatMap((g) => g.items);

  // Normalize active section for legacy aliases
  const effectiveActiveSection: CompanySetupSection =
    activeSection === "payroll_rules" ? "fiscal_year" : activeSection;

  return (
    <div className="w-full">
      {/* Mobile Horizontal Bar (< lg) */}
      <div className="lg:hidden mb-4 overflow-x-auto pb-1 scrollbar-none">
        <div className="inline-flex gap-1.5 p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 min-w-full sm:min-w-0">
          {allItems.map((item) => {
            const isActive = effectiveActiveSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer select-none",
                  isActive
                    ? "bg-payroll-primary text-white font-semibold shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-white"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white/80" : "text-zinc-400")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Vertical Navigation Spine (lg+) */}
      <nav
        aria-label="Company setup sections"
        className="hidden lg:block rounded-xl border border-zinc-200/90 bg-white p-3 sticky top-20 shadow-xs"
      >
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <h3 className="px-2.5 text-xs font-semibold text-zinc-400 mb-1.5 tracking-normal">
                {group.groupTitle}
              </h3>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = effectiveActiveSection === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectSection(item.id)}
                      className={cn(
                        "group flex w-full items-start justify-between rounded-lg px-3 py-2 text-left transition-colors cursor-pointer select-none border-l-2",
                        isActive
                          ? "border-payroll-primary bg-payroll-primary-light text-payroll-primary font-semibold"
                          : "border-transparent text-zinc-600 hover:bg-payroll-primary-light hover:text-payroll-primary"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 pr-2">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 mt-0.5 transition-colors",
                            isActive ? "text-payroll-primary" : "text-zinc-400 group-hover:text-payroll-primary"
                          )}
                        />
                        <div className="min-w-0">
                          <div className="text-xs leading-snug truncate">
                            {item.label}
                          </div>
                          <div className={cn(
                            "text-[11px] leading-tight truncate mt-0.5",
                            isActive ? "text-payroll-primary/70" : "text-zinc-400 group-hover:text-payroll-primary/70"
                          )}>
                            {item.sublabel}
                          </div>
                        </div>
                      </div>

                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium",
                            isActive
                              ? "bg-payroll-primary/15 text-payroll-primary"
                              : "bg-zinc-100 text-zinc-500"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
