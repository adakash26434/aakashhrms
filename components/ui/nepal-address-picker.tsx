"use client";

import React, { useMemo } from "react";
import {
  PROVINCES,
  getDistrictsByProvince,
  getPalikasByDistrict,
  parseStructuredAddress,
  serializeStructuredAddress,
  type StructuredAddress,
} from "@/lib/constants/nepal-locations";
import { Check, Copy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeValidationErrors } from "@/lib/types/employee";

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

          {/* District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">District (जिल्ला) *</label>
            <select
              value={perm.district}
              onChange={(e) => updatePerm("district", e.target.value)}
              disabled={!perm.province}
              className={cn(inputClass, !perm.province && "bg-gray-50 text-gray-400 cursor-not-allowed")}
            >
              <option value="">Select District</option>
              {permDistricts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.nameNepali})
                </option>
              ))}
            </select>
          </div>

          {/* Local Level / Palika */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Local Level (गाउँपालिका / नगरपालिका) *</label>
            <select
              value={perm.localLevel}
              onChange={(e) => updatePerm("localLevel", e.target.value)}
              disabled={!perm.district}
              className={cn(inputClass, !perm.district && "bg-gray-50 text-gray-400 cursor-not-allowed")}
            >
              <option value="">Select Municipality / Palika</option>
              {permPalikas.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
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
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer",
              isSameAddress
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-payroll-primary bg-white text-payroll-primary hover:bg-payroll-primary hover:text-white"
            )}
            title="Click to copy permanent address to temporary address"
          >
            {isSameAddress ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{isSameAddress ? "Same as Permanent Address" : "Copy Permanent Address"}</span>
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

          {/* District */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">District (जिल्ला)</label>
            <select
              value={temp.district}
              onChange={(e) => updateTemp("district", e.target.value)}
              disabled={!temp.province}
              className={cn(inputClass, !temp.province && "bg-gray-50 text-gray-400 cursor-not-allowed")}
            >
              <option value="">Select District</option>
              {tempDistricts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.nameNepali})
                </option>
              ))}
            </select>
          </div>

          {/* Local Level / Palika */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Local Level (गाउँपालिका / नगरपालिका)</label>
            <select
              value={temp.localLevel}
              onChange={(e) => updateTemp("localLevel", e.target.value)}
              disabled={!temp.district}
              className={cn(inputClass, !temp.district && "bg-gray-50 text-gray-400 cursor-not-allowed")}
            >
              <option value="">Select Municipality / Palika</option>
              {tempPalikas.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
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
