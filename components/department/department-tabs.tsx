"use client";

import { Briefcase, Building2, MapPin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrgTab = "branches" | "departments" | "designations";

interface OrgTabMeta {
  id: OrgTab;
  label: string;
  count: number;
  icon: LucideIcon;
}

interface DepartmentTabsProps {
  active: OrgTab;
  departmentCount: number;
  designationCount: number;
  branchCount: number;
  onChange: (next: OrgTab) => void;
}

export function DepartmentTabs({
  active,
  departmentCount,
  designationCount,
  branchCount,
  onChange,
}: DepartmentTabsProps) {
  const tabs: OrgTabMeta[] = [
    {
      id: "branches",
      label: "Branches",
      count: branchCount,
      icon: MapPin,
    },
    {
      id: "departments",
      label: "Departments",
      count: departmentCount,
      icon: Building2,
    },
    {
      id: "designations",
      label: "Designations",
      count: designationCount,
      icon: Briefcase,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Organization structure tabs"
      className="inline-flex w-full max-w-2xl rounded-2xl border border-payroll-light/80 bg-white p-1.5 shadow-payroll-xs"
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
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold cursor-pointer transition-all",
              isActive
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-payroll-navy hover:bg-payroll-cream",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums font-mono",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-payroll-cream text-payroll-navy border border-payroll-light/60",
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
