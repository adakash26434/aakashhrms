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
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 mt-0.5 border border-emerald-200/60">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {current.title} management has moved
            </p>
            <p className="text-slate-600 mt-0.5">
              Organizational entities ({current.desc.toLowerCase()}) are centralized under Workforce Organization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackToCompanySetup}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
            <span>Company profile</span>
          </button>
          <Link
            href={`/workforce/organization?tab=${entityType}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-900 shadow-xs transition-colors"
          >
            <span>Open in organization</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
