"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  STANDARD_SHRENI_LEVELS,
  type ShreniLevelItem,
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
  industryType?: string; // Kept for backwards-compatible component interface (informational only)
  levels?: ShreniLevelItem[]; // Dynamic organization Shreni levels (S1–S15 + any custom levels)
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

  // Available levels: uses tenant's configured levels from DB or canonical 15 general levels
  const availableLevels = useMemo(() => {
    const src = levels && levels.length > 0 ? levels : STANDARD_SHRENI_LEVELS;
    return [...src].sort((a, b) => a.levelNumber - b.levelNumber);
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
      const nepaliText = matched.labelNepali ? ` • ${matched.labelNepali}` : "";
      setSearchQuery(`${matched.code} — ${matched.name}${nepaliText}`);
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
          if (matched) {
            const nepaliText = matched.labelNepali ? ` • ${matched.labelNepali}` : "";
            setSearchQuery(`${matched.code} — ${matched.name}${nepaliText}`);
          } else {
            setSearchQuery(value);
          }
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
        (lvl.labelNepali && lvl.labelNepali.toLowerCase().includes(q)) ||
        String(lvl.levelNumber) === q ||
        (lvl.description && lvl.description.toLowerCase().includes(q))
    );
  }, [searchQuery, availableLevels]);

  const handleSelect = (level: ShreniLevelItem) => {
    onChange(level.code);
    const nepaliText = level.labelNepali ? ` • ${level.labelNepali}` : "";
    setSearchQuery(`${level.code} — ${level.name}${nepaliText}`);
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
        <Layers className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-emerald-800" />
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
            "h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-12 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700",
            hasError && "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-500",
            disabled && "bg-zinc-50 text-zinc-400 cursor-not-allowed border-zinc-200"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg animate-[fadeIn_100ms_ease-out]">
          {/* Quick-Select Level Pills Header */}
          <div className="bg-zinc-50 p-2.5 border-b border-zinc-200 space-y-1.5 select-none">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-800" />
                <span>Quick Select Grade Level:</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {availableLevels[0]?.code} &ndash; {availableLevels[availableLevels.length - 1]?.code}
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
                        ? "bg-emerald-900 text-white shadow-2xs"
                        : "bg-white border border-zinc-200 text-zinc-700 hover:border-emerald-700 hover:text-emerald-900"
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
                      ? "bg-emerald-50 text-emerald-950 font-semibold"
                      : isSelected
                      ? "bg-emerald-50/70 text-emerald-950 font-semibold"
                      : "text-zinc-800 hover:bg-zinc-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-7 w-8 items-center justify-center rounded-md font-mono text-xs font-bold shrink-0",
                        isSelected
                          ? "bg-emerald-900 text-white"
                          : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                      )}
                    >
                      {lvl.code}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">
                        {lvl.name} {lvl.labelNepali ? `\u2022 ${lvl.labelNepali}` : ""}
                      </p>
                      {lvl.description && (
                        <p className="text-[11px] text-zinc-500 truncate">
                          {lvl.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {lvl.minSalary && lvl.minSalary > 0 ? (
                      <span className="font-mono text-[11px] text-emerald-900 bg-emerald-50/60 px-1.5 py-0.5 rounded border border-emerald-200/50">
                        NPR {lvl.minSalary.toLocaleString()}
                      </span>
                    ) : null}
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-800 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}

            {filteredLevels.length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-500 space-y-2">
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
