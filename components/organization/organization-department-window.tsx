"use client";

import { useMemo } from "react";
import { Combobox } from "@/components/kit/combobox";
import { inputClass } from "@/components/kit/property-form";
import { YesNoField } from "@/components/kit/yes-no-field";
import { nextOrgCode } from "@/lib/engines/organization.engine";
import type { DepartmentInput, OrgDepartment, OrganizationData } from "@/lib/types/organization";
import { cn } from "@/lib/utils";
import { Row, TextInput, type FieldsProps } from "./organization-window";

export type DepartmentForm = DepartmentInput & { allBranches: boolean };

export function departmentForm(d: OrgDepartment | undefined, data: OrganizationData): DepartmentForm {
  return {
    code: d?.code ?? nextOrgCode(data.departments.map((x) => x.code), "DEPT"),
    name: d?.name ?? "",
    branchIds: d?.branchIds ?? [],
    allBranches: !d || d.branchIds.length === 0,
    headEmployeeId: d?.headEmployeeId ?? null,
    description: d?.description ?? "",
  };
}

/** Department: a company-wide function (Finance, HR …), open to all branches or to some. */
export function DepartmentFields({ form, set, errors, data, id }: FieldsProps<DepartmentForm>) {
  const record = data.departments.find((d) => d.id === id);
  // Head: active people, supervisors first (Employees → View needed to list them).
  const heads = useMemo(
    () =>
      (data.people ?? [])
        .filter((p) => p.status === "Active" || p.id === form.headEmployeeId)
        .sort((a, b) => Number(b.isSupervisor) - Number(a.isSupervisor) || a.fullName.localeCompare(b.fullName))
        .map((p) => ({ value: p.id, label: p.fullName, hint: `${p.employeeCode}${p.isSupervisor ? " · supervisor" : ""}` })),
    [data.people, form.headEmployeeId]
  );
  const branches = data.branches.filter((b) => b.status === "active" || form.branchIds.includes(b.id));
  const toggleBranch = (branchId: string, on: boolean) =>
    set("branchIds", on ? [...form.branchIds, branchId] : form.branchIds.filter((x) => x !== branchId));

  return (
    <>
      <Row
        label="Code"
        required
        error={errors.code}
        size="code"
        help="Short code for reports, e.g. FIN."
      >
        <TextInput name="code" value={form.code} onChange={(v) => set("code", v)} code upper maxLength={20} />
      </Row>
      <Row label="Department" required error={errors.name} size="lg">
        <TextInput name="name" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Finance & Accounts" />
      </Row>
      <Row
        label="Head"
        error={errors.headEmployeeId}
        size="md"
        help={data.people ? "The employee who leads this department. Supervisors are listed first." : "You need Employees → View to pick the head."}
      >
        <Combobox
          name="headEmployeeId"
          options={heads}
          value={form.headEmployeeId ?? ""}
          onChange={(v) => set("headEmployeeId", v || null)}
          placeholder={!data.people ? "Not available" : record?.headName ? `${record.headName} (typed) – pick an employee` : "Search employee"}
          disabled={!data.people}
          allowClear
        />
      </Row>
      <Row label="All branches" size="md" help="Yes: every branch can use this department. No: choose the branches below.">
        <YesNoField name="allBranches" value={form.allBranches} onChange={(v) => set("allBranches", v)} />
      </Row>
      {!form.allBranches && (
        <Row label="Branches" error={errors.branchIds} size="full" span={2} help="Employees of these branches can be placed in this department.">
          <div role="group" aria-label="Branches" className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {branches.map((b) => (
              <label key={b.id} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  name={`branchIds.${b.id}`}
                  checked={form.branchIds.includes(b.id)}
                  onChange={(e) => toggleBranch(b.id, e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
                {b.name}
                {b.status === "inactive" && <span className="text-3xs text-ink-faint">(inactive)</span>}
              </label>
            ))}
            {!form.branchIds.length && <span className="text-xs text-warning">No branch chosen: nobody could be placed here.</span>}
          </div>
        </Row>
      )}
      <Row label="Description" error={errors.description} size="full" span={2}>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={cn(inputClass, "h-auto max-w-none py-1.5")}
          placeholder="What the department does (optional)"
        />
      </Row>
    </>
  );
}
