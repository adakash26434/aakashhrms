"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface AppliedFiltersRowProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: ActiveFilter[];
  onClearAll?: () => void;
}

export function AppliedFiltersRow({
  filters,
  onClearAll,
  className,
  ...props
}: AppliedFiltersRowProps) {
  if (filters.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5 py-1 text-xs", className)}
      {...props}
    >
      <span className="text-[11px] font-medium text-gray-400 mr-1">
        Applied filters:
      </span>
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex items-center gap-1 rounded-lg border border-payroll-light/80 bg-payroll-cream px-2 py-0.5 text-xs text-payroll-navy font-medium shadow-2xs"
        >
          <span className="text-gray-500 font-normal">{filter.label}:</span>
          <span className="font-semibold">{filter.value}</span>
          <button
            type="button"
            onClick={filter.onRemove}
            className="ml-0.5 rounded p-0.5 text-gray-400 hover:bg-payroll-light hover:text-payroll-navy transition-colors cursor-pointer"
            aria-label={`Remove filter for ${filter.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-[11px] font-semibold text-payroll-primary hover:underline cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
