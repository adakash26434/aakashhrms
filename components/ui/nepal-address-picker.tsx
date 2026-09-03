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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={cn(
          "w-full rounded-lg border bg-white px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer select-none",
          hasError
            ? "border-red-500 ring-1 ring-red-500/20"
            : "border-payroll-light hover:border-payroll-primary/60",
          open && "border-payroll-primary ring-1 ring-payroll-primary/20",
          disabled && "bg-gray-50 text-gray-400 cursor-not-allowed border-payroll-light/60"
        )}
      >
        <div className="truncate flex-1 pr-2">
          {selectedOption ? (
            <span className="text-payroll-navy font-medium">
              {selectedOption.label}
              {selectedOption.labelNepali ? (
                <span className="text-gray-400 text-xs ml-1.5 font-normal">
                  ({selectedOption.labelNepali})
                </span>
              ) : null}
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
              className="p-0.5 hover:text-gray-600 rounded"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronsUpDown className="w-4 h-4" />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-payroll-light bg-white shadow-payroll-md overflow-hidden animate-[fadeIn_100ms_ease-out]">
          <div className="p-2 border-b border-payroll-light/80 bg-payroll-cream/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter..."
              className="w-full bg-transparent text-xs text-payroll-navy placeholder-gray-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-payroll-light/30">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value.toLowerCase() === (value || "").toLowerCase();
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-lg flex items-center justify-between cursor-pointer transition-colors",
                      isSelected
                        ? "bg-payroll-primary/10 text-payroll-primary font-semibold"
                        : "text-payroll-navy hover:bg-payroll-cream/80"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{opt.label}</span>
                      {opt.labelNepali && (
                        <span className="text-[11px] text-gray-400">
                          ({opt.labelNepali})
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-payroll-primary shrink-0" />}
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
    "w-full rounded-lg border border-payroll-light bg-white px-3 py-2 text-sm text-payroll-navy focus:border-payroll-primary focus:outline-none focus:ring-1 focus:ring-payroll-primary";

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
      <div className="rounded-xl border border-payroll-light/80 bg-white p-4 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-payroll-light pb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-payroll-primary">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
              Permanent Address (स्थायी ठेगाना) *
            </h4>
            <p className="text-[11px] text-gray-500">
              Official address as recorded on Citizenship / NID card.
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
            <label className="text-xs font-medium text-gray-600">Province (प्रदेश) *</label>
            <select
              value={perm.province}
              onChange={(e) => updatePerm("province", e.target.value)}
              className={inputClass}
            >
              <option value="">Select Province</option>
              {PROVINCES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.nameNepali})
                </option>
              ))}
            </select>
          </div>

          {/* Searchable District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">District (जिल्ला) *</label>
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
            <label className="text-xs font-medium text-gray-600">
              Local Level (गाउँपालिका / नगरपालिका) *
            </label>
            <SearchableAddressSelect
              value={perm.localLevel}
              onChange={(val) => updatePerm("localLevel", val)}
              options={permPalikaOptions}
              placeholder={perm.district ? "Search or select municipality / palika..." : "Select district first"}
              disabled={!perm.district}
              emptyMessage="No municipality/palika found in this district"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ward No */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Ward No. (वडा नं.)</label>
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
            <label className="text-xs font-medium text-gray-600">Tole / Street / House No. (टोल / सडक)</label>
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
      <div className="rounded-xl border border-payroll-light/80 bg-payroll-cream/60 p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-payroll-light pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-payroll-navy">
                Temporary Address (अस्थायी ठेगाना)
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
              "inline-flex items-center gap-1.5 rounded-lg border border-payroll-light bg-white px-2.5 py-1 text-xs font-medium text-payroll-navy shadow-2xs hover:bg-payroll-cream transition-colors",
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
                <Copy className="h-3.5 w-3.5 text-payroll-primary" />
                <span>Copy from Permanent</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Province */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Province (प्रदेश)</label>
            <select
              value={temp.province}
              onChange={(e) => updateTemp("province", e.target.value)}
              className={inputClass}
            >
              <option value="">Select Province</option>
              {PROVINCES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.nameNepali})
                </option>
              ))}
            </select>
          </div>

          {/* Searchable District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">District (जिल्ला)</label>
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
            <label className="text-xs font-medium text-gray-600">
              Local Level (गाउँपालिका / नगरपालिका)
            </label>
            <SearchableAddressSelect
              value={temp.localLevel}
              onChange={(val) => updateTemp("localLevel", val)}
              options={tempPalikaOptions}
              placeholder={temp.district ? "Search or select municipality / palika..." : "Select district first"}
              disabled={!temp.district}
              emptyMessage="No municipality/palika found in this district"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ward No */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Ward No. (वडा नं.)</label>
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
            <label className="text-xs font-medium text-gray-600">Tole / Street / House No. (टोल / सडक)</label>
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
