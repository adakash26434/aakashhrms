"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CompanySetupSectionShellProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CompanySetupSectionShell({
  title,
  description,
  badge,
  actions,
  children,
  className,
}: CompanySetupSectionShellProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-payroll-border/80 bg-white p-6 sm:p-8 shadow-xs transition-all",
        className
      )}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-payroll-border/70">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>

      {/* Section Body */}
      <div>{children}</div>
    </div>
  );
}
