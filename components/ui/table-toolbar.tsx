"use client";

import React, { ReactNode } from "react";
import { Search, X } from "lucide-react";
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
  const isFiltered =
    typeof filteredCount === "number" &&
    typeof totalCount === "number" &&
    filteredCount !== totalCount;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2",
        className,
      )}
    >
      {/* Search Input & Quick Filter Controls */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {onSearchChange && (
          <div className="relative w-full sm:w-64 md:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 transition-all focus:bg-white focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter Chips */}
        {filterSlot && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filterSlot}
          </div>
        )}

        {/* Record count — expressed as plain type, not a boxed badge */}
        {typeof totalCount === "number" && (
          <span className="hidden lg:inline text-2xs text-zinc-400 tabular-nums ml-1">
            {isFiltered
              ? `${filteredCount} of ${totalCount}`
              : `${totalCount} records`}
          </span>
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
