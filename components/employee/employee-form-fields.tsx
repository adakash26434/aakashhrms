"use client";

import type { ReactNode } from "react";
import { FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { EMPLOYEE_FIELD_LABELS, type EmployeeField } from "@/lib/constants/employee-form";
import type { EmployeeFormContext, EmployeeFormData, EmployeeValidationErrors } from "@/lib/types/employee";
import { cn } from "@/lib/utils";

/** What every form section receives from employee-form.tsx. */
export interface EmployeeFormApi {
  form: EmployeeFormData;
  errors: EmployeeValidationErrors;
  set: <K extends EmployeeField>(field: K, value: EmployeeFormData[K]) => void;
  patch: (values: Partial<EmployeeFormData>) => void;
  ctx: EmployeeFormContext;
  isNew: boolean;
}

/** One titled block of the form; the id is what the section index jumps to. */
export function FormSection({ id, title, description, aside, children }: { id: string; title: string; description?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div id={`section-${id}`} className="scroll-mt-4">
      <FieldGroup title={title} description={description} aside={aside}>
        {children}
      </FieldGroup>
    </div>
  );
}

export function label(field: EmployeeField): string {
  return EMPLOYEE_FIELD_LABELS[field] ?? field;
}

/** A text field bound to the form by name (the name is what Enter validation checks). */
export function TextRow({
  api,
  field,
  required,
  help,
  placeholder,
  code,
  inputMode,
  maxLength,
  transform,
  type = "text",
  wide,
  error,
}: {
  api: EmployeeFormApi;
  field: EmployeeField;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** Monospaced, for codes, PAN and account numbers. */
  code?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  transform?: (value: string) => string;
  type?: "text" | "email" | "tel";
  wide?: boolean;
  /** Overrides the form error (e.g. a live duplicate hint). */
  error?: string | null;
}) {
  const value = String(api.form[field] ?? "");
  return (
    <FieldRow label={label(field)} required={required} help={help} error={error ?? api.errors[field]} wide={wide}>
      <input
        name={field}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => api.set(field, (transform ? transform(e.target.value) : e.target.value) as never)}
        className={cn(inputClass, code && "font-code")}
      />
    </FieldRow>
  );
}

/** A native select bound to the form. Enter moves on; Alt+↓ or Space opens it. */
export function SelectRow({
  api,
  field,
  options,
  required,
  help,
  placeholder,
}: {
  api: EmployeeFormApi;
  field: EmployeeField;
  options: { value: string; label: string }[];
  required?: boolean;
  help?: string;
  placeholder?: string;
}) {
  return (
    <FieldRow label={label(field)} required={required} help={help} error={api.errors[field]}>
      <select name={field} value={String(api.form[field] ?? "")} onChange={(e) => api.set(field, e.target.value as never)} className={inputClass}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

/** A checkbox row: Space toggles, Enter moves on. */
export function CheckRow({ api, field, text, help }: { api: EmployeeFormApi; field: EmployeeField; text: string; help?: string }) {
  return (
    <FieldRow label={label(field)} help={help}>
      <CheckBox name={field} checked={!!api.form[field]} onChange={(v) => api.set(field, v as never)} text={text} />
    </FieldRow>
  );
}

export function CheckBox({
  name,
  checked,
  onChange,
  text,
  id,
  skip,
  ...aria
}: {
  name?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
  id?: string;
  /** Leave out of the Enter order (a helper toggle). */
  skip?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 pt-1.5 text-sm text-ink">
      <input
        id={id}
        name={name}
        type="checkbox"
        data-enter-skip={skip || undefined}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-(--color-brand)"
        {...aria}
      />
      {text}
    </label>
  );
}
