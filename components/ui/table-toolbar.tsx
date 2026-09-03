"use client";

import React, { ReactNode } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filterSlot?: ReactNode;
  actionsSlot?: ReactNode;
  className?: string;
  totalCount?: number;
  filteredCount?: number;
}

export function TableToolbar({
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterSlot,
  actionsSlot,
  className,
  totalCount,
  filteredCount,
}: TableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1",
        className,
      )}
    >
      {/* Search Input & Quick Filter Controls */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
        {onSearchChange && (
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-payroll-navy/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-payroll-light bg-white py-1.5 pl-9 pr-8 text-xs text-payroll-navy placeholder:text-gray-400 shadow-payroll-xs transition-all focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-payroll-navy cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {filterSlot && (
          <div className="flex flex-wrap items-center gap-1.5">{filterSlot}</div>
        )}

        {typeof totalCount === "number" && (
          <div className="hidden lg:inline-flex items-center text-[11px] font-medium text-gray-500 bg-payroll-cream px-2 py-1 rounded-lg border border-payroll-light/60">
            {typeof filteredCount === "number" && filteredCount !== totalCount
              ? `Showing ${filteredCount} of ${totalCount}`
              : `Total ${totalCount}`}
          </div>
        )}
      </div>

      {/* Action Buttons Slot */}
      {actionsSlot && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actionsSlot}
        </div>
      )}
    </div>
  );
}
