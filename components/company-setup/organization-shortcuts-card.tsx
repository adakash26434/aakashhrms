"use client";

import Link from "next/link";
import { Building2, Users, Briefcase } from "lucide-react";
import type { Branch } from "@/lib/types/branch";
import type { Department } from "@/lib/types/department";
import type { Designation } from "@/lib/types/designation";

interface OrganizationShortcutsCardProps {
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
}

export function OrganizationShortcutsCard({
  branches,
  departments,
  designations,
}: OrganizationShortcutsCardProps) {
  const units = [
    {
      id: "branches",
      title: "Branches & office locations",
      description: "Regional office networks, physical facilities, and head office designation.",
      count: branches.length,
      countLabel: branches.length === 1 ? "branch" : "branches",
      href: "/workforce/organization?tab=branches",
      actionText: "Manage branch registry",
      icon: Building2,
    },
    {
      id: "departments",
      title: "Departments & functional units",
      description: "Organizational business divisions, unit groupings, and managerial cost centers.",
      count: departments.length,
      countLabel: departments.length === 1 ? "department" : "departments",
      href: "/workforce/organization?tab=departments",
      actionText: "Manage department structure",
      icon: Users,
    },
    {
      id: "designations",
      title: "Job designations & roles",
      description: "Standard job titles, organizational tiers, and cross-departmental roles.",
      count: designations.length,
      countLabel: designations.length === 1 ? "designation" : "designations",
      href: "/workforce/organization?tab=designations",
      actionText: "Manage job titles",
      icon: Briefcase,
    },
  ];

  return (
    <div className="space-y-8 animate-[fadeIn_150ms_ease-out]">
      {/* Top Header */}
      <div className="pb-5 border-b border-slate-200/80">
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
          Organization units
        </h2>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
          Physical locations, functional business units, and standard roles configured across the organization.
        </p>
      </div>

      {/* Institutional Guidance Note */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-900 mb-0.5">
          Workforce structural management
        </p>
        <p>
          Day-to-day assignments of employees to branches, departments, and designations are administered under{" "}
          <Link
            href="/workforce/organization"
            className="font-medium text-emerald-800 hover:text-emerald-950 underline underline-offset-2"
          >
            Workforce organization
          </Link>
          . Company setup maintains top-level legal identity, work schedules, and compensation policies.
        </p>
      </div>

      {/* Directory List */}
      <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
        {units.map((unit) => {
          const Icon = unit.icon;
          return (
            <div
              key={unit.id}
              className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <Icon className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {unit.title}
                    </h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-700">
                      {unit.count} {unit.countLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    {unit.description}
                  </p>
                </div>
              </div>

              <Link
                href={unit.href}
                className="self-start sm:self-center shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                {unit.actionText}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
