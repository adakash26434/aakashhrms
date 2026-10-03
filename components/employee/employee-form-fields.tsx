"use client";

import type { ReactNode } from "react";
import { FieldGroup, inputClass } from "@/components/kit/property-form";
import { FormGrid, GridField, type GridFieldSize } from "@/components/kit/form-grid";
import { SelectField, type SelectOption } from "@/components/kit/select-field";
import { YesNoField } from "@/components/kit/yes-no-field";
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

/** One titled block of the form (a "FastTab"); the id is what the section index jumps to. */
export function FormSection({
  id,
  title,
  description,
  aside,
  children,
  columns = 3,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div id={`section-${id}`} className="scroll-mt-4">
      <FieldGroup title={title} description={description} aside={aside}>
        <FormGrid columns={columns}>{children}</FormGrid>
      </FieldGroup>
    </div>
  );
}

export function label(field: EmployeeField): string {
  return EMPLOYEE_FIELD_LABELS[field] ?? field;
}

/** A text field bound to the form by name (the name is what Enter validation checks). */
export function TextField({
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
  size = "md",
  span,
  error,
  autoFocus,
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
  size?: GridFieldSize;
  span?: 1 | 2 | 3;
  /** Overrides the form error (e.g. a live duplicate hint). */
  error?: string | null;
  autoFocus?: boolean;
}) {
  return (
    <GridField label={label(field)} required={required} help={help} error={error ?? api.errors[field]} size={size} span={span}>
      <input
        name={field}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength ?? 120}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        data-autofocus={autoFocus || undefined}
        value={String(api.form[field] ?? "")}
        onChange={(e) => api.set(field, (transform ? transform(e.target.value) : e.target.value) as never)}
        className={cn(inputClass, code && "font-code")}
      />
    </GridField>
  );
}

/** A drop-down list bound to the form (kit SelectField: works the same with mouse and keyboard). */
export function ChoiceField({
  api,
  field,
  options,
  required,
  help,
  placeholder,
  allowEmpty,
  size = "md",
}: {
  api: EmployeeFormApi;
  field: EmployeeField;
  options: readonly SelectOption[];
  required?: boolean;
  help?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  size?: GridFieldSize;
}) {
  return (
    <GridField label={label(field)} required={required} help={help} error={api.errors[field]} size={size}>
      <SelectField
        name={field}
        options={options}
        value={String(api.form[field] ?? "")}
        onChange={(v) => api.set(field, v as never)}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
      />
    </GridField>
  );
}

/** A Yes / No answer bound to a boolean field. */
export function YesNo({ api, field, help, labelText }: { api: EmployeeFormApi; field: EmployeeField; help?: string; labelText?: string }) {
  return (
    <GridField label={labelText ?? label(field)} help={help} size="md">
      <YesNoField name={field} value={!!api.form[field]} onChange={(v) => api.set(field, v as never)} />
    </GridField>
  );
}
