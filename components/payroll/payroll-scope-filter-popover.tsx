"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScopeFilterItem {
  id: string;
  label: string;
  count?: number;
}

interface PayrollScopeFilterPopoverProps {
  label: string;
  icon: LucideIcon;
  items: ScopeFilterItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowEmptyAsAll?: boolean; // For categories where empty means "all"
  required?: boolean;
}

export function PayrollScopeFilterPopover({
  label,
  icon: Icon,
  items,
  selectedIds,
  onSelectionChange,
  placeholder = "Search...",
  emptyLabel = "All Included",
  allowEmptyAsAll = false,
  required = false,
}: PayrollScopeFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, search]);

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;
  const isNoneSelected = selectedIds.length === 0;

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(items.map((i) => i.id));
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  // Compute summary badge text for the button trigger
  let summaryText = "";
  let isWarning = false;

  if (allowEmptyAsAll && isNoneSelected) {
    summaryText = emptyLabel;
  } else if (isAllSelected) {
    summaryText = `All (${items.length})`;
  } else if (selectedIds.length === 0) {
    summaryText = "None";
    if (required) isWarning = true;
  } else if (selectedIds.length === 1) {
    const single = items.find((i) => i.id === selectedIds[0]);
    summaryText = single ? single.label : "1 selected";
  } else {
    summaryText = `${selectedIds.length} of ${items.length}`;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-xs font-medium transition-all shadow-xs cursor-pointer select-none",
          isOpen
            ? "border-payroll-primary ring-2 ring-payroll-primary/10 shadow-sm"
            : "border-payroll-light/90 hover:border-payroll-primary/60 hover:bg-payroll-cream/40",
          isWarning && "border-red-300 bg-red-50/40 text-red-700"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
              selectedIds.length > 0 || (allowEmptyAsAll && isNoneSelected)
                ? "bg-payroll-primary/10 text-payroll-primary"
                : "bg-gray-100 text-gray-500"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col text-left truncate">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 leading-tight">
              {label}
            </span>
            <span
              className={cn(
                "truncate text-xs font-semibold",
                isWarning
                  ? "text-red-600"
                  : selectedIds.length > 0 || (allowEmptyAsAll && isNoneSelected)
                  ? "text-payroll-navy"
                  : "text-gray-400"
              )}
            >
              {summaryText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedIds.length > 0 && !isAllSelected && !(allowEmptyAsAll && isNoneSelected) && (
            <span className="flex h-5 items-center rounded-full bg-payroll-primary/10 px-1.5 text-[10px] font-bold text-payroll-primary font-mono">
              {selectedIds.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform duration-200",
              isOpen && "rotate-180 text-payroll-primary"
            )}
          />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-payroll-light bg-white p-3 shadow-xl animate-[fadeIn_150ms_ease-out]">
          {/* Header with Quick Actions */}
          <div className="flex items-center justify-between border-b border-payroll-light/70 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-payroll-primary" />
              <span className="text-xs font-bold text-payroll-navy">
                {label}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                ({items.length})
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-payroll-primary">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:underline hover:text-payroll-navy cursor-pointer"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleClear}
                className="hover:underline hover:text-payroll-navy cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Filter if more than 5 items */}
          {items.length > 5 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-payroll-light/90 bg-payroll-cream/20 py-1.5 pl-8 pr-7 text-xs text-payroll-navy outline-none focus:border-payroll-primary focus:bg-white"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Scrollable Checkbox List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 divide-y divide-payroll-light/30 pr-1">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No matching options
              </div>
            ) : (
              filteredItems.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none",
                      checked
                        ? "bg-payroll-primary/5 text-payroll-navy font-semibold"
                        : "text-gray-700 hover:bg-payroll-cream/60"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          checked
                            ? "border-payroll-primary bg-payroll-primary text-white"
                            : "border-gray-300 bg-white hover:border-payroll-primary/70"
                        )}
                      >
                        {checked && <Check className="h-3 w-3 stroke-3" />}
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== undefined && (
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {item.count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="mt-2.5 flex items-center justify-between border-t border-payroll-light/60 pt-2 text-[10px] text-gray-400">
            {allowEmptyAsAll && isNoneSelected ? (
              <span className="text-emerald-700 font-medium">
                Empty selection includes all
              </span>
            ) : required && isNoneSelected ? (
              <span className="text-red-600 font-medium">
                At least one required
              </span>
            ) : (
              <span>
                {selectedIds.length} of {items.length} chosen
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-payroll-primary hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
