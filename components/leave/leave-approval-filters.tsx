"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalFilter {
  search: string;
  leaveTypeId: string;
  dateFrom: string;
  dateTo: string;
}

interface LeaveApprovalFiltersProps {
  filter: ApprovalFilter;
  leaveTypeOptions: { id: string; name: string; code: string }[];
  onChange: (filter: ApprovalFilter) => void;
}

export function LeaveApprovalFilters({
  filter,
  leaveTypeOptions,
  onChange,
}: LeaveApprovalFiltersProps) {
  const updateFilter = (key: keyof ApprovalFilter, value: string) => {
    onChange({ ...filter, [key]: value });
  };

  const leaveTypeDropdownOptions = [
    { value: "all", label: "All Leave Types" },
    ...leaveTypeOptions.map((lt) => ({ value: lt.id, label: `${lt.name} (${lt.code})` })),
  ];

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          placeholder="Search by employee name..."
          value={filter.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-9 pr-4 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          value={filter.leaveTypeId}
          onChange={(v) => updateFilter("leaveTypeId", v)}
          label="All Leave Types"
          options={leaveTypeDropdownOptions}
        />
        <input
          type="date"
          value={filter.dateFrom}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs cursor-pointer outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
          placeholder="From"
        />
        <input
          type="date"
          value={filter.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs cursor-pointer outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
          placeholder="To"
        />
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
        className="flex h-9 items-center gap-2 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 text-xs sm:text-sm text-zinc-800 shadow-2xs hover:bg-zinc-50 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 transition-colors"
      >
        <span className="truncate max-w-36">{selected?.label ?? label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", open && "rotate-180")} />
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
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer hover:bg-zinc-50",
                  isSelected
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-700",
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-800" />}
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