"use client";

import { NumberField } from "@/components/kit/number-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import type { EmploymentTypeInput, OrgEmploymentType, OrganizationData } from "@/lib/types/organization";
import { Row, TextInput, type FieldsProps } from "./organization-window";

export type TypeForm = EmploymentTypeInput;

export function typeForm(t: OrgEmploymentType | undefined, data: OrganizationData): TypeForm {
  return {
    code: t?.code ?? "",
    name: t?.name ?? "",
    nameNepali: t?.nameNepali ?? "",
    isPfEligible: t?.isPfEligible ?? true,
    isSsfEligible: t?.isSsfEligible ?? true,
    isFestivalEligible: t?.isFestivalEligible ?? true,
    isLeaveEligible: t?.isLeaveEligible ?? true,
    isOtEligible: t?.isOtEligible ?? true,
    noticePeriodDays: t?.noticePeriodDays ?? 30,
    probationMonths: t?.probationMonths ?? 0,
    rankOrder: t?.rankOrder ?? data.types.reduce((n, x) => Math.max(n, x.rankOrder), 0) + 1,
  };
}

const FLAGS: { key: keyof Pick<TypeForm, "isPfEligible" | "isSsfEligible" | "isFestivalEligible" | "isLeaveEligible" | "isOtEligible">; label: string; help: string }[] = [
  { key: "isSsfEligible", label: "SSF", help: "Social Security Fund contributions (11% employee, 20% employer)." },
  { key: "isPfEligible", label: "Provident fund", help: "Provident fund contributions." },
  { key: "isFestivalEligible", label: "Festival allowance", help: "Dashain / festival allowance." },
  { key: "isLeaveEligible", label: "Paid leave", help: "Earns home and sick leave." },
  { key: "isOtEligible", label: "Overtime", help: "Paid for overtime." },
];

/** Employment type (Permanent, Contract …) and what it entitles people to. */
export function TypeFields({ form, set, errors, data, id }: FieldsProps<TypeForm>) {
  const record = data.types.find((t) => t.id === id);
  return (
    <>
      {record && record.usage.employees > 0 && (
        <p className="col-span-full rounded-md border border-info/25 bg-info-subtle px-2.5 py-1.5 text-xs text-info md:col-span-2">
          {record.usage.employees} employee{record.usage.employees === 1 ? " has" : "s have"} this type. Renaming it updates them too.
        </p>
      )}
      <Row label="Code" required error={errors.code} size="code">
        <TextInput name="code" value={form.code} onChange={(v) => set("code", v)} code upper maxLength={20} placeholder="CONTRACT" />
      </Row>
      <Row label="Name" required error={errors.name} size="md">
        <TextInput name="name" value={form.name} onChange={(v) => set("name", v)} maxLength={50} placeholder="e.g. Contract" />
      </Row>
      <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted md:col-span-2">Eligible for</p>
      {FLAGS.map((f) => (
        <Row key={f.key} label={f.label} size="md" help={f.help}>
          <YesNoField name={f.key} value={form[f.key]} onChange={(v) => set(f.key, v)} />
        </Row>
      ))}
      <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted md:col-span-2">Terms</p>
      <Row label="Notice period" required error={errors.noticePeriodDays} size="xs" suffix="days">
        <NumberField name="noticePeriodDays" decimals={0} value={form.noticePeriodDays} onChange={(v) => set("noticePeriodDays", v)} showZero />
      </Row>
      <Row label="Probation" error={errors.probationMonths} size="xs" suffix="months" help="Usual probation for new employees of this type (0 = none).">
        <NumberField name="probationMonths" decimals={0} value={form.probationMonths} onChange={(v) => set("probationMonths", v)} showZero />
      </Row>
      <Row label="Sort order" error={errors.rankOrder} size="xs" help="Order in lists (lowest first).">
        <NumberField name="rankOrder" decimals={0} value={form.rankOrder} onChange={(v) => set("rankOrder", v)} showZero />
      </Row>
    </>
  );
}
