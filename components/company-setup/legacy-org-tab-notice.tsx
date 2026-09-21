"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowLeft, Building2 } from "lucide-react";

interface LegacyOrgTabNoticeProps {
  entityType: "branches" | "departments" | "designations";
  onBackToCompanySetup: () => void;
}

export function LegacyOrgTabNotice({
  entityType,
  onBackToCompanySetup,
}: LegacyOrgTabNoticeProps) {
  const entityLabels: Record<string, { title: string; desc: string }> = {
    branches: {
      title: "Branches & Locations",
      desc: "Physical branch registries and regional offices",
    },
    departments: {
      title: "Departments",
      desc: "Organizational departments, branch assignments, and reporting units",
    },
    designations: {
      title: "Designations",
      desc: "Job titles and organizational hierarchy positions",
    },
  };

  const current = entityLabels[entityType] || {
    title: "Organization Structure",
    desc: "Branches, departments, and designations",
  };

  return (
    <div className="rounded-xl border border-payroll-primary/20 bg-payroll-cream/70 p-4 text-xs shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-payroll-primary/10 text-payroll-primary mt-0.5">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-payroll-navy">
              Notice: {current.title} Management Has Moved
            </p>
            <p className="text-gray-600 mt-0.5">
              To reduce duplicate menus, organizational entities ({current.desc}) are now centralized in the unified{" "}
              <strong className="text-payroll-navy">Organization Hub</strong> under Workforce.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackToCompanySetup}
            className="inline-flex items-center gap-1 rounded-lg border border-payroll-light bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Company Profile</span>
          </button>
          <Link
            href={`/workforce/organization?tab=${entityType}`}
            className="inline-flex items-center gap-1 rounded-lg bg-payroll-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-payroll-navy shadow-xs transition-colors"
          >
            <span>Open in Organization Hub</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
