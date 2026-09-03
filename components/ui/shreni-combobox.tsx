"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
  SHRENI_PRESETS_BY_SECTOR,
  getRecommendedShreniPresets,
  getAllShreniPresets,
  ShreniPresetItem,
} from "@/lib/constants/industry-types";
import {
  Layers,
  Check,
  ChevronsUpDown,
  Search,
  X,
  PlusCircle,
  Building2,
  Briefcase,
  Landmark,
  ShieldCheck,
  Hospital,
  GraduationCap,
  Factory,
  Hotel,
  Globe2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const SECTOR_ICONS: Record<IndustrySectorKey, any> = {
  BFIs: Landmark,
  Cooperatives: Building2,
  Corporate: Briefcase,
  Healthcare: Hospital,
  Education: GraduationCap,
  Manufacturing: Factory,
  Hospitality: Hotel,
  NGO_INGO: Globe2,
  Government: ShieldCheck,
  General: Layers,
};

interface ShreniComboboxProps {
  value: string;
  onChange: (value: string) => void;
  industryType?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  id?: string;
}

export function ShreniCombobox({
  value,
  onChange,
  industryType = "General",
  placeholder = "Search or select Shreni / Level / Tier...",
  disabled = false,
  hasError = false,
  className,
  id,
}: ShreniComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllSectors, setShowAllSectors] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSectorKey = useMemo<IndustrySectorKey>(() => {
    if (industryType && industryType in INDUSTRY_SECTORS) {
      return industryType as IndustrySectorKey;
    }
    return "General";
  }, [industryType]);

  const currentSectorMeta = useMemo(() => {
    return INDUSTRY_SECTORS[currentSectorKey] || INDUSTRY_SECTORS.General;
  }, [currentSectorKey]);

  const recommendedPresets = useMemo(() => {
    return getRecommendedShreniPresets(currentSectorKey);
  }, [currentSectorKey]);

  const allPresets = useMemo(() => {
    return getAllShreniPresets();
  }, []);

  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearchQuery(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // When searching, filter across all presets. When not searching, filter recommended or all based on showAllSectors.
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) {
      return showAllSectors ? allPresets : recommendedPresets;
    }
    const q = searchQuery.toLowerCase().trim();
    return allPresets.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        opt.category.toLowerCase().includes(q) ||
        (INDUSTRY_SECTORS[opt.category] &&
          INDUSTRY_SECTORS[opt.category].label.toLowerCase().includes(q))
    );
  }, [searchQuery, showAllSectors, allPresets, recommendedPresets]);

  const hasExactMatch = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return allPresets.some((opt) => opt.name.toLowerCase() === q);
  }, [searchQuery, allPresets]);

  const handleSelect = (selectedName: string) => {
    onChange(selectedName);
    setSearchQuery(selectedName);
    setOpen(false);
  };

  const handleCustomEntry = () => {
    if (searchQuery.trim()) {
      handleSelect(searchQuery.trim());
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const SectorIcon = SECTOR_ICONS[currentSectorKey] || Layers;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <SectorIcon className="pointer-events-none absolute left-3 h-4 w-4 text-payroll-primary" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredPresets.length > 0 && !hasExactMatch) {
                handleSelect(filteredPresets[0].name);
              } else if (searchQuery.trim()) {
                handleCustomEntry();
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border bg-white py-2 pl-9 pr-14 text-sm text-payroll-navy transition-colors focus:outline-none focus:ring-1",
            hasError
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500"
              : "border-payroll-light focus:border-payroll-primary focus:ring-payroll-primary",
            disabled && "bg-gray-50 text-gray-400 cursor-not-allowed border-payroll-light/60"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-payroll-light bg-white shadow-payroll-md animate-[fadeIn_100ms_ease-out]">
          {/* Custom value shortcut if typing new value */}
          {searchQuery.trim() && !hasExactMatch && (
            <div
              onClick={handleCustomEntry}
              className="p-2.5 border-b border-payroll-light/80 bg-payroll-cream/70 hover:bg-payroll-cream text-xs text-payroll-primary font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <PlusCircle className="h-4 w-4 shrink-0 text-payroll-primary" />
              <span>
                Use custom Shreni: <span className="underline">{searchQuery.trim()}</span>
              </span>
            </div>
          )}

          {/* Recommended Sector Banner */}
          {!searchQuery.trim() && (
            <div className="bg-payroll-cream/90 px-3 py-2 text-xs border-b border-payroll-light flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-payroll-navy font-bold">
                <Sparkles className="h-3.5 w-3.5 text-payroll-primary shrink-0" />
                <span>
                  {currentSectorKey === "General"
                    ? "Universal 12-Tier Maximum Scale (Unclassified)"
                    : `Configured Tiers: ${currentSectorMeta.label}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllSectors((prev) => !prev)}
                className="text-[11px] text-payroll-primary font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                <span>{showAllSectors ? "Show Sector Only" : "Show All Sectors"}</span>
                {showAllSectors ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>
          )}

          {/* List items */}
          <div className="p-1 space-y-0.5">
            {filteredPresets.map((opt) => {
              const isSelected = opt.name.toLowerCase() === (value || "").toLowerCase();
              const itemSector = INDUSTRY_SECTORS[opt.category] || INDUSTRY_SECTORS.General;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt.name)}
                  className={cn(
                    "flex items-start justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                    isSelected
                      ? "bg-payroll-primary/10 text-payroll-primary font-semibold"
                      : "text-payroll-navy hover:bg-payroll-cream/70"
                  )}
                >
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-payroll-navy">{opt.name}</p>
                      {(showAllSectors || searchQuery.trim()) && (
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.2 rounded border font-normal",
                            itemSector.badgeColor
                          )}
                        >
                          {itemSector.shortLabel}
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{opt.description}</p>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-payroll-primary shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}

            {filteredPresets.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                No matching Shreni categories found. Type above to use custom Shreni.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
