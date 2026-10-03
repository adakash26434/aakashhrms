"use client";

import { DateField } from "@/components/kit/date-field";
import { FieldRow, inputClass } from "@/components/kit/property-form";
import { FormSection, SelectRow, TextRow, label, type EmployeeFormApi } from "./employee-form-fields";

const TYPES = ["Resignation", "Retirement", "Termination", "Contract End"].map((t) => ({ value: t, label: t }));
const PLANS = [
  { value: "Upadan", label: "Upadan (gratuity, Labour Act)" },
  { value: "Gratuity", label: "Gratuity" },
  { value: "Pension", label: "Pension" },
  { value: "None", label: "None" },
];

/** Separation: shown when the status is Inactive or a separation is already recorded. */
export function EmployeeFormSeparation({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set } = api;
  const required = form.status === "Inactive";
  return (
    <FormSection id="separation" title="Separation" description="Payroll stops after the last working day.">
      <FieldRow label={label("informedDate")} error={errors.informedDate} help="When notice was given.">
        <DateField name="informedDate" value={form.informedDate} onChange={(v) => set("informedDate", v)} />
      </FieldRow>
      <FieldRow label={label("terminationDate")} required={required} error={errors.terminationDate}>
        <DateField name="terminationDate" value={form.terminationDate} onChange={(v) => set("terminationDate", v)} />
      </FieldRow>
      <SelectRow api={api} field="terminationType" options={TYPES} required={required} placeholder="Choose…" />
      <SelectRow api={api} field="terminationPlan" options={PLANS} placeholder="Choose…" />
      <TextRow api={api} field="terminationReason" required={required} wide />
      <FieldRow label={label("terminationRemarks")} wide help="Enter adds a line; Ctrl+Enter moves on.">
        <textarea
          name="terminationRemarks"
          rows={3}
          maxLength={1000}
          value={form.terminationRemarks}
          onChange={(e) => set("terminationRemarks", e.target.value)}
          className={`${inputClass} h-auto max-w-none py-1.5`}
        />
      </FieldRow>
    </FormSection>
  );
}
