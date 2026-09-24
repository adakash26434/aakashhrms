"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { PROVINCES, getAllDistricts, District } from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, MapPin, Search, X } from "lucide-react";

interface DistrictComboboxProps {
  value: string;
  onChange: (districtName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  id?: string;
}

export function DistrictCombobox({
  value,
  onChange,
  placeholder = "Search district (e.g. Kathmandu, Kaski...)",
  disabled = false,
  hasError = false,
  className,
  id,
}: DistrictComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allDistricts = useMemo(() => getAllDistricts(), []);

  // Synchronize internal search input with value
  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        // Reset query back to value if user typed something not matched
        setSearchQuery(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const provinceMap = useMemo(() => {
    const map = new Map<string, { name: string; nameNepali: string }>();
    PROVINCES.forEach((p) => map.set(p.id, { name: p.name, nameNepali: p.nameNepali }));
    return map;
  }, []);

  // Filter districts based on search query (by English, Nepali, or Province name)
  const filteredDistricts = useMemo(() => {
    if (!searchQuery.trim()) return allDistricts;
    const q = searchQuery.toLowerCase().trim();
    return allDistricts.filter((d) => {
      const prov = provinceMap.get(d.provinceId);
      return (
        d.name.toLowerCase().includes(q) ||
        d.nameNepali.includes(q) ||
        (prov && (prov.name.toLowerCase().includes(q) || prov.nameNepali.includes(q)))
      );
    });
  }, [allDistricts, searchQuery, provinceMap]);

  // Group filtered districts by Province
  const groupedByProvince = useMemo(() => {
    const groups: { [provinceId: string]: { provinceName: string; provinceNameNepali: string; districts: District[] } } = {};
    
    PROVINCES.forEach((p) => {
      groups[p.id] = {
        provinceName: p.name,
        provinceNameNepali: p.nameNepali,
        districts: [],
      };
    });

    filteredDistricts.forEach((d) => {
      if (groups[d.provinceId]) {
        groups[d.provinceId].districts.push(d);
      }
    });

    return Object.values(groups).filter((g) => g.districts.length > 0);
  }, [filteredDistricts]);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset highlighted index when filtered districts change or dropdown opens
  useEffect(() => {
    if (open) {
      const idx = filteredDistricts.findIndex(
        (d) => d.name.toLowerCase() === value?.toLowerCase()
      );
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, filteredDistricts, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  const handleSelectDistrict = (districtName: string) => {
    onChange(districtName);
    setSearchQuery(districtName);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredDistricts.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(filteredDistricts.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredDistricts.length - 1
        );
      }
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && filteredDistricts[highlightedIndex]) {
        e.preventDefault();
        handleSelectDistrict(filteredDistricts[highlightedIndex].name);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-12 text-xs sm:text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47]",
            hasError && "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500",
            disabled && "cursor-not-allowed bg-gray-50 text-gray-400"
          )}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setOpen(!open)}
            disabled={disabled}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg scrollbar-thin">
          {groupedByProvince.length === 0 ? (
            <div className="p-3 text-center text-xs text-gray-500">
              No districts found matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            (() => {
              let runningIdx = -1;
              return groupedByProvince.map((group) => (
                <div key={group.provinceName} className="mb-2 last:mb-0">
                  <div className="sticky top-0 bg-gray-50/95 px-2.5 py-1 text-[11px] font-semibold text-[#1e7e47] backdrop-blur-xs">
                    {group.provinceName}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {group.districts.map((d) => {
                      runningIdx += 1;
                      const thisIdx = runningIdx;
                      const isSelected = value?.toLowerCase() === d.name.toLowerCase();
                      const isHighlighted = highlightedIndex === thisIdx;

                      return (
                        <button
                          key={d.id}
                          ref={(el) => {
                            itemRefs.current[thisIdx] = el;
                          }}
                          type="button"
                          onClick={() => handleSelectDistrict(d.name)}
                          onMouseEnter={() => setHighlightedIndex(thisIdx)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                            isHighlighted
                              ? "bg-[#eef8f2] text-[#1e7e47] font-semibold"
                              : isSelected
                              ? "bg-emerald-50 font-medium text-payroll-navy"
                              : "text-gray-700 hover:bg-gray-50 hover:text-payroll-navy"
                          )}
                        >
                          <span className="font-medium">{d.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-[#1e7e47]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}
