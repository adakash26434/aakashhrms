"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { NEPAL_BANKS, NepalBank } from "@/lib/constants/nepal-banks";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, Search, X } from "lucide-react";

interface BankComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  id?: string;
}

export function BankCombobox({
  value,
  onChange,
  placeholder = "Search or select bank in Nepal...",
  disabled = false,
  hasError = false,
  className,
  id,
}: BankComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal search input with external value when dropdown opens or value changes externally
  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter banks based on search query
  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) return NEPAL_BANKS;
    const q = searchQuery.toLowerCase().trim();
    return NEPAL_BANKS.filter(
      (bank) =>
        bank.name.toLowerCase().includes(q) ||
        bank.shortName.toLowerCase().includes(q) ||
        (bank.swiftCode && bank.swiftCode.toLowerCase().includes(q)) ||
        bank.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group filtered banks by category
  const groupedBanks = useMemo(() => {
    const groups: { [key: string]: NepalBank[] } = {};
    filteredBanks.forEach((bank) => {
      if (!groups[bank.category]) groups[bank.category] = [];
      groups[bank.category].push(bank);
    });
    return groups;
  }, [filteredBanks]);

  const handleSelectBank = (bankName: string) => {
    onChange(bankName);
    setSearchQuery(bankName);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onChange(val);
    if (!open) setOpen(true);
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
        <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "w-full h-9 rounded-lg border border-[#d7e8d0] bg-white pl-9 pr-14 text-sm text-[#1b3a1f] placeholder:text-gray-400 focus:border-[#2e7d32] focus:outline-none focus:ring-1 focus:ring-[#2e7d32] disabled:opacity-50 transition-all",
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/20"
          )}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setOpen(!open)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#d7e8d0] bg-white py-1 shadow-lg animate-[fadeIn_100ms_ease-out]">
          {/* Header search info */}
          <div className="px-3 py-1.5 border-b border-gray-100 bg-[#f6faf6] flex items-center justify-between text-[11px] text-gray-500 font-medium">
            <span>Official Nepal Banks ({filteredBanks.length})</span>
            <span className="text-[10px] text-gray-400">Class A, B, C & NRB</span>
          </div>

          {Object.keys(groupedBanks).length === 0 ? (
            <div className="p-3 text-center text-xs text-gray-500">
              <p className="font-medium text-[#1b3a1f]">No matching bank found</p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                You can keep &quot;{searchQuery}&quot; as custom bank name.
              </p>
            </div>
          ) : (
            Object.entries(groupedBanks).map(([category, list]) => (
              <div key={category} className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2e7d32] bg-green-50/50">
                  {category}
                </div>
                {list.map((bank) => {
                  const isSelected = value === bank.name || value === bank.shortName;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => handleSelectBank(bank.name)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#f6faf6] transition-colors cursor-pointer",
                        isSelected && "bg-green-50/80 font-semibold text-[#2e7d32]"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-[#1b3a1f] font-medium truncate">{bank.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-mono">
                          <span>{bank.shortName}</span>
                          {bank.swiftCode && (
                            <span className="bg-gray-100 px-1 rounded text-gray-500 font-mono">
                              SWIFT: {bank.swiftCode}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#2e7d32] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
