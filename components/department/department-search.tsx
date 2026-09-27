"use client";

import { Search } from "lucide-react";
import {
  DropdownMenu,
  type DropdownOption,
} from "@/components/ui/dropdown-menu";

interface DepartmentSearchProps {
  search: string;
  onSearchChange: (next: string) => void;
  /** List of available branches for the filter dropdown. */
  branches: { id: string; name: string }[];
  /** Currently selected branch id, or "" for "All Branches". */
  branchFilter: string;
  onBranchFilterChange: (next: string) => void;
  /** "Showing X of Y departments" caption (right-aligned). */
  totalCount: number;
  filteredCount: number;
}

/**
 * Search input + branch filter dropdown + "X of Y" count
 * caption. One row, responsive (search stacks above the
 * filter on small screens). Mirrors the design screenshot.
 */
export function DepartmentSearch({
  search,
  onSearchChange,
  branches,
  branchFilter,
  onBranchFilterChange,
  totalCount,
  filteredCount,
}: DepartmentSearchProps) {
  const options: DropdownOption<string>[] = [
    { value: "", label: "All Branches" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const selectedLabel =
    options.find((o) => o.value === branchFilter)?.label ?? "All Branches";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search input */}
      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search departments..."
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 transition-colors"
        />
      </div>

      {/* Right side: branch filter + count */}
      <div className="flex items-center gap-3">
        <DropdownMenu<string>
          value={branchFilter}
          onChange={onBranchFilterChange}
          options={options}
          ariaLabel="Filter by branch"
          minWidth={200}
          renderTrigger={({ open, selected, triggerRef, toggle }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={toggle}
              aria-haspopup="listbox"
              aria-expanded={open}
              className="inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 hover:bg-zinc-50 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 shadow-2xs min-w-45 transition-colors cursor-pointer"
            >
              <span className="truncate">
                {selected?.label ?? selectedLabel}
              </span>
              <span className="text-zinc-400">▾</span>
            </button>
          )}
        />
        <p className="hidden text-xs text-zinc-500 sm:block tabular-nums">
          Showing{" "}
          <span className="font-semibold text-zinc-900">
            {filteredCount}
          </span>{" "}
          of <span className="font-semibold text-zinc-900">{totalCount}</span>{" "}
          departments
        </p>
      </div>
    </div>
  );
}
