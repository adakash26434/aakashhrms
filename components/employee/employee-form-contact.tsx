"use client";

import { AddressField } from "@/components/kit/address-field";
import { GridField } from "@/components/kit/form-grid";
import { PhoneField } from "@/components/kit/phone-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

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
        <AddressField name="permanentAddress" label={label("permanentAddress")} required value={form.permanentAddress} onChange={(v) => set("permanentAddress", v)} />
      </GridField>
      <GridField label="Temporary address" size="md" help="Same uses the permanent address; Different lets you enter another one.">
        <YesNoField name="temporarySame" value={sameAddress} onChange={onSameAddress} yesLabel="Same" noLabel="Different" className="w-36" />
      </GridField>
      {!sameAddress && (
        <GridField label="Temporary at" error={errors.temporaryAddress} span={3} size="full">
          <AddressField name="temporaryAddress" label="Temporary address" value={form.temporaryAddress} onChange={(v) => set("temporaryAddress", v)} />
        </GridField>
      )}
    </FormSection>
  );
}
