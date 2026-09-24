"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Check, RotateCcw } from "lucide-react";
import { EmployeeFilter } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

interface EmployeeFiltersProps {
  filters: EmployeeFilter;
  setFilters: React.Dispatch<React.SetStateAction<EmployeeFilter>>;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  count?: number;
}

const STATUS_OPTIONS: Array<{ value: EmployeeFilter["status"]; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "Permanent", label: "Permanent" },
  { value: "Temporary", label: "Temporary" },
  { value: "Contract", label: "Contract" },
  { value: "Consultant", label: "Consultant" },
  { value: "Trainee", label: "Trainee" },
];

export function EmployeeFilters({
  filters,
  setFilters,
  branches,
  departments,
  count,
}: EmployeeFiltersProps) {
  const updateFilter = (key: keyof EmployeeFilter, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      departmentId: "all",
      branchId: "all",
      category: "all",
      status: "all",
    });
  };

  const hasActiveFilters = Boolean(
    (filters.search && filters.search.trim()) ||
    filters.departmentId !== "all" ||
    filters.branchId !== "all" ||
    filters.category !== "all" ||
    filters.status !== "all"
  );

  const departmentOptions = [
    { value: "all", label: "All Departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const branchOptions = [
    { value: "all", label: "All Branches" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Left controls: Search + Dropdowns */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        <div className="relative min-w-55 max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search name, code, email, PAN..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-9 w-full rounded-lg border border-payroll-border bg-white py-1.5 pl-9 pr-3 text-xs text-payroll-ink placeholder-gray-400 shadow-2xs transition-colors focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary"
          />
        </div>

        <FilterDropdown
          value={filters.departmentId}
          onChange={(v) => updateFilter("departmentId", v)}
          label="All Departments"
          options={departmentOptions}
        />

        <FilterDropdown
          value={filters.branchId}
          onChange={(v) => updateFilter("branchId", v)}
          label="All Branches"
          options={branchOptions}
        />

        <FilterDropdown
          value={filters.category}
          onChange={(v) => updateFilter("category", v)}
          label="All Types"
          options={CATEGORY_OPTIONS}
        />

        <FilterDropdown
          value={filters.status}
          onChange={(v) => updateFilter("status", v as EmployeeFilter["status"])}
          label="All Status"
          options={STATUS_OPTIONS}
        />

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-all shadow-2xs cursor-pointer animate-[fadeIn_100ms_ease-out]"
            title="Clear all active filters"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Right count */}
      {typeof count === "number" && (
        <div className="text-right text-xs font-medium text-gray-400 shrink-0">
          {count} {count === 1 ? "employee" : "employees"}
        </div>
      )}
    </div>
  );
}

function FilterDropdown({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, options, value]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(options.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && options[highlightedIndex]) {
        e.preventDefault();
        onChange(options[highlightedIndex].value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-block" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-payroll-border bg-white px-3 text-xs font-normal text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-payroll-primary cursor-pointer"
      >
        <span className="truncate max-w-36">{selected?.label ?? label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-gray-400 transition-transform duration-200",
            open && "rotate-180 text-payroll-primary"
          )}
        />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border border-payroll-border bg-white shadow-payroll-md animate-[dialogIn_150ms_ease-out]">
          <div className="max-h-56 overflow-y-auto p-1">
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = highlightedIndex === idx;

              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer select-none",
                    isHighlighted
                      ? "bg-[#eef8f2] text-[#1e7e47] font-semibold"
                      : isSelected
                      ? "bg-payroll-primary-light text-payroll-primary font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    {isSelected && <Check className="h-3 w-3 text-payroll-primary" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

