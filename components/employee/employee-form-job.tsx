"use client";

import { useMemo, useState } from "react";
import { Amount } from "@/components/kit/amount";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { NumberField } from "@/components/kit/number-field";
import { FieldRow } from "@/components/kit/property-form";
import { DEFAULT_GRADE_POLICY, calculateTotalGradeAmount } from "@/lib/engines/grade-policy.engine";
import { CheckBox, CheckRow, FormSection, SelectRow, label, type EmployeeFormApi } from "./employee-form-fields";

const STATUSES = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive (separated)" },
];

/** Job & placement, then Pay (basic salary, grades). */
export function EmployeeFormJob({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set, patch, ctx } = api;
  const policy = ctx.gradePolicy ?? DEFAULT_GRADE_POLICY;
  const gradesOff = policy.calculationMethod === "DISABLED_NO_GRADES";
  const manualPolicy = policy.calculationMethod === "MANUAL_INPUT";
  // Grade amount follows the company grade policy unless the user types it in.
  const [manualGrade, setManualGrade] = useState(() => manualPolicy || (form.gradeAmount > 0 && !form.gradeCount));

  const options = useMemo(
    () => ({
      branches: ctx.branches.map((b) => ({ value: b.id, label: b.name })),
      departments: ctx.departments.map((d) => ({ value: d.id, label: d.name })),
      designations: ctx.designations
        .filter((d) => !form.departmentId || d.departmentId === form.departmentId)
        .map((d) => ({ value: d.id, label: d.name })),
      shreni: (() => {
        // Older records may hold a level name, or a level no longer in the scale: keep showing it.
        const list = ctx.shreniLevels.map((l) => ({ value: form.shreni === l.name ? l.name : l.code, label: l.name, hint: l.labelNepali }));
        if (form.shreni && !list.some((o) => o.value === form.shreni)) list.unshift({ value: form.shreni, label: form.shreni, hint: "current, not in the scale" });
        return list;
      })(),
      supervisors: ctx.supervisors.map((s) => ({ value: s.id, label: s.name, hint: s.employeeCode })),
    }),
    [ctx, form.departmentId, form.shreni]
  );

  const grade = (basic: number, count: number) => (manualGrade || basic <= 0 ? null : calculateTotalGradeAmount(basic, count, policy));
  const minFor = (code: string) => ctx.shreniLevels.find((l) => l.code === code || l.name === code)?.minSalary ?? 0;

  const changeShreni = (code: string) => {
    // A new level brings its starting salary, unless a different salary was already typed in.
    const previousMin = minFor(form.shreni);
    const basic = !form.basicSalary || form.basicSalary === previousMin ? minFor(code) || form.basicSalary || 0 : form.basicSalary;
    const amount = grade(basic, form.gradeCount || 0);
    patch({ shreni: code, basicSalary: basic, ...(amount !== null ? { gradeAmount: amount } : {}) });
  };
  const changeBasic = (basic: number) => {
    const amount = grade(basic, form.gradeCount || 0);
    patch({ basicSalary: basic, ...(amount !== null ? { gradeAmount: amount } : {}) });
  };
  const changeCount = (count: number) => {
    const amount = grade(form.basicSalary || 0, count);
    patch({ gradeCount: count, ...(amount !== null ? { gradeAmount: amount } : {}) });
  };

  const minSalary = minFor(form.shreni);
  const belowScale = minSalary > 0 && (form.basicSalary ?? 0) > 0 && (form.basicSalary ?? 0) < minSalary;

  return (
    <>
      <FormSection id="job" title="Job & placement">
        <FieldRow label={label("departmentId")} required error={errors.departmentId}>
          <Combobox
            name="departmentId"
            options={options.departments}
            value={form.departmentId}
            onChange={(v) => {
              const keep = ctx.designations.some((d) => d.id === form.designationId && d.departmentId === v);
              patch({ departmentId: v, ...(keep ? {} : { designationId: "" }) });
            }}
            placeholder="Search department"
          />
        </FieldRow>
        <FieldRow label={label("designationId")} required error={errors.designationId} help={form.departmentId ? undefined : "Pick the department first to narrow this list."}>
          <Combobox name="designationId" options={options.designations} value={form.designationId} onChange={(v) => set("designationId", v)} placeholder="Search designation" />
        </FieldRow>
        <FieldRow label={label("branchId")} required error={errors.branchId}>
          <Combobox name="branchId" options={options.branches} value={form.branchId} onChange={(v) => set("branchId", v)} placeholder="Search branch" />
        </FieldRow>
        <FieldRow label={label("shreni")} required error={errors.shreni} help={minSalary ? `Starting salary for this level: NPR ${minSalary.toLocaleString("en-IN")}` : undefined}>
          <Combobox name="shreni" options={options.shreni} value={form.shreni} onChange={changeShreni} placeholder="Search level" />
        </FieldRow>
        <SelectRow api={api} field="category" options={ctx.categories} required />
        <FieldRow label={label("supervisorId")} help="Approves this person's leave.">
          <Combobox
            name="supervisorId"
            options={options.supervisors}
            value={form.supervisorId}
            onChange={(v) => set("supervisorId", v)}
            placeholder={options.supervisors.length ? "Search supervisor" : "No supervisors yet"}
            allowClear
          />
        </FieldRow>
        <CheckRow api={api} field="isSupervisor" text="Yes, can approve leave for a team" />
        <FieldRow label={label("joiningDate")} required error={errors.joiningDate}>
          <DateField name="joiningDate" value={form.joiningDate} onChange={(v) => set("joiningDate", v)} />
        </FieldRow>
        <FieldRow label={label("confirmationDate")} error={errors.confirmationDate} help="When probation ended, if it has.">
          <DateField name="confirmationDate" value={form.confirmationDate} onChange={(v) => set("confirmationDate", v)} />
        </FieldRow>
        <SelectRow
          api={api}
          field="status"
          options={STATUSES}
          required
          help={form.status === "Inactive" ? "Fill in Separation below." : undefined}
        />
      </FormSection>

      <FormSection id="pay" title="Pay" description="Allowances and deductions are set in Salary mapping.">
        <FieldRow
          label={label("basicSalary")}
          required
          error={errors.basicSalary}
          help={belowScale ? `Below this level's starting salary (NPR ${minSalary.toLocaleString("en-IN")}).` : "Monthly, in NPR."}
        >
          <NumberField name="basicSalary" prefix="NPR" value={form.basicSalary ?? 0} onChange={changeBasic} />
        </FieldRow>
        {!gradesOff && (
          <>
            <FieldRow label={label("gradeCount")} error={errors.gradeCount} help="Number of grade steps earned.">
              <NumberField name="gradeCount" decimals={0} value={form.gradeCount ?? 0} onChange={changeCount} className="max-w-28" />
            </FieldRow>
            <FieldRow
              label={label("gradeAmount")}
              required
              error={errors.gradeAmount}
              help={manualGrade ? "Entered by hand." : "Worked out from the company grade policy."}
            >
              <div className="flex flex-wrap items-center gap-3">
                <NumberField name="gradeAmount" prefix="NPR" value={form.gradeAmount ?? 0} onChange={(v) => set("gradeAmount", v)} readOnly={!manualGrade} />
                {!manualPolicy && (
                  <CheckBox
                    skip
                    checked={manualGrade}
                    onChange={(on) => {
                      setManualGrade(on);
                      if (!on) {
                        const amount = calculateTotalGradeAmount(form.basicSalary || 0, form.gradeCount || 0, policy);
                        set("gradeAmount", amount);
                      }
                    }}
                    text="Enter by hand"
                  />
                )}
              </div>
            </FieldRow>
          </>
        )}
        <FieldRow label="Total base pay">
          <p className="pt-1.5 text-sm">
            <Amount value={(form.basicSalary || 0) + (gradesOff ? 0 : form.gradeAmount || 0)} prefix="NPR" emphasis />
            <span className="ml-2 text-2xs text-ink-faint">basic + grade, per month</span>
          </p>
        </FieldRow>
      </FormSection>
    </>
  );
}
