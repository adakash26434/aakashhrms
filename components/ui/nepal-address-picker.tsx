"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  PROVINCES,
  getDistrictsByProvince,
  getPalikasByDistrict,
  parseStructuredAddress,
  serializeStructuredAddress,
  type StructuredAddress,
} from "@/lib/constants/nepal-locations";
import { Check, Copy, MapPin, Search, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeValidationErrors } from "@/lib/types/employee";

interface OptionItem {
  value: string;
  label: string;
  labelNepali?: string;
}

interface SearchableAddressSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
  emptyMessage?: string;
}

function SearchableAddressSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  hasError = false,
  emptyMessage = "No results found",
}: SearchableAddressSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = useMemo(
    () => options.find((o) => o.value.toLowerCase() === (value || "").toLowerCase()),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.labelNepali && o.labelNepali.includes(q)) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Reset or initialize highlighted index when dropdown opens or filtered options change
  useEffect(() => {
    if (open) {
      const idx = filteredOptions.findIndex(
        (o) => o.value.toLowerCase() === (value || "").toLowerCase()
      );
      setHighlightedIndex(idx >= 0 ? idx : 0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, filteredOptions, value]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (open && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (!open) {
        setOpen(true);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm flex items-center justify-between shadow-2xs transition-colors cursor-pointer select-none hover:border-slate-300 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47]",
          hasError
            ? "border-red-500 bg-red-50/20 ring-1 ring-red-500/20"
            : "",
          open && "border-[#1e7e47] ring-1 ring-[#1e7e47]",
          disabled && "bg-gray-50 text-gray-400 cursor-not-allowed border-slate-200"
        )}
      >
        <div className="truncate flex-1 pr-2">
          {selectedOption ? (
            <span className="text-slate-800 font-medium">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-gray-400 text-xs">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:text-gray-600 rounded cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronsUpDown className="w-4 h-4" />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden animate-[fadeIn_100ms_ease-out]">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to filter..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-100/50 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value.toLowerCase() === (value || "").toLowerCase();
                const isHighlighted = highlightedIndex === idx;
                return (
                  <div
                    key={opt.value}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-lg flex items-center justify-between cursor-pointer transition-colors",
                      isHighlighted
                        ? "bg-[#eef8f2] text-[#1e7e47] font-semibold"
                        : isSelected
                        ? "bg-emerald-50 text-slate-900 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#1e7e47] shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NepalAddressPickerProps {
  permanentAddress: string;
  temporaryAddress: string;
  onChangePermanent: (serialized: string) => void;
  onChangeTemporary: (serialized: string) => void;
  errors?: EmployeeValidationErrors;
}

export function NepalAddressPicker({
  permanentAddress,
  temporaryAddress,
  onChangePermanent,
  onChangeTemporary,
  errors,
}: NepalAddressPickerProps) {
  const perm: StructuredAddress = useMemo(
    () => parseStructuredAddress(permanentAddress),
    [permanentAddress]
  );
  const temp: StructuredAddress = useMemo(
    () => parseStructuredAddress(temporaryAddress),
    [temporaryAddress]
  );

  const permDistricts = useMemo(
    () => (perm.province ? getDistrictsByProvince(perm.province) : []),
    [perm.province]
  );
  const permPalikas = useMemo(
    () => (perm.district ? getPalikasByDistrict(perm.district) : []),
    [perm.district]
  );

  const tempDistricts = useMemo(
    () => (temp.province ? getDistrictsByProvince(temp.province) : []),
    [temp.province]
  );
  const tempPalikas = useMemo(
    () => (temp.district ? getPalikasByDistrict(temp.district) : []),
    [temp.district]
  );

  const isSameAddress = useMemo(() => {
    if (!perm.province || !temp.province) return false;
    return (
      perm.province === temp.province &&
      perm.district === temp.district &&
      perm.localLevel === temp.localLevel &&
      perm.wardNo === temp.wardNo &&
      perm.tole.trim().toLowerCase() === temp.tole.trim().toLowerCase()
    );
  }, [perm, temp]);

  const updatePerm = (field: keyof StructuredAddress, value: string) => {
    const next = { ...perm, [field]: value };
    if (field === "province") {
      next.district = "";
      next.localLevel = "";
    } else if (field === "district") {
      next.localLevel = "";
    }
    onChangePermanent(serializeStructuredAddress(next));
  };

  const updateTemp = (field: keyof StructuredAddress, value: string) => {
    const next = { ...temp, [field]: value };
    if (field === "province") {
      next.district = "";
      next.localLevel = "";
    } else if (field === "district") {
      next.localLevel = "";
    }
    onChangeTemporary(serializeStructuredAddress(next));
  };

  const handleCopyPermanentToTemporary = () => {
    onChangeTemporary(serializeStructuredAddress({ ...perm }));
  };

  const inputClass =
    "w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-xs sm:text-sm text-slate-900 shadow-2xs transition-colors hover:border-slate-300 focus:border-[#1e7e47] focus:outline-none focus:ring-1 focus:ring-[#1e7e47]";

  // Format options for SearchableAddressSelect
  const permDistrictOptions: OptionItem[] = useMemo(
    () => permDistricts.map((d) => ({ value: d.name, label: d.name, labelNepali: d.nameNepali })),
    [permDistricts]
  );

  const permPalikaOptions: OptionItem[] = useMemo(
    () => permPalikas.map((p) => ({ value: p, label: p })),
    [permPalikas]
  );

  const tempDistrictOptions: OptionItem[] = useMemo(
    () => tempDistricts.map((d) => ({ value: d.name, label: d.name, labelNepali: d.nameNepali })),
    [tempDistricts]
  );

  const tempPalikaOptions: OptionItem[] = useMemo(
    () => tempPalikas.map((p) => ({ value: p, label: p })),
    [tempPalikas]
  );

  return (
    <div className="space-y-6">
      {/* 1. PERMANENT ADDRESS */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-[#1e7e47]">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Permanent Address *
            </h4>
            <p className="text-[11px] text-gray-500">
              Official legal residence as recorded on Citizenship or National ID.
            </p>
          </div>
        </div>

        {errors?.permanentAddress && (
          <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600">
            {errors.permanentAddress}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Province */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Province *</label>
            <select
              value={perm.province}
              onChange={(e) => updatePerm("province", e.target.value)}
              className={inputClass}
            >
              <option value="">Select Province</option>
              {PROVINCES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Searchable District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">District *</label>
            <SearchableAddressSelect
              value={perm.district}
              onChange={(val) => updatePerm("district", val)}
              options={permDistrictOptions}
              placeholder={perm.province ? "Search or select district..." : "Select province first"}
              disabled={!perm.province}
              emptyMessage="No district found in this province"
            />
          </div>

          {/* Searchable Local Level / Palika */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Municipality / Local Level *
            </label>
            <SearchableAddressSelect
              value={perm.localLevel}
              onChange={(val) => updatePerm("localLevel", val)}
              options={permPalikaOptions}
              placeholder={perm.district ? "Search or select municipality..." : "Select district first"}
              disabled={!perm.district}
              emptyMessage="No municipality found in this district"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ward No */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Ward Number</label>
            <input
              type="number"
              min={1}
              max={35}
              value={perm.wardNo}
              onChange={(e) => updatePerm("wardNo", e.target.value)}
              placeholder="e.g. 4"
              className={inputClass}
            />
          </div>

          {/* Tole / Street */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Street Address / Tole / House No</label>
            <input
              type="text"
              value={perm.tole}
              onChange={(e) => updatePerm("tole", e.target.value)}
              placeholder="e.g. Patan Dhoka Marg, House #12"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* 2. TEMPORARY ADDRESS */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Temporary Address
              </h4>
              <p className="text-[11px] text-gray-500">
                Current residence address if different from permanent address.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyPermanentToTemporary}
            disabled={!perm.province || !perm.district}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer",
              (!perm.province || !perm.district) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSameAddress ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Same as Permanent</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-[#1e7e47]" />
                <span>Copy from Permanent</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Province */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Province</label>
            <select
              value={temp.province}
              onChange={(e) => updateTemp("province", e.target.value)}
              className={inputClass}
            >
              <option value="">Select Province</option>
              {PROVINCES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Searchable District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">District</label>
            <SearchableAddressSelect
              value={temp.district}
              onChange={(val) => updateTemp("district", val)}
              options={tempDistrictOptions}
              placeholder={temp.province ? "Search or select district..." : "Select province first"}
              disabled={!temp.province}
              emptyMessage="No district found in this province"
            />
          </div>

          {/* Searchable Local Level / Palika */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Municipality / Local Level
            </label>
            <SearchableAddressSelect
              value={temp.localLevel}
              onChange={(val) => updateTemp("localLevel", val)}
              options={tempPalikaOptions}
              placeholder={temp.district ? "Search or select municipality..." : "Select district first"}
              disabled={!temp.district}
              emptyMessage="No municipality found in this district"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ward No */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Ward Number</label>
            <input
              type="number"
              min={1}
              max={35}
              value={temp.wardNo}
              onChange={(e) => updateTemp("wardNo", e.target.value)}
              placeholder="e.g. 4"
              className={inputClass}
            />
          </div>

          {/* Tole / Street */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-700">Street Address / Tole / House No</label>
            <input
              type="text"
              value={temp.tole}
              onChange={(e) => updateTemp("tole", e.target.value)}
              placeholder="e.g. Kumaripati Chowk, House #45"
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
