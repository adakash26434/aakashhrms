"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { GridField } from "@/components/kit/form-grid";
import { inputClass } from "@/components/kit/property-form";
import { YesNoField } from "@/components/kit/yes-no-field";
import {
  findProvinceByDistrict,
  getAllDistricts,
  getPalikasByDistrict,
  parseStructuredAddress,
  serializeStructuredAddress,
  type StructuredAddress,
} from "@/lib/constants/nepal-locations";
import { cn } from "@/lib/utils";
import { FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

/**
 * One address on one row: district first (people know their district), then
 * local level, ward and tole. The province fills itself from the district.
 * Stored in the same structured form as before (serializeStructuredAddress).
 */
function AddressRow({
  name,
  value,
  onChange,
  required,
  id,
}: {
  name: "permanentAddress" | "temporaryAddress";
  value: string;
  onChange: (serialized: string) => void;
  required?: boolean;
  id?: string;
}) {
  const address = parseStructuredAddress(value);
  const districts = useMemo(() => getAllDistricts().map((d) => ({ value: d.name, label: d.name, hint: d.nameNepali })), []);
  const palikas = useMemo(() => getPalikasByDistrict(address.district).map((p) => ({ value: p, label: p })), [address.district]);
  const province = address.district ? findProvinceByDistrict(address.district) : undefined;

  const update = (part: Partial<StructuredAddress>) => {
    const next = { ...address, ...part };
    if (part.district !== undefined && part.district !== address.district) {
      next.province = findProvinceByDistrict(part.district)?.id ?? "";
      next.localLevel = "";
    }
    onChange(next.district || next.localLevel || next.wardNo || next.tole ? serializeStructuredAddress(next) : "");
  };

  return (
    <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-[minmax(9rem,11rem)_minmax(11rem,15rem)_4.5rem_minmax(7rem,14rem)_auto] xl:items-center">
      <Combobox
        name={`${name}.district`}
        aria-label={`${label(name)}: district`}
        aria-required={required || undefined}
        options={districts}
        value={address.district}
        onChange={(v) => update({ district: v })}
        placeholder="District"
        allowClear={!required}
        className="max-w-none"
      />
      <Combobox
        name={`${name}.localLevel`}
        aria-label={`${label(name)}: local level`}
        aria-required={required || undefined}
        options={palikas}
        value={address.localLevel}
        onChange={(v) => update({ localLevel: v })}
        placeholder={address.district ? "Local level (palika)" : "Pick the district first"}
        disabled={!address.district}
        className="max-w-none"
      />
      <input
        id={id}
        name={`${name}.wardNo`}
        aria-label={`${label(name)}: ward number`}
        inputMode="numeric"
        maxLength={2}
        placeholder="Ward"
        value={address.wardNo}
        onChange={(e) => update({ wardNo: e.target.value.replace(/\D/g, "").slice(0, 2) })}
        className={cn(inputClass, "max-w-none")}
      />
      <input
        name={`${name}.tole`}
        aria-label={`${label(name)}: tole or street`}
        maxLength={120}
        placeholder="Tole / street"
        value={address.tole}
        onChange={(e) => update({ tole: e.target.value })}
        className={cn(inputClass, "max-w-none")}
      />
      <span className="col-span-2 truncate text-2xs text-ink-faint xl:col-span-1">{province?.name ?? ""}</span>
    </div>
  );
}

/** Contact (phones, emails) and both addresses. */
export function EmployeeFormContact({
  api,
  sameAddress,
  onSameAddress,
}: {
  api: EmployeeFormApi;
  sameAddress: boolean;
  onSameAddress: (same: boolean) => void;
}) {
  const { form, errors, set } = api;
  return (
    <FormSection id="contact" title="Contact & address">
      <TextField api={api} field="mobileNo" type="tel" inputMode="tel" required code size="code" placeholder="98XXXXXXXX" help="Nepal numbers need no +977; it is added on save." />
      <TextField api={api} field="phoneHome" type="tel" inputMode="tel" code size="code" placeholder="01-4XXXXXX" />
      <TextField
        api={api}
        field="companyEmail"
        type="email"
        inputMode="email"
        required
        size="lg"
        transform={(v) => v.trim()}
        help="Also the self-service sign-in, if a login is created."
      />
      <TextField api={api} field="personalEmail" type="email" inputMode="email" size="lg" transform={(v) => v.trim()} />

      <GridField label={label("permanentAddress")} required error={errors.permanentAddress} span={3} size="full" help="District, then local level, ward and tole. The province fills itself.">
        <AddressRow name="permanentAddress" required value={form.permanentAddress} onChange={(v) => set("permanentAddress", v)} />
      </GridField>
      <GridField label="Temporary address" size="md" help="Same uses the permanent address; Different lets you enter another one.">
        <YesNoField name="temporarySame" value={sameAddress} onChange={onSameAddress} yesLabel="Same" noLabel="Different" className="w-36" />
      </GridField>
      {!sameAddress && (
        <GridField label="Temporary at" error={errors.temporaryAddress} span={3} size="full">
          <AddressRow name="temporaryAddress" value={form.temporaryAddress} onChange={(v) => set("temporaryAddress", v)} />
        </GridField>
      )}
    </FormSection>
  );
}
