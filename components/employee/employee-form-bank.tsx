"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { GridField } from "@/components/kit/form-grid";
import { NEPAL_BANKS } from "@/lib/constants/nepal-banks";
import { FormSection, LOCKED_HELP, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

/** Account numbers: digits, letters and hyphens only (no spaces). */
export const cleanAccount = (v: string) => v.replace(/[^0-9A-Za-z-]/g, "").slice(0, 30);

/** Bank: where salary is paid (typed once; your decision, 2026-10-07). */
export function EmployeeFormBank({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set } = api;
  const banks = useMemo(() => {
    const list = NEPAL_BANKS.map((b) => ({ value: b.name, label: b.name, hint: b.shortName !== b.name ? b.shortName : undefined, keywords: b.code }));
    // Keep a bank typed in before this list existed.
    if (form.bankName && !list.some((b) => b.value === form.bankName)) list.unshift({ value: form.bankName, label: form.bankName, hint: undefined, keywords: undefined });
    return list;
  }, [form.bankName]);

  return (
    <FormSection
      id="bank"
      title="Bank"
      description={
        api.isNew
          ? "Salary is paid to this account; it goes into the bank transfer file."
          : "Salary is paid to this account; it goes into the bank transfer file. A change needs a reason and, unless approvals are off, a second person's approval."
      }
    >
      <GridField label={label("bankName")} required error={errors.bankName} help={api.locked?.has("bankName") ? LOCKED_HELP : undefined} size="lg">
        <Combobox name="bankName" options={banks} value={form.bankName} onChange={(v) => set("bankName", v)} placeholder="Search bank" disabled={!!api.locked?.has("bankName")} />
      </GridField>
      <TextField api={api} field="bankBranch" required size="md" placeholder="e.g. New Road" />
      <TextField api={api} field="bankAccountNumber" required code size="md" transform={cleanAccount} />
    </FormSection>
  );
}
