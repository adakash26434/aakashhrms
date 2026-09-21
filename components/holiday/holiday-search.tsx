"use client";

import { Search, Filter } from "lucide-react";
import { DropdownMenu, type DropdownOption } from "@/components/ui/dropdown-menu";
import { 
  type CategoryFilter, 
  CATEGORY_FILTERS, 
  formatCategoryFilter 
} from "@/lib/types/holiday";

interface HolidaySearchProps {
  search: string;
  onSearchChange: (next: string) => void;
  category: CategoryFilter;
  onCategoryChange: (next: CategoryFilter) => void;
  /** "Showing X of Y holidays" caption (right-aligned). */
  totalCount: number;
  filteredCount: number;
}

/**
 * Search input + count caption for the Holiday Setup page.
 * One row, responsive (search stacks above the caption on small
 * screens). Mirrors the design's single search input (no tabs
 * — the page uses KPI cards to surface category-level info).
 */
export function HolidaySearch({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  totalCount,
  filteredCount,
}: HolidaySearchProps) {
  const options: DropdownOption<CategoryFilter>[] = CATEGORY_FILTERS.map(
    (c) => ({
      value: c,
      label: formatCategoryFilter(c),
    })
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
        {/* Category filter */}
        <div className="shrink-0">
          <DropdownMenu<CategoryFilter>
            value={category}
            onChange={onCategoryChange}
            options={options}
            ariaLabel="Filter by category"
            minWidth={200}
            renderTrigger={({ open, selected, triggerRef, toggle }) => (
              <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-payroll-border bg-white px-3 text-sm text-payroll-navy transition-colors hover:bg-payroll-light focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary whitespace-nowrap shadow-xs"
              >
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">Category:</span>
                <span className="font-semibold">{selected?.label ?? "All"}</span>
              </button>
            )}
          />
        </div>

        {/* Search input */}
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-payroll-primary/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search holidays..."
            className="h-9 w-full rounded-lg border border-payroll-border bg-white py-2 pl-10 pr-3 text-sm text-payroll-navy placeholder:text-muted-foreground focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-xs"
          />
        </div>
      </div>

      {/* Right side: count */}
      <p className="hidden text-xs text-muted-foreground sm:block tabular-nums">
        Showing{" "}
        <span className="font-semibold text-payroll-navy">{filteredCount}</span>{" "}
        of <span className="font-semibold text-payroll-navy">{totalCount}</span>{" "}
        holidays
      </p>
    </div>
  );
}
