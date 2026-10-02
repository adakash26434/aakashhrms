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
        "flex flex-col w-full bg-transparent print:border-none print:shadow-none print:rounded-none",
        className
      )}
    >
      {/* Optional Top Header with Count and Summary */}
      {hasTopHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-300/80 pb-3 mb-2 print:hidden">
          <div className="flex items-center gap-2.5">
            {title && (
              <h4 className="text-sm font-semibold tracking-tight text-zinc-900">
                {title}
              </h4>
            )}
            {count !== undefined && (
              <span className="inline-flex items-center rounded border border-emerald-200/50 bg-emerald-50/70 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {count} Records
              </span>
            )}
          </div>
          {summary && (
            <div className="text-xs text-zinc-500 font-normal">{summary}</div>
          )}
        </div>
      )}

      {/* Toolbar Slot */}
      {toolbar && (
        <div className="py-2.5 print:hidden">
          {toolbar}
        </div>
      )}

      {/* Main Table / State Body */}
      {isLoading ? (
        loadingState || (
          <div className="flex h-56 flex-col items-center justify-center gap-3 p-8 text-center print:hidden">
            <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
            <p className="text-xs font-medium text-zinc-800">
              Generating report data...
            </p>
            <p className="text-2xs text-zinc-400">
              Applying statutory computations and organizational filters.
            </p>
          </div>
        )
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center p-12 text-center print:hidden">
          <div className="p-3 rounded-full bg-zinc-50 border border-zinc-200 mb-3">
            <FileSpreadsheet className="h-6 w-6 text-zinc-400" />
          </div>
          <h5 className="text-sm font-semibold text-zinc-900">{emptyTitle}</h5>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
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
