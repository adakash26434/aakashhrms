"use client";

import React, { ReactNode } from "react";
import { Printer, Download, Eye, Loader2 } from "lucide-react";

interface ReportActionToolbarProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  onPrint: () => void;
  onExport: () => void;
  onPreview: () => void;
  isExporting?: boolean;
  hasData?: boolean;
  badge?: string;
  children?: ReactNode;
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
}: ReportActionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d7e8d0] pb-4 print:hidden">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-[#1b3a1f] tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="rounded-full bg-[#2e7d32]/10 border border-[#2e7d32]/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#2e7d32]">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {children}

        {/* Action Buttons with 5-State Rules & Focus Rings */}
        <button
          type="button"
          onClick={onPreview}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e7d32] bg-white px-3.5 py-2 text-xs font-bold text-[#2e7d32] shadow-payroll-sm transition-all hover:bg-[#2e7d32] hover:text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d32] focus-visible:ring-offset-2"
          title="Preview report document layout"
          aria-label="Preview report layout"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={!hasData || isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7e8d0] bg-white px-3.5 py-2 text-xs font-bold text-[#1b3a1f] shadow-payroll-sm transition-all hover:bg-[#d7e8d0]/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d32] focus-visible:ring-offset-2"
          title="Export report to CSV"
          aria-label="Export report to CSV"
          aria-busy={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 text-[#2e7d32] animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-[#2e7d32]" />
          )}
          {isExporting ? "Exporting..." : "Export"}
        </button>

        <button
          type="button"
          onClick={onPrint}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e7d32] px-4 py-2 text-xs font-bold text-white shadow-payroll-sm transition-all hover:bg-payroll-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d32] focus-visible:ring-offset-2"
          title="Print official report"
          aria-label="Print report"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>
    </div>
  );
}
