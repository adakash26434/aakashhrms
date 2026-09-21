"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2, FileSpreadsheet } from "lucide-react";

export interface ReportDataTableShellProps {
  children: ReactNode;
  title?: string;
  count?: number | string;
  summary?: ReactNode;
  toolbar?: ReactNode;
  isLoading?: boolean;
  loadingState?: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  maxHeightClass?: string;
  className?: string;
}

export function ReportDataTableShell({
  children,
  title,
  count,
  summary,
  toolbar,
  isLoading = false,
  loadingState,
  isEmpty = false,
  emptyTitle = "No report records found",
  emptyDescription = "No data is available matching the current filter selection.",
  emptyAction,
  maxHeightClass = "max-h-[min(70vh,720px)]",
  className = "",
}: ReportDataTableShellProps) {
  const hasTopHeader = Boolean(title || count !== undefined || summary);

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-payroll-light/80 bg-white shadow-payroll-xs overflow-hidden print:border-none print:shadow-none print:rounded-none",
        className
      )}
    >
      {/* Optional Top Header with Count and Summary */}
      {hasTopHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-payroll-light/60 px-5 py-3 bg-payroll-cream/50 print:hidden">
          <div className="flex items-center gap-2.5">
            {title && (
              <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                {title}
              </h4>
            )}
            {count !== undefined && (
              <span className="inline-flex items-center rounded-full bg-payroll-primary/10 border border-payroll-primary/20 px-2.5 py-0.5 text-[10px] font-extrabold text-payroll-primary">
                {count} Records
              </span>
            )}
          </div>
          {summary && (
            <div className="text-xs text-gray-500 font-medium">{summary}</div>
          )}
        </div>
      )}

      {/* Toolbar Slot */}
      {toolbar && (
        <div className="border-b border-payroll-light/60 px-5 py-2.5 bg-white print:hidden">
          {toolbar}
        </div>
      )}

      {/* Main Table / State Body */}
      {isLoading ? (
        loadingState || (
          <div className="flex h-56 flex-col items-center justify-center gap-3 p-8 text-center print:hidden">
            <Loader2 className="h-7 w-7 text-payroll-primary animate-spin" />
            <p className="text-xs font-semibold text-payroll-navy">
              Generating report data...
            </p>
            <p className="text-[11px] text-gray-400">
              Applying statutory computations and organizational filters.
            </p>
          </div>
        )
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center p-12 text-center print:hidden">
          <div className="p-3 rounded-full bg-payroll-cream border border-payroll-light mb-3">
            <FileSpreadsheet className="h-6 w-6 text-payroll-primary/70" />
          </div>
          <h5 className="text-sm font-bold text-payroll-navy">{emptyTitle}</h5>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            {emptyDescription}
          </p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div
          className={cn(
            "overflow-x-auto overflow-y-auto",
            maxHeightClass,
            "print:max-h-none print:overflow-visible"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
