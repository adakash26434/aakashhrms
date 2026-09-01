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
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2e7d32]/50" />
        <input
          type="search"
          placeholder="Search by employee name..."
          value={filter.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-10 w-full rounded-lg border border-[#d7e8d0] bg-white py-2 pl-10 pr-4 text-sm text-[#1b3a1f] placeholder:text-gray-400 focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32]"
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
          className="h-10 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] cursor-pointer outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
          placeholder="From"
        />
        <input
          type="date"
          value={filter.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          className="h-10 rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] cursor-pointer outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
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
        className="flex h-10 items-center gap-2 cursor-pointer rounded-lg border border-[#d7e8d0] bg-white px-3 text-sm text-[#1b3a1f] hover:bg-[#f6faf6]"
      >
        <span className="truncate max-w-36">{selected?.label ?? label}</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-[#d7e8d0] bg-white shadow-lg">
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
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer",
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