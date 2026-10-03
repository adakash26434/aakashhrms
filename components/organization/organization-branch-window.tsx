"use client";

import { AddressField } from "@/components/kit/address-field";
import { PhoneField } from "@/components/kit/phone-field";
import { SelectField } from "@/components/kit/select-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { REMOTE_CATEGORIES } from "@/lib/engines/organization.engine";
import type { BranchInput, OrgBranch } from "@/lib/types/organization";
import { Row, TextInput, type FieldsProps } from "./organization-window";

export type BranchForm = BranchInput;

export function branchForm(b?: OrgBranch): BranchForm {
  return {
    code: b?.code ?? "",
    name: b?.name ?? "",
    location: b?.location ?? "",
    phone: b?.phone ?? "",
    email: b?.email ?? "",
    isHeadOffice: b?.isHeadOffice ?? false,
    remoteCategory: b?.remoteCategory || "NONE",
  };
}

/** Branch: an office of the company. Only one is the head office. */
export function BranchFields({ form, set, errors, data, id }: FieldsProps<BranchForm>) {
  const currentHead = data.branches.find((b) => b.isHeadOffice && b.id !== id);
  return (
    <>
      <Row label="Code" required error={errors.code} size="code" help="Short code used in reports and files, e.g. KTM.">
        <TextInput name="code" value={form.code} onChange={(v) => set("code", v)} code upper maxLength={20} placeholder="KTM" />
      </Row>
      <Row label="Branch name" required error={errors.name} size="lg">
        <TextInput name="name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Pokhara Branch" />
      </Row>
      <Row
        label="Head office"
        size="md"
        help={currentHead ? `Yes moves the head office from ${currentHead.name} to this branch.` : "The company's main office."}
        suffix={form.isHeadOffice && currentHead ? <span className="text-warning">replaces {currentHead.name}</span> : undefined}
      >
        <YesNoField name="isHeadOffice" value={form.isHeadOffice} onChange={(v) => set("isHeadOffice", v)} />
      </Row>
      <Row label="Remote area" size="md" error={errors.remoteCategory} help="Remote-area category of the office location, for the remote allowance.">
        <SelectField name="remoteCategory" options={REMOTE_CATEGORIES} value={form.remoteCategory} onChange={(v) => set("remoteCategory", v)} />
      </Row>
      <Row label="Location" required error={errors.location} size="full" span={2} help="Province, district, local level, ward and street of the office.">
        <AddressField name="location" label="Location" required value={form.location} onChange={(v) => set("location", v)} />
      </Row>
      <Row label="Phone" error={errors.phone} size="md" help="Office phone; landlines need the area code (061-4XXXXX).">
        <PhoneField name="phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="061-4XXXXX" />
      </Row>
      <Row label="Email" error={errors.email} size="lg">
        <TextInput name="email" value={form.email} onChange={(v) => set("email", v.trim())} placeholder="pokhara@company.com" maxLength={255} />
      </Row>
    </>
  );
}
