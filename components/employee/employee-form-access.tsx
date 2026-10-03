"use client";

import { FieldRow, inputClass } from "@/components/kit/property-form";
import { StatusChip } from "@/components/kit/status-chip";
import type { EmployeeAccessOptions } from "@/lib/services/employee.service";
import { CheckBox, FormSection, type EmployeeFormApi } from "./employee-form-fields";

const ACCESS_STATE = { active: "Active", pending: "Waiting for first sign-in", disabled: "Disabled" } as const;

/** Self-service access: create a login (new / unlinked) or change the linked login's role. */
export function EmployeeFormAccess({
  api,
  options,
  onOptions,
}: {
  api: EmployeeFormApi;
  options: EmployeeAccessOptions;
  onOptions: (next: EmployeeAccessOptions) => void;
}) {
  const { ctx, form } = api;
  const linked = ctx.access;
  const roleSelect = (
    <select
      name="accessRole"
      value={options.roleId ?? ""}
      onChange={(e) => {
        const role = ctx.roles.find((r) => r.id === e.target.value);
        onOptions({ ...options, roleId: role?.id, roleSlug: role?.slug });
      }}
      className={inputClass}
    >
      {ctx.roles.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );

  return (
    <FormSection id="access" title="Self-service access" description="Lets the employee see payslips and apply for leave.">
      {linked ? (
        <>
          <FieldRow label="Login">
            <p className="flex flex-wrap items-center gap-2 pt-1.5 text-sm text-ink">
              {linked.email}
              <StatusChip status={linked.state === "active" ? "active" : linked.state === "pending" ? "pending" : "inactive"} label={ACCESS_STATE[linked.state]} />
            </p>
          </FieldRow>
          <FieldRow label="Role" help="What this person can do after signing in.">
            {roleSelect}
          </FieldRow>
        </>
      ) : (
        <>
          <FieldRow label="Create a login" help={form.companyEmail ? `A temporary password is emailed to ${form.companyEmail}.` : "Needs the company email above."}>
            <CheckBox
              name="accessCreate"
              checked={options.createLogin !== false}
              onChange={(on) => onOptions({ ...options, createLogin: on })}
              text="Yes, create a self-service login"
            />
          </FieldRow>
          {options.createLogin !== false && (
            <FieldRow label="Role" help="Most employees get the standard Employee role.">
              {roleSelect}
            </FieldRow>
          )}
        </>
      )}
    </FormSection>
  );
}
