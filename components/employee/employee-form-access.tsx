"use client";

import { GridField, GridValue } from "@/components/kit/form-grid";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { YesNoField } from "@/components/kit/yes-no-field";
import type { EmployeeAccessOptions } from "@/lib/services/employee.service";
import { FormSection, type EmployeeFormApi } from "./employee-form-fields";

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
  // S44: another role needs Users & roles → Edit, and nobody changes the role of their own login.
  const roleHelp =
    ctx.roleChoice === "own_login"
      ? "Your own login: someone else changes its role."
      : ctx.roleChoice === "employee_only"
        ? linked
          ? "Roles are changed under Admin → Users (Users & roles → Edit)."
          : "New logins get the Employee role; another role is given under Admin → Users."
        : "What this person can do after signing in. Most employees get the standard Employee role.";
  const roleField = (
    <GridField label="Role" help={roleHelp} size="md">
      <SelectField
        name="accessRole"
        options={ctx.roles.map((r) => ({ value: r.id, label: r.name }))}
        value={options.roleId ?? ""}
        disabled={ctx.roleChoice !== "any"}
        onChange={(id) => {
          const role = ctx.roles.find((r) => r.id === id);
          onOptions({ ...options, roleId: role?.id, roleSlug: role?.slug });
        }}
      />
    </GridField>
  );

  return (
    <FormSection id="access" title="Self-service access" description="Lets the employee see payslips and apply for leave.">
      {linked ? (
        <>
          <GridValue label="Login">
            <span className="flex flex-wrap items-center gap-2">
              {linked.email}
              <StatusChip status={linked.state === "active" ? "active" : linked.state === "pending" ? "pending" : "inactive"} label={ACCESS_STATE[linked.state]} />
            </span>
          </GridValue>
          {roleField}
        </>
      ) : (
        <>
          <GridField
            label="Create a login"
            help={
              options.createLogin === false
                ? "No login: this person cannot sign in to self-service until one is created."
                : form.companyEmail
                  ? `A temporary password is emailed to ${form.companyEmail}.`
                  : "Needs the company email under Contact."
            }
            size="md"
          >
            <YesNoField name="accessCreate" value={options.createLogin !== false} onChange={(on) => onOptions({ ...options, createLogin: on })} />
          </GridField>
          {options.createLogin !== false && roleField}
        </>
      )}
    </FormSection>
  );
}
