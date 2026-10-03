"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { inputClass } from "@/components/kit/property-form";
import { pickable } from "@/lib/engines/organization.engine";
import type { DesignationInput, OrgDesignation } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { Row, TextInput, type FieldsProps } from "./organization-window";

export type DesignationForm = DesignationInput;

export function designationForm(d?: OrgDesignation): DesignationForm {
  return { name: d?.name ?? "", departmentId: d?.departmentId ?? "", description: d?.description ?? "" };
}

/** Designation: a job title within a department. */
export function DesignationFields({ form, set, errors, data }: FieldsProps<DesignationForm>) {
  const departments = useMemo(
    () => pickable(data.departments, form.departmentId).map((d) => ({ value: d.id, label: d.name, hint: d.code })),
    [data.departments, form.departmentId]
  );
  return (
    <>
      <Row label="Designation" required error={errors.name} size="lg" span={2}>
        <TextInput name="name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Senior Accountant" />
      </Row>
      <Row label="Department" required error={errors.departmentId} size="md" span={2}>
        <Combobox name="departmentId" options={departments} value={form.departmentId} onChange={(v) => set("departmentId", v)} placeholder="Search department" />
      </Row>
      <Row label="Description" error={errors.description} size="full" span={2}>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={cn(inputClass, "h-auto max-w-none py-1.5")}
          placeholder="Main duties (optional)"
        />
      </Row>
    </>
  );
}
