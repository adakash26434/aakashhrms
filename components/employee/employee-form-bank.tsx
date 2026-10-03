"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { GridField } from "@/components/kit/form-grid";
import { inputClass } from "@/components/kit/property-form";
import { NEPAL_BANKS } from "@/lib/constants/nepal-banks";
import { cn } from "@/lib/utils";
import { FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

/** Account numbers: digits, letters and hyphens only (no spaces). */
export const cleanAccount = (v: string) => v.replace(/[^0-9A-Za-z-]/g, "").slice(0, 30);

/**
 * Bank: where salary is paid. The account number is typed twice when it is
 * new or changed, as finance software does, so a slip of the finger does not
 * send salary to the wrong account. Pasting into the second box is blocked.
 */
export function EmployeeFormBank({
  api,
  confirm,
  onConfirm,
  needsConfirm,
}: {
  api: EmployeeFormApi;
  confirm: string;
  onConfirm: (v: string) => void;
  needsConfirm: boolean;
}) {
  const { form, errors, set } = api;
  const banks = useMemo(() => {
    const list = NEPAL_BANKS.map((b) => ({ value: b.name, label: b.name, hint: b.shortName !== b.name ? b.shortName : undefined, keywords: b.code }));
    // Keep a bank typed in before this list existed.
    if (form.bankName && !list.some((b) => b.value === form.bankName)) list.unshift({ value: form.bankName, label: form.bankName, hint: undefined, keywords: undefined });
    return list;
  }, [form.bankName]);

  return (
    <FormSection id="bank" title="Bank" description="Salary is paid to this account; it goes into the bank transfer file.">
      <GridField label={label("bankName")} required error={errors.bankName} size="lg">
        <Combobox name="bankName" options={banks} value={form.bankName} onChange={(v) => set("bankName", v)} placeholder="Search bank" />
      </GridField>
      <TextField api={api} field="bankBranch" required size="md" placeholder="e.g. New Road" />
      <TextField api={api} field="bankAccountNumber" required code size="md" transform={cleanAccount} />
      {needsConfirm && (
        <GridField label="Re-enter account no." required error={errors.bankAccountConfirm} help="Type the account number again to catch typing mistakes." size="md">
          <input
            name="bankAccountConfirm"
            autoComplete="off"
            spellCheck={false}
            value={confirm}
            onChange={(e) => onConfirm(cleanAccount(e.target.value))}
            onPaste={(e) => e.preventDefault()}
            className={cn(inputClass, "font-code")}
          />
        </GridField>
      )}
    </FormSection>
  );
}
