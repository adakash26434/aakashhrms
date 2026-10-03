"use client";

import { useMemo } from "react";
import { Combobox } from "./combobox";
import { inputClass } from "./property-form";
import {
  PROVINCES,
  changeAddress,
  getAllDistricts,
  getPalikasByDistrict,
  parseStructuredAddress,
  provinceIdOf,
  serializeStructuredAddress,
  type StructuredAddress,
} from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";

const PROVINCE_OPTIONS = PROVINCES.map((p) => ({ value: p.id, label: p.name, hint: p.nameNepali }));

/**
 * One address, as in the original form: province, district (narrowed to the
 * province), local level, ward and tole. Picking a district first still
 * works: its province fills in. Stored in the same structured form as before
 * (serializeStructuredAddress).
 */
export function AddressField({
  name,
  label,
  value,
  onChange,
  required,
  id,
}: {
  /** Field name prefix; each part is named `${name}.province`, `${name}.district` … (Enter validation reads these). */
  name: string;
  /** Spoken label for the parts ("Permanent address: district"). */
  label: string;
  value: string;
  onChange: (serialized: string) => void;
  required?: boolean;
  id?: string;
}) {
  const parsed = parseStructuredAddress(value);
  const address = { ...parsed, province: provinceIdOf(parsed.province) };
  const districts = useMemo(
    () =>
      getAllDistricts()
        .filter((d) => !address.province || d.provinceId === address.province)
        .map((d) => ({ value: d.name, label: d.name, hint: d.nameNepali })),
    [address.province]
  );
  const palikas = useMemo(() => getPalikasByDistrict(address.district).map((p) => ({ value: p, label: p })), [address.district]);

  const update = (part: Partial<StructuredAddress>) => {
    const next = changeAddress(address, part);
    onChange(next.province || next.district || next.localLevel || next.wardNo || next.tole ? serializeStructuredAddress(next) : "");
  };

  return (
    // Laid out by the space it has (container query), not the screen: one row when wide
    // enough (employee form), two rows in a narrower Window.
    <div className="@container">
      <div className="grid grid-cols-2 gap-1.5 @md:grid-cols-6 @3xl:grid-cols-[minmax(11rem,12.5rem)_minmax(9rem,12rem)_minmax(11rem,15rem)_4.5rem_minmax(7rem,1fr)] @3xl:items-center">
        <Combobox
          id={id}
          name={`${name}.province`}
          aria-label={`${label}: province`}
          aria-required={required || undefined}
          options={PROVINCE_OPTIONS}
          value={address.province}
          onChange={(v) => update({ province: v })}
          placeholder="Province"
          allowClear={!required}
          className="max-w-none @md:col-span-3 @3xl:col-span-1"
        />
        <Combobox
          name={`${name}.district`}
          aria-label={`${label}: district`}
          aria-required={required || undefined}
          options={districts}
          value={address.district}
          onChange={(v) => update({ district: v })}
          placeholder="District"
          allowClear={!required}
          className="max-w-none @md:col-span-3 @3xl:col-span-1"
        />
        <Combobox
          name={`${name}.localLevel`}
          aria-label={`${label}: local level`}
          aria-required={required || undefined}
          options={palikas}
          value={address.localLevel}
          onChange={(v) => update({ localLevel: v })}
          placeholder={address.district ? "Local level (palika)" : "Pick the district first"}
          disabled={!address.district}
          className="col-span-2 max-w-none @md:col-span-3 @3xl:col-span-1"
        />
        <input
          name={`${name}.wardNo`}
          aria-label={`${label}: ward number`}
          inputMode="numeric"
          maxLength={2}
          placeholder="Ward"
          value={address.wardNo}
          onChange={(e) => update({ wardNo: e.target.value.replace(/\D/g, "").slice(0, 2) })}
          className={cn(inputClass, "max-w-none @md:col-span-1")}
        />
        <input
          name={`${name}.tole`}
          aria-label={`${label}: tole or street`}
          maxLength={120}
          placeholder="Tole / street"
          value={address.tole}
          onChange={(e) => update({ tole: e.target.value })}
          className={cn(inputClass, "max-w-none @md:col-span-2 @3xl:col-span-1")}
        />
      </div>
    </div>
  );
}
