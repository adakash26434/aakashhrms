"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import type { LeaveFilter, LeaveStatus } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

interface LeaveFiltersProps {
  filter: LeaveFilter;
  leaveTypeOptions: { id: string; name: string; code: string }[];
  onChange: (filter: LeaveFilter) => void;
}

const STATUS_TABS: Array<{ value: LeaveStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
];

export function LeaveFilters({
  filter,
  leaveTypeOptions,
  onChange,
}: LeaveFiltersProps) {
  const updateFilter = (key: keyof LeaveFilter, value: string) => {
    onChange({ ...filter, [key]: value });
  };

  const leaveTypeDropdownOptions = [
    { value: "all", label: "All Leave Types" },
    ...leaveTypeOptions.map((lt) => ({
      value: lt.id,
      label: `${lt.name} (${lt.code})`,
    })),
  ];

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by employee name or reason..."
            value={filter.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-4 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={filter.leaveTypeId ?? "all"}
            onChange={(v) => updateFilter("leaveTypeId", v)}
            label="All Leave Types"
            options={leaveTypeDropdownOptions}
          />
          {/* Date from */}
          <input
            type="date"
            value={filter.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs cursor-pointer outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary transition-colors"
          />
          {/* Date to */}
          <input
            type="date"
            value={filter.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs cursor-pointer outline-none focus:border-payroll-primary focus:ring-1 focus:ring-payroll-primary transition-colors"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Filter by status"
        className="inline-flex gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 shadow-2xs"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = filter.status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => updateFilter("status", tab.value)}
              className={cn(
                "rounded-md px-3.5 py-1 text-xs font-medium transition-all cursor-pointer select-none",
                isActive
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900",
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
        className="flex h-9 items-center gap-2 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs hover:bg-zinc-50 focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary transition-colors"
      >
        <span className="truncate max-w-36">{selected?.label ?? label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-zinc-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg animate-[dialogIn_150ms_ease-out]">
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
                  "flex w-full items-center cursor-pointer gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50",
                  isSelected
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-700",
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-payroll-primary" />
                  )}
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
