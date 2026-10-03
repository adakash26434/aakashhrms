"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { FieldRow, inputClass } from "@/components/kit/property-form";
import { NEPAL_BANKS } from "@/lib/constants/nepal-banks";
import { FormSection, TextRow, label, type EmployeeFormApi } from "./employee-form-fields";

/** Account numbers: digits, letters and hyphens only (no spaces). */
export const cleanAccount = (v: string) => v.replace(/[^0-9A-Za-z-]/g, "").slice(0, 30);

/**
 * Bank: where salary is paid. The account number is typed twice when it is
 * new or changed, as finance software does, so a slip of the finger does not
 * send salary to the wrong account.
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
      <FieldRow label={label("bankName")} required error={errors.bankName}>
        <Combobox name="bankName" options={banks} value={form.bankName} onChange={(v) => set("bankName", v)} placeholder="Search bank" />
      </FieldRow>
      <TextRow api={api} field="bankBranch" required placeholder="e.g. New Road" />
      <TextRow api={api} field="bankAccountNumber" required code transform={cleanAccount} />
      {needsConfirm && (
        <FieldRow label="Re-enter account number" required error={errors.bankAccountConfirm} help="Type it again to catch typing mistakes.">
          <input
            name="bankAccountConfirm"
            autoComplete="off"
            spellCheck={false}
            value={confirm}
            onChange={(e) => onConfirm(cleanAccount(e.target.value))}
            onPaste={(e) => e.preventDefault()}
            className={`${inputClass} font-code`}
          />
        </FieldRow>
      )}
    </FormSection>
  );
}
