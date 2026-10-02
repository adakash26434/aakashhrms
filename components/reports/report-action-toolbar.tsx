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
        "flex flex-wrap items-center justify-between gap-4 border-b border-zinc-300/80 pb-4 print:hidden",
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
                    <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                      {title}
                    </h3>
                  )}
                  {badge && (
                    <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-2xs font-medium text-zinc-600">
                      {badge}
                    </span>
                  )}
                </div>
              )}
              {subtitle && (
                <p className="text-xs text-zinc-500">{subtitle}</p>
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
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        {/* Preview Button */}
        <button
          type="button"
          onClick={onPreview}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs transition-colors hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
          title="Preview report document layout"
          aria-label="Preview report layout"
        >
          <Eye className="h-3.5 w-3.5 text-zinc-500" />
          <span>Preview</span>
        </button>

        {/* Export CSV Button */}
        <button
          type="button"
          onClick={onExport}
          disabled={!hasData || isExporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs transition-colors hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
          title="Export report to CSV"
          aria-label="Export report to CSV"
          aria-busy={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 text-zinc-500 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
        </button>

        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-md bg-payroll-primary hover:bg-payroll-primary-hover px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-payroll-primary/10 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
          title="Print official report"
          aria-label="Print report"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
