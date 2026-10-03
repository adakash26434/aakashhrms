"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { GridField } from "@/components/kit/form-grid";
import { PhoneField } from "@/components/kit/phone-field";
import { inputClass } from "@/components/kit/property-form";
import { YesNoField } from "@/components/kit/yes-no-field";
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
import { FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

const PROVINCE_OPTIONS = PROVINCES.map((p) => ({ value: p.id, label: p.name, hint: p.nameNepali }));

/**
 * One address, as in the original form: province, district (narrowed to the
 * province), local level, ward and tole. Picking a district first still
 * works: its province fills in. Stored in the same structured form as before
 * (serializeStructuredAddress).
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
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6 xl:grid-cols-[minmax(11rem,12.5rem)_minmax(9rem,12rem)_minmax(11rem,15rem)_4.5rem_minmax(7rem,1fr)] xl:items-center">
      <Combobox
        id={id}
        name={`${name}.province`}
        aria-label={`${label(name)}: province`}
        aria-required={required || undefined}
        options={PROVINCE_OPTIONS}
        value={address.province}
        onChange={(v) => update({ province: v })}
        placeholder="Province"
        allowClear={!required}
        className="max-w-none sm:col-span-3 xl:col-span-1"
      />
      <Combobox
        name={`${name}.district`}
        aria-label={`${label(name)}: district`}
        aria-required={required || undefined}
        options={districts}
        value={address.district}
        onChange={(v) => update({ district: v })}
        placeholder="District"
        allowClear={!required}
        className="max-w-none sm:col-span-3 xl:col-span-1"
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
        className="col-span-2 max-w-none sm:col-span-3 xl:col-span-1"
      />
      <input
        name={`${name}.wardNo`}
        aria-label={`${label(name)}: ward number`}
        inputMode="numeric"
        maxLength={2}
        placeholder="Ward"
        value={address.wardNo}
        onChange={(e) => update({ wardNo: e.target.value.replace(/\D/g, "").slice(0, 2) })}
        className={cn(inputClass, "max-w-none sm:col-span-1")}
      />
      <input
        name={`${name}.tole`}
        aria-label={`${label(name)}: tole or street`}
        maxLength={120}
        placeholder="Tole / street"
        value={address.tole}
        onChange={(e) => update({ tole: e.target.value })}
        className={cn(inputClass, "max-w-none sm:col-span-2 xl:col-span-1")}
      />
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
      <GridField label={label("mobileNo")} required error={errors.mobileNo} size="md" help="Country, then the number. Nepal mobiles have 10 digits starting 96, 97 or 98. Typing +91… switches the country.">
        <PhoneField name="mobileNo" value={form.mobileNo} onChange={(v) => set("mobileNo", v)} placeholder="98XXXXXXXX" />
      </GridField>
      <GridField label={label("phoneHome")} error={errors.phoneHome} size="md" help="Landline or second number; landlines need the area code (01-4412345).">
        <PhoneField name="phoneHome" value={form.phoneHome} onChange={(v) => set("phoneHome", v)} placeholder="01-4XXXXXX" />
      </GridField>
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

      <GridField label={label("permanentAddress")} required error={errors.permanentAddress} span={3} size="full" help="Province, district, local level (palika), ward and tole. Picking a district fills its province.">
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
