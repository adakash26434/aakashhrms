"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_SECTORS,
  IndustrySectorKey,
  getRecommendedShreniPresets,
} from "@/lib/constants/industry-types";
import {
  Layers,
  Check,
  ChevronsUpDown,
  X,
  Building2,
  Briefcase,
  Landmark,
  ShieldCheck,
  Hospital,
  GraduationCap,
  Factory,
  Hotel,
  Globe2,
  Lock,
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
  placeholder = "Select Shreni / Level / Tier...",
  disabled = false,
  hasError = false,
  className,
  id,
}: ShreniComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Strictly locked to the company's designated sector presets configured by Super Admin
  const sectorPresets = useMemo(() => {
    return getRecommendedShreniPresets(currentSectorKey);
  }, [currentSectorKey]);

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

  // Filter strictly within the company's designated presets
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) {
      return sectorPresets;
    }
    const q = searchQuery.toLowerCase().trim();
    return sectorPresets.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [searchQuery, sectorPresets]);

  const handleSelect = (selectedName: string) => {
    onChange(selectedName);
    setSearchQuery(selectedName);
    setOpen(false);
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
        <SectorIcon className="pointer-events-none absolute left-3 h-4 w-4 text-[#1e7e47]" />
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
              if (filteredPresets.length > 0) {
                handleSelect(filteredPresets[0].name);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border bg-white py-2 pl-9 pr-14 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-1",
            hasError
              ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500"
              : "border-slate-200 focus:border-[#1e7e47] focus:ring-[#1e7e47]",
            disabled && "bg-gray-50 text-gray-400 cursor-not-allowed border-slate-200/60"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg animate-[fadeIn_100ms_ease-out]">
          {/* Locked Company Sector Header Banner */}
          <div className="bg-slate-50 px-3 py-2 text-xs border-b border-slate-200 flex items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold truncate">
              <SectorIcon className="h-3.5 w-3.5 text-[#1e7e47] shrink-0" />
              <span className="truncate">{currentSectorMeta.label}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-medium shrink-0 shadow-2xs">
              <Lock className="h-2.5 w-2.5 text-slate-500" />
              <span>Company Scale</span>
            </span>
          </div>

          {/* List items strictly from company's preset tiers */}
          <div className="p-1 space-y-0.5">
            {filteredPresets.map((opt) => {
              const isSelected =
                opt.name.toLowerCase() === (value || "").toLowerCase();

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt.name)}
                  className={cn(
                    "flex items-start justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors",
                    isSelected
                      ? "bg-emerald-50 text-[#1e7e47] font-semibold"
                      : "text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <div className="flex-1 pr-2">
                    <p className="font-medium text-slate-900">{opt.name}</p>
                    {opt.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {opt.description}
                      </p>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-[#1e7e47] shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}

            {filteredPresets.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                No Shreni found matching &quot;{searchQuery}&quot; in {currentSectorMeta.shortLabel}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
