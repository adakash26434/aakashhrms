"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { EmployeeFilter } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

interface EmployeeFiltersProps {
  filters: EmployeeFilter;
  setFilters: React.Dispatch<React.SetStateAction<EmployeeFilter>>;
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}

const STATUS_TABS: Array<{ value: EmployeeFilter["status"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "Active", label: "Active" },
  { value: "On Leave", label: "On Leave" },
  { value: "Terminated", label: "Terminated" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "Permanent", label: "Permanent" },
  { value: "Temporary", label: "Temporary" },
  { value: "Contract", label: "Contract" },
  { value: "Consultant", label: "Consultant" },
  { value: "Trainee", label: "Trainee" },
];

export function EmployeeFilters({ filters, setFilters, branches, departments }: EmployeeFiltersProps) {
  const updateFilter = (key: keyof EmployeeFilter, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const departmentOptions = [
    { value: "all", label: "All Departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const branchOptions = [
    { value: "all", label: "All Branches" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2e7d32]/50" />
          <input
            type="search"
            placeholder="Search by name, code, email, citizenship..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-10 w-full rounded-lg border border-[#d7e8d0] bg-white py-2 pl-10 pr-4 text-sm text-[#1b3a1f] placeholder:text-gray-400 focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            label="All Categories"
            options={CATEGORY_OPTIONS}
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filter by status"
        className="inline-flex gap-1 rounded-lg border border-[#d7e8d0]/80 bg-white p-1"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = filters.status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => updateFilter("status", tab.value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#f6faf6] text-[#1b3a1f] shadow-sm"
                  : "text-gray-500 hover:bg-[#f6faf6]/60 hover:text-[#1b3a1f]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
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
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

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

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] hover:bg-[#f6faf6]"
      >
        <span className="truncate max-w-36">{selected?.label ?? label}</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-[#d7e8d0] bg-white shadow-lg">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-[#d7e8d0]/40 text-[#1b3a1f] font-medium"
                    : "text-gray-700 hover:bg-[#f6faf6]",
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#2e7d32]" />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
