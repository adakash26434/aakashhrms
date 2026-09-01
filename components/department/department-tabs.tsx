"use client";

import { Briefcase, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrgTab = "departments" | "designations" | "branches";

interface OrgTabMeta {
  id: OrgTab;
  label: string;
  count: number;
  icon: typeof Building2;
}

interface DepartmentTabsProps {
  active: OrgTab;
  departmentCount: number;
  designationCount: number;
  branchCount: number;
  onChange: (next: OrgTab) => void;
}

/**
 * Three-way segmented control for the Organization Structure
 * page: Departments · Designations · Branches.
 *
 * The "Departments" tab shows the department table.
 * The "Designations" tab shows the designation table inline.
 * The "Branches" tab is a placeholder.
 */
export function DepartmentTabs({
  active,
  departmentCount,
  designationCount,
  branchCount,
  onChange,
}: DepartmentTabsProps) {
  const tabs: OrgTabMeta[] = [
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
    {
      id: "branches",
      label: "Branches",
      count: branchCount,
      icon: Users,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Organization structure"
      className="inline-flex w-full max-w-2xl rounded-xl border border-[#d7e8d0]/80 bg-white p-1"
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
                ? "bg-[#2e7d32] text-white shadow-sm"
                : "text-[#1b3a1f] hover:bg-[#f6faf6]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[#d7e8d0]/60 text-[#1b3a1f]",
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
