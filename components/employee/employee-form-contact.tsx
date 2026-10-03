"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { FieldRow, inputClass } from "@/components/kit/property-form";
import {
  findProvinceByDistrict,
  getAllDistricts,
  getPalikasByDistrict,
  parseStructuredAddress,
  serializeStructuredAddress,
  type StructuredAddress,
} from "@/lib/constants/nepal-locations";
import { CheckBox, FormSection, TextRow, label, type EmployeeFormApi } from "./employee-form-fields";

/**
 * District first (people know their district), then local level, ward and
 * tole. The province fills itself from the district. Stored in the same
 * structured form as before (serializeStructuredAddress).
 */
function AddressFields({
  name,
  value,
  onChange,
  required,
}: {
  name: "permanentAddress" | "temporaryAddress";
  value: string;
  onChange: (serialized: string) => void;
  required?: boolean;
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
    <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
      <Combobox
        name={`${name}.district`}
        aria-label={`${label(name)}: district`}
        aria-required={required || undefined}
        options={districts}
        value={address.district}
        onChange={(v) => update({ district: v })}
        placeholder="District"
        allowClear={!required}
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
      />
      <input
        name={`${name}.wardNo`}
        aria-label={`${label(name)}: ward number`}
        inputMode="numeric"
        maxLength={2}
        placeholder="Ward no."
        value={address.wardNo}
        onChange={(e) => update({ wardNo: e.target.value.replace(/\D/g, "").slice(0, 2) })}
        className={inputClass}
      />
      <input
        name={`${name}.tole`}
        aria-label={`${label(name)}: tole or street`}
        maxLength={120}
        placeholder="Tole / street"
        value={address.tole}
        onChange={(e) => update({ tole: e.target.value })}
        className={inputClass}
      />
      {province && <p className="text-2xs text-ink-faint sm:col-span-2">{province.name}</p>}
    </div>
  );
}

/** Contact (emails, phones) and addresses. */
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
      <TextRow
        api={api}
        field="companyEmail"
        type="email"
        inputMode="email"
        required
        transform={(v) => v.trim()}
        help="Also the self-service sign-in, if a login is created."
      />
      <TextRow api={api} field="personalEmail" type="email" inputMode="email" transform={(v) => v.trim()} />
      <TextRow api={api} field="mobileNo" type="tel" inputMode="tel" required code placeholder="98XXXXXXXX" help="Nepal numbers need no +977; it is added on save." />
      <TextRow api={api} field="phoneHome" type="tel" inputMode="tel" code placeholder="01-4XXXXXX" />
      <FieldRow label={label("permanentAddress")} required wide error={errors.permanentAddress}>
        <AddressFields name="permanentAddress" required value={form.permanentAddress} onChange={(v) => set("permanentAddress", v)} />
      </FieldRow>
      <FieldRow label={label("temporaryAddress")} wide error={errors.temporaryAddress}>
        <div className="space-y-2">
          <CheckBox skip checked={sameAddress} onChange={onSameAddress} text="Same as permanent address" />
          {!sameAddress && <AddressFields name="temporaryAddress" value={form.temporaryAddress} onChange={(v) => set("temporaryAddress", v)} />}
        </div>
      </FieldRow>
    </FormSection>
  );
}
