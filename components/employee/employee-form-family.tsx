"use client";

import { FormSection, TextRow, type EmployeeFormApi } from "./employee-form-fields";

/** Family: needed for citizenship records and the married tax slab. */
export function EmployeeFormFamily({ api }: { api: EmployeeFormApi }) {
  const married = api.form.taxStatus === "Married";
  return (
    <FormSection id="family" title="Family">
      <TextRow api={api} field="fatherName" required />
      <TextRow api={api} field="motherName" required />
      <TextRow api={api} field="grandfatherName" required />
      <TextRow api={api} field="spouseName" required={married} help={married ? "Required for the married tax slab." : "Optional."} />
    </FormSection>
  );
}
