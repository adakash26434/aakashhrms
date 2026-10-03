"use client";

import { useMemo } from "react";
import { Copy } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { FieldRow, inputClass } from "@/components/kit/property-form";
import { getAllDistricts } from "@/lib/constants/nepal-locations";
import type { EmployeeField } from "@/lib/constants/employee-form";
import { FormSection, TextRow, label, type EmployeeFormApi } from "./employee-form-fields";

const DOCUMENTS: { no: EmployeeField; district: EmployeeField; required?: boolean; help?: string }[] = [
  { no: "citizenshipNo", district: "issuingDistrict", required: true },
  { no: "nidNo", district: "nidIssuingDistrict", help: "Optional; 5 to 20 digits." },
  { no: "passportNo", district: "passportIssuingDistrict", help: "Optional." },
  { no: "votersId", district: "voterIdIssuingDistrict", help: "Optional." },
];

/** Identity documents: number and issuing district side by side, then PAN. */
export function EmployeeFormDocuments({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set, patch } = api;
  const districts = useMemo(() => getAllDistricts().map((d) => ({ value: d.name, label: d.name, hint: d.nameNepali })), []);

  const copyDistrict = () => {
    const from = form.issuingDistrict;
    if (!from) return;
    const next: Record<string, string> = {};
    for (const d of DOCUMENTS.slice(1)) if (String(form[d.no] ?? "").trim() && !form[d.district]) next[d.district] = from;
    patch(next);
  };

  return (
    <FormSection
      id="documents"
      title="Identity documents"
      description="Enter the number, then its issuing district."
      aside={
        <button
          type="button"
          data-enter-skip
          onClick={copyDistrict}
          disabled={!form.issuingDistrict}
          title="Fill empty document districts with the citizenship district"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 text-2xs font-medium text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy aria-hidden className="h-3 w-3" /> Copy citizenship district
        </button>
      }
    >
      {DOCUMENTS.map((d) => (
        <FieldRow key={d.no} label={label(d.no)} required={d.required} help={d.help} error={errors[d.no] ?? errors[d.district]}>
          <div className="grid max-w-xl gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <input
              name={d.no}
              aria-label={label(d.no)}
              autoComplete="off"
              spellCheck={false}
              maxLength={50}
              value={String(form[d.no] ?? "")}
              onChange={(e) => set(d.no, e.target.value as never)}
              aria-invalid={errors[d.no] ? true : undefined}
              className={`${inputClass} font-code`}
            />
            {/* An empty optional document skips its district on Enter. */}
            <div data-enter-skip={!d.required && !String(form[d.no] ?? "").trim() ? "" : undefined}>
            <Combobox
              name={d.district}
              aria-label={label(d.district)}
              aria-invalid={errors[d.district] ? true : undefined}
              options={districts}
              value={String(form[d.district] ?? "")}
              onChange={(v) => set(d.district, v as never)}
              placeholder="Issuing district"
              allowClear={!d.required}
            />
            </div>
          </div>
        </FieldRow>
      ))}
      <TextRow
        api={api}
        field="panNumber"
        code
        inputMode="numeric"
        maxLength={9}
        transform={(v) => v.replace(/\D/g, "").slice(0, 9)}
        help="9 digits, issued by the Inland Revenue Department. Needed for TDS reporting."
      />
    </FormSection>
  );
}
