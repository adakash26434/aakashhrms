"use client";

import { UserCheck, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayrollStickyActionBarProps {
  matchedCount: number;
  selectedCount: number;
  isLoading: boolean;
  onGenerate: () => void;
  disabled?: boolean;
}

export function PayrollStickyActionBar({
  matchedCount,
  selectedCount,
  isLoading,
  onGenerate,
  disabled = false,
}: PayrollStickyActionBarProps) {
  const isReady = selectedCount > 0 && !disabled;

  return (
    <div className="sticky bottom-4 z-30 mx-auto w-full transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-payroll-primary/20 bg-white/95 px-5 py-3.5 shadow-xl backdrop-blur-md">
        {/* Left: Summary Metrics & Status */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
              isReady
                ? "bg-payroll-primary/10 text-payroll-primary"
                : "bg-red-100 text-red-600"
            )}
          >
            {isReady ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-payroll-navy">
                Batch Scope:
              </span>
              <span className="font-mono text-xs font-bold text-payroll-primary">
                {selectedCount} of {matchedCount} staff selected
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {isReady
                ? "All inputs and scope verified. Click generate to compute draft slips."
                : "Select at least 1 employee to enable draft calculation."}
            </p>
          </div>
        </div>

        {/* Right: Primary Action Button */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={!isReady || isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-payroll-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-payroll-sm transition-all hover:bg-payroll-navy hover:shadow-payroll-md disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Calculating Draft Slips...
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              Generate & Save Draft Slips
            </>
          )}
        </button>
      </div>
    </div>
  );
}
