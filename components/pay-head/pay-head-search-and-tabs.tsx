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
  /** "Showing X of Y pay heads" caption (right-aligned). */
  totalCount: number;
  filteredCount: number;
}

/**
 * Search input + type filter (All / Allowance / Deduction) +
 * "X of Y pay heads" count caption. One row, responsive
 * (search stacks above the tabs on small screens).
 */
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
      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or code..."
          className="h-9 w-full rounded-lg border border-payroll-light bg-white py-2 pl-9 pr-3 text-xs text-payroll-navy placeholder:text-gray-400 focus:border-payroll-primary focus:outline-none shadow-2xs"
        />
      </div>

      {/* Right side: tabs + count */}
      <div className="flex items-center gap-3">
        <div
          role="tablist"
          aria-label="Filter by type"
          className="inline-flex gap-1 rounded-lg border border-payroll-light bg-white p-1 shadow-2xs"
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
                  "inline-flex items-center gap-2 rounded-md px-3.5 py-1 text-xs font-semibold cursor-pointer transition-colors",
                  isActive
                    ? "bg-payroll-primary text-white shadow-xs"
                    : "text-gray-600 hover:bg-payroll-cream/50 hover:text-payroll-navy",
                )}
              >
                {formatTypeFilter(f)}
              </button>
            );
          })}
        </div>
        <p className="hidden text-xs text-gray-500 sm:block tabular-nums">
          Showing{" "}
          <span className="font-semibold text-payroll-navy">{filteredCount}</span>{" "}
          of <span className="font-semibold text-payroll-navy">{totalCount}</span>{" "}
          pay heads
        </p>
      </div>
    </div>
  );
}
