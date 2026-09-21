"use client";

import React, { ReactNode } from "react";
import { Printer, Download, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportActionToolbarProps {
  title?: string;
  subtitle?: string;
  meta?: ReactNode;
  onPrint: () => void;
  onExport: () => void;
  onPreview: () => void;
  isExporting?: boolean;
  hasData?: boolean;
  badge?: string;
  children?: ReactNode;
  className?: string;
}

export function ReportActionToolbar({
  title,
  subtitle,
  meta,
  onPrint,
  onExport,
  onPreview,
  isExporting = false,
  hasData = true,
  badge,
  children,
  className,
}: ReportActionToolbarProps) {
  const hasLeftContent = Boolean(title || subtitle || meta || children);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-payroll-light/80 pb-4 print:hidden",
        className
      )}
    >
      {/* Left side: Context, Sub-tabs, Summary Badges */}
      {hasLeftContent ? (
        <div className="flex flex-wrap items-center gap-3">
          {children}

          {(title || subtitle || badge || meta) && (
            <div className="space-y-0.5">
              {(title || badge) && (
                <div className="flex items-center gap-2">
                  {title && (
                    <h3 className="text-sm font-bold text-payroll-navy tracking-tight">
                      {title}
                    </h3>
                  )}
                  {badge && (
                    <span className="rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-payroll-primary">
                      {badge}
                    </span>
                  )}
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500">{subtitle}</p>
              )}
              {meta && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {meta}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div />
      )}

      {/* Right side: Unified Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 ml-auto">
        {/* Preview Button */}
        <button
          type="button"
          onClick={onPreview}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-primary bg-white px-3.5 py-2 text-xs font-bold text-payroll-primary shadow-payroll-xs transition-all hover:bg-payroll-primary hover:text-white active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary focus-visible:ring-offset-2"
          title="Preview report document layout"
          aria-label="Preview report layout"
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
        </button>

        {/* Export CSV Button */}
        <button
          type="button"
          onClick={onExport}
          disabled={!hasData || isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-3.5 py-2 text-xs font-bold text-payroll-navy shadow-payroll-xs transition-all hover:bg-payroll-light/40 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary focus-visible:ring-offset-2"
          title="Export report to CSV"
          aria-label="Export report to CSV"
          aria-busy={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 text-payroll-primary animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-payroll-primary" />
          )}
          <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
        </button>

        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-lg bg-payroll-primary px-4 py-2 text-xs font-bold text-white shadow-payroll-sm transition-all hover:bg-payroll-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-payroll-primary focus-visible:ring-offset-2"
          title="Print official report"
          aria-label="Print report"
        >
          <Printer className="h-4 w-4" />
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
