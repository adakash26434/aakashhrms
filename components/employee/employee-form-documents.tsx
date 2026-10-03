"use client";

import { useMemo } from "react";
import { Copy } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { inputClass } from "@/components/kit/property-form";
import { getAllDistricts } from "@/lib/constants/nepal-locations";
import type { EmployeeField } from "@/lib/constants/employee-form";
import { cn } from "@/lib/utils";
import { FormSection, TextField, label, type EmployeeFormApi } from "./employee-form-fields";

const DOCUMENTS: { no: EmployeeField; district: EmployeeField; required?: boolean; note: string }[] = [
  { no: "citizenshipNo", district: "issuingDistrict", required: true, note: "Required" },
  { no: "nidNo", district: "nidIssuingDistrict", note: "5 to 20 digits" },
  { no: "passportNo", district: "passportIssuingDistrict", note: "Optional" },
  { no: "votersId", district: "voterIdIssuingDistrict", note: "Optional" },
];

/**
 * Identity documents as a small table, one row per document: number, then
 * issuing district. An empty optional document skips its district on Enter.
 */
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
      <div className="overflow-x-auto md:col-span-2 xl:col-span-3">
        <table className="w-full min-w-[34rem] max-w-3xl border-separate border-spacing-y-1 text-xs">
          <thead>
            <tr className="text-left text-3xs uppercase tracking-wide text-ink-faint">
              <th className="w-[8.5rem] pr-3 text-right font-medium">Document</th>
              <th className="w-56 pr-3 font-medium">Number</th>
              <th className="w-60 pr-3 font-medium">Issuing district</th>
              <th className="font-medium" />
            </tr>
          </thead>
          <tbody>
            {DOCUMENTS.map((d) => {
              const empty = !String(form[d.no] ?? "").trim();
              const error = errors[d.no] ?? errors[d.district];
              return (
                <tr key={d.no} className="align-top">
                  <th scope="row" className="pr-3 pt-1.5 text-right font-normal text-ink-muted">
                    {label(d.no)}
                    {d.required && (
                      <span aria-hidden className="ml-0.5 text-danger">
                        *
                      </span>
                    )}
                  </th>
                  <td className="pr-3">
                    <input
                      name={d.no}
                      aria-label={label(d.no)}
                      aria-required={d.required || undefined}
                      aria-invalid={errors[d.no] ? true : undefined}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={50}
                      value={String(form[d.no] ?? "")}
                      onChange={(e) => set(d.no, e.target.value as never)}
                      className={cn(inputClass, "h-7 max-w-none font-code")}
                    />
                  </td>
                  <td className="pr-3">
                    <div data-enter-skip={!d.required && empty ? "" : undefined}>
                      <Combobox
                        name={d.district}
                        aria-label={label(d.district)}
                        aria-invalid={errors[d.district] ? true : undefined}
                        options={districts}
                        value={String(form[d.district] ?? "")}
                        onChange={(v) => set(d.district, v as never)}
                        placeholder={!d.required && empty ? "—" : "District"}
                        allowClear={!d.required}
                        disabled={!d.required && empty && !form[d.district]}
                        className="max-w-none"
                      />
                    </div>
                  </td>
                  <td className="pt-1.5 text-3xs">
                    {error ? <span role="alert" className="font-medium text-danger">{error}</span> : <span className="text-ink-faint">{d.note}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TextField
        api={api}
        field="panNumber"
        code
        inputMode="numeric"
        maxLength={9}
        size="code"
        transform={(v) => v.replace(/\D/g, "").slice(0, 9)}
        help="9 digits, issued by the Inland Revenue Department. Needed for TDS reporting."
      />
    </FormSection>
  );
}
