"use client";

import { FormSection, TextField, type EmployeeFormApi } from "./employee-form-fields";

/** Family: needed for citizenship records and the married tax slab. */
export function EmployeeFormFamily({ api }: { api: EmployeeFormApi }) {
  const married = api.form.taxStatus === "Married";
  return (
    <FormSection id="family" title="Family">
      <TextField api={api} field="fatherName" required size="lg" />
      <TextField api={api} field="motherName" required size="lg" />
      <TextField api={api} field="grandfatherName" required size="lg" />
      <TextField api={api} field="spouseName" required={married} size="lg" help={married ? "Required for the married tax slab." : "Optional."} />
    </FormSection>
  );
}
