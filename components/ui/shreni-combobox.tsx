"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  STANDARD_SHRENI_LEVELS,
  ShreniLevelItem,
} from "@/lib/constants/industry-types";
import {
  Layers,
  Check,
  ChevronsUpDown,
  X,
  Sparkles,
} from "lucide-react";

interface ShreniComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  id?: string;
  industryType?: string; // Kept for backwards-compatible component interface
  levels?: ShreniLevelItem[]; // Optional tenant-customized levels
}

export function ShreniCombobox({
  value,
  onChange,
  placeholder = "Select Level (e.g. S1, S2, S3...)",
  disabled = false,
  hasError = false,
  className,
  id,
  levels,
}: ShreniComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableLevels = useMemo(() => {
    return levels && levels.length > 0 ? levels : STANDARD_SHRENI_LEVELS;
  }, [levels]);

  // Sync displayed query when external value changes
  useEffect(() => {
    if (!value) {
      setSearchQuery("");
      return;
    }
    const matched = availableLevels.find(
      (l) =>
        l.code.toLowerCase() === value.toLowerCase() ||
        l.id.toLowerCase() === value.toLowerCase() ||
        l.name.toLowerCase() === value.toLowerCase()
    );
    if (matched) {
      setSearchQuery(`${matched.code} — Level ${matched.levelNumber}`);
    } else {
      setSearchQuery(value);
    }
  }, [value, availableLevels]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        if (value) {
          const matched = availableLevels.find(
            (l) =>
              l.code.toLowerCase() === value.toLowerCase() ||
              l.id.toLowerCase() === value.toLowerCase()
          );
          setSearchQuery(matched ? `${matched.code} — Level ${matched.levelNumber}` : value);
        } else {
          setSearchQuery("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, availableLevels]);

  // Filter levels based on search query
  const filteredLevels = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableLevels;
    }
    const q = searchQuery.toLowerCase().trim();
    return availableLevels.filter(
      (lvl) =>
        lvl.code.toLowerCase().includes(q) ||
        lvl.name.toLowerCase().includes(q) ||
        lvl.labelNepali.toLowerCase().includes(q) ||
        String(lvl.levelNumber) === q ||
        (lvl.description && lvl.description.toLowerCase().includes(q))
    );
  }, [searchQuery, availableLevels]);

  const handleSelect = (level: ShreniLevelItem) => {
    onChange(level.code);
    setSearchQuery(`${level.code} — Level ${level.levelNumber}`);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      const idx = filteredLevels.findIndex(
        (l) =>
          value?.toUpperCase() === l.code.toUpperCase() ||
          value?.toLowerCase() === l.name.toLowerCase()
      );
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, filteredLevels, value]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredLevels.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(filteredLevels.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredLevels.length - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0 && filteredLevels[highlightedIndex]) {
        handleSelect(filteredLevels[highlightedIndex]);
      } else if (filteredLevels.length > 0) {
        handleSelect(filteredLevels[0]);
      } else if (searchQuery.trim()) {
        onChange(searchQuery.trim().toUpperCase());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Layers className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#1e7e47]" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-12 text-xs sm:text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47]",
            hasError && "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500",
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
          {/* Quick-Select Level Pills Header */}
          <div className="bg-slate-50 p-2.5 border-b border-slate-200 space-y-1.5 select-none">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                <span>Quick Select Level:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {availableLevels[0]?.code} – {availableLevels[availableLevels.length - 1]?.code}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {availableLevels.map((lvl) => {
                const isSelected =
                  value?.toUpperCase() === lvl.code.toUpperCase();
                return (
                  <button
                    key={lvl.id || lvl.code}
                    type="button"
                    onClick={() => handleSelect(lvl)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#1e7e47] text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
                    )}
                  >
                    {lvl.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Level List */}
          <div className="p-1 space-y-0.5">
            {filteredLevels.map((lvl, idx) => {
              const isSelected =
                value?.toUpperCase() === lvl.code.toUpperCase() ||
                value?.toLowerCase() === lvl.name.toLowerCase();
              const isHighlighted = highlightedIndex === idx;

              return (
                <div
                  key={lvl.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  onClick={() => handleSelect(lvl)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                    isHighlighted
                      ? "bg-[#eef8f2] text-[#1e7e47] font-semibold"
                      : isSelected
                      ? "bg-emerald-50 text-[#1e7e47] font-semibold"
                      : "text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-7 w-8 items-center justify-center rounded-md font-mono text-xs font-bold shrink-0",
                        isSelected
                          ? "bg-[#1e7e47] text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      )}
                    >
                      {lvl.code}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        Level {lvl.levelNumber} &bull; {lvl.name}
                      </p>
                      {lvl.description && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {lvl.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 text-[#1e7e47] shrink-0 ml-2" />
                  )}
                </div>
              );
            })}

            {filteredLevels.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                <p>No predefined level matching &quot;{searchQuery}&quot;</p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(searchQuery.trim().toUpperCase());
                      setOpen(false);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
                  >
                    <span>Use &quot;{searchQuery.trim().toUpperCase()}&quot; as custom level</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

