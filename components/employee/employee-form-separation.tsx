"use client";

import { DateField } from "@/components/kit/date-field";
import { GridField } from "@/components/kit/form-grid";
import { inputClass } from "@/components/kit/property-form";
import { ChoiceField, FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

export const SEPARATION_TYPES = ["Resignation", "Retirement", "Termination", "Contract End"].map((t) => ({ value: t, label: t }));
export const SEPARATION_PLANS = [
  { value: "Upadan", label: "Upadan (gratuity, Labour Act)" },
  { value: "Gratuity", label: "Gratuity" },
  { value: "Pension", label: "Pension" },
  { value: "None", label: "None" },
];

/**
 * Separation details of an inactive employee, for corrections. Making someone
 * inactive (or active again) is done with the status switch, not here.
 */
export function EmployeeFormSeparation({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set } = api;
  return (
    <FormSection id="separation" title="Separation" description="Recorded when the employee was made inactive. Payroll stops after the last working day.">
      <GridField label={label("informedDate")} error={errors.informedDate} help="When notice was given." size="date">
        <DateField name="informedDate" value={form.informedDate} onChange={(v) => set("informedDate", v)} />
      </GridField>
      <GridField label={label("terminationDate")} required error={errors.terminationDate} size="date">
        <DateField name="terminationDate" value={form.terminationDate} onChange={(v) => set("terminationDate", v)} />
      </GridField>
      <ChoiceField api={api} field="terminationType" options={SEPARATION_TYPES} required />
      <ChoiceField api={api} field="terminationPlan" options={SEPARATION_PLANS} allowEmpty placeholder="Not set" />
      <TextField api={api} field="terminationReason" required size="full" span={2} />
      <GridField label={label("terminationRemarks")} span={3} size="full" help="Enter adds a line; Ctrl+Enter moves on.">
        <textarea
          name="terminationRemarks"
          rows={2}
          maxLength={1000}
          value={form.terminationRemarks}
          onChange={(e) => set("terminationRemarks", e.target.value)}
          className={`${inputClass} h-auto max-w-none py-1.5`}
        />
      </GridField>
    </FormSection>
  );
}
