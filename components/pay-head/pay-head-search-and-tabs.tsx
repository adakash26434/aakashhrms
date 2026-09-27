"use client";

import { Search } from "lucide-react";
import {
  TYPE_FILTERS,
  formatTypeFilter,
  type TypeFilter,
} from "@/lib/types/pay-head";
import { cn } from "@/lib/utils";

interface PayHeadSearchAndTabsProps {
  search: string;
  onSearchChange: (next: string) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (next: TypeFilter) => void;
  /** "Showing X of Y pay heads" caption. */
  totalCount: number;
  filteredCount: number;
}

export function PayHeadSearchAndTabs({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  totalCount,
  filteredCount,
}: PayHeadSearchAndTabsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search input */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or code..."
          className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800 focus:outline-none shadow-xs"
        />
      </div>

      {/* Right side: filter tabs + count */}
      <div className="flex items-center gap-3">
        <div
          role="tablist"
          aria-label="Filter by type"
          className="inline-flex gap-1 rounded-lg border border-slate-200/80 bg-slate-100/70 p-1 shadow-xs"
        >
          {TYPE_FILTERS.map((f) => {
            const isActive = f === typeFilter;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTypeFilterChange(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs cursor-pointer transition-all select-none",
                  isActive
                    ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium",
                )}
              >
                {formatTypeFilter(f)}
              </button>
            );
          })}
        </div>
        <p className="hidden text-xs text-slate-500 sm:block tabular-nums">
          Showing{" "}
          <span className="font-semibold text-slate-900">{filteredCount}</span>{" "}
          of <span className="font-semibold text-slate-900">{totalCount}</span>{" "}
          heads
        </p>
      </div>
    </div>
  );
}
