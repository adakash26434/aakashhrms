"use client";

import { useMemo, type ReactNode } from "react";
import { Amount } from "@/components/kit/amount";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { DEFAULT_GRADE_POLICY, calculateTotalGradeAmount, gradeBreakdown } from "@/lib/engines/grade-policy.engine";
import { departmentOpenToBranch } from "@/lib/engines/organization.engine";
import { cn } from "@/lib/utils";
import { ChoiceField, FormSection, YesNo, label, type EmployeeFormApi } from "./employee-form-fields";

/** Job & placement, then Pay (basic salary, grades). */
export function EmployeeFormJob({ api }: { api: EmployeeFormApi }) {
  const { form, errors, set, patch, ctx } = api;
  const policy = ctx.gradePolicy ?? DEFAULT_GRADE_POLICY;
  const gradesOff = policy.calculationMethod === "DISABLED_NO_GRADES";
  const manualPolicy = policy.calculationMethod === "MANUAL_INPUT";
  // Pay is changed only with Salary mapping → Edit (the server checks it again).
  const canEditPay = ctx.canEditPay;
  // Grade amount follows the company grade policy unless it is typed by hand.
  const manualGrade = manualPolicy || form.gradeManual;

  const options = useMemo(
    () => ({
      branches: ctx.branches.map((b) => ({ value: b.id, label: b.name })),
      // Departments are company-wide, or limited to some branches (4.3).
      departments: ctx.departments.filter((d) => departmentOpenToBranch(d, form.branchId) || d.id === form.departmentId).map((d) => ({ value: d.id, label: d.name })),
      designations: ctx.designations
        .filter((d) => !form.departmentId || d.departmentId === form.departmentId)
        .map((d) => ({ value: d.id, label: d.name })),
      shreni: (() => {
        // Older records may hold a level name, or a level no longer in the scale: keep showing it.
        const list = ctx.shreniLevels.map((l) => ({ value: form.shreni === l.name ? l.name : l.code, label: l.name, hint: l.code }));
        if (form.shreni && !list.some((o) => o.value === form.shreni)) list.unshift({ value: form.shreni, label: form.shreni, hint: "current, not in the scale" });
        return list;
      })(),
      supervisors: ctx.supervisors.map((s) => ({ value: s.id, label: s.name, hint: s.employeeCode })),
    }),
    [ctx, form.branchId, form.departmentId, form.shreni]
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
  const breakdown = gradeBreakdown(form.basicSalary || 0, form.gradeCount || 0, policy);
  // Automatic grades always show what the policy gives now (the save stores that, S18);
  // an older saved amount that differs is pointed out instead of silently changed.
  const shownGrade = gradesOff ? 0 : manualGrade || !canEditPay ? form.gradeAmount || 0 : breakdown.amount;
  const staleGrade =
    canEditPay && !gradesOff && !manualGrade && !api.isNew && Math.abs((ctx.initial.gradeAmount || 0) - breakdown.amount) > 0.001 && form.gradeAmount === ctx.initial.gradeAmount;
  const total = (form.basicSalary || 0) + shownGrade;

  return (
    <>
      <FormSection id="job" title="Job & placement">
        <GridField label={label("branchId")} required error={errors.branchId} size="md">
          <Combobox
            name="branchId"
            options={options.branches}
            value={form.branchId}
            onChange={(v) => {
              // A department not open to the new branch is cleared (with its designation).
              const dept = ctx.departments.find((d) => d.id === form.departmentId);
              const keep = !dept || departmentOpenToBranch(dept, v);
              patch({ branchId: v, ...(keep ? {} : { departmentId: "", designationId: "" }) });
            }}
            placeholder="Search branch"
          />
        </GridField>
        <GridField label={label("departmentId")} required error={errors.departmentId} help="Departments open to the chosen branch." size="md">
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
        </GridField>
        <GridField label={label("designationId")} required error={errors.designationId} help="Pick the department first to narrow this list." size="md">
          <Combobox name="designationId" options={options.designations} value={form.designationId} onChange={(v) => set("designationId", v)} placeholder="Search designation" />
        </GridField>
        <GridField
          label={label("shreni")}
          required
          error={errors.shreni}
          help={minSalary ? `Starting salary for this level: NPR ${minSalary.toLocaleString("en-IN")}` : "The grade level (tah) on the salary scale."}
          size="md"
        >
          <Combobox name="shreni" options={options.shreni} value={form.shreni} onChange={changeShreni} placeholder="Search level" />
        </GridField>
        <ChoiceField api={api} field="category" options={ctx.categories} required />
        <GridField label={label("supervisorId")} help="This person's supervisor (line manager)." size="md">
          <Combobox
            name="supervisorId"
            options={options.supervisors}
            value={form.supervisorId}
            onChange={(v) => set("supervisorId", v)}
            placeholder={options.supervisors.length ? "Search supervisor" : "No supervisors yet"}
            allowClear
          />
        </GridField>

        <GridField label={label("joiningDate")} required error={errors.joiningDate} size="date">
          <DateField name="joiningDate" value={form.joiningDate} onChange={(v) => set("joiningDate", v)} />
        </GridField>
        <GridField label={label("confirmationDate")} error={errors.confirmationDate} help="When probation ended, if it has." size="date">
          <DateField name="confirmationDate" value={form.confirmationDate} onChange={(v) => set("confirmationDate", v)} />
        </GridField>
        <YesNo
          api={api}
          field="isSupervisor"
          help="Supervisor / line manager: can be chosen as other employees' supervisor (Reports to) and handles their team's requests, such as leave approvals."
        />
      </FormSection>

      <FormSection
        id="pay"
        title="Pay"
        description={
          canEditPay
            ? "Monthly, in NPR. Allowances and deductions are set in Salary mapping."
            : "Monthly, in NPR. Pay can be changed by users with Salary mapping → Edit."
        }
        aside={
          <p className="text-xs text-ink-muted">
            Total base <Amount value={total} prefix="NPR" emphasis className="ml-1 text-ink" />
          </p>
        }
      >
        <GridField
          label={label("basicSalary")}
          required
          error={errors.basicSalary}
          help={
            !canEditPay
              ? api.isNew
                ? "Starts at the level's starting salary; someone with Salary mapping → Edit can change it."
                : "Set by users with Salary mapping → Edit."
              : belowScale
                ? `Below this level's starting salary (NPR ${minSalary.toLocaleString("en-IN")}).`
                : "Monthly basic salary."
          }
          size="amount"
          suffix={belowScale ? <span className="text-warning">Below scale</span> : undefined}
        >
          <NumberField name="basicSalary" prefix="NPR" value={form.basicSalary ?? 0} onChange={changeBasic} readOnly={!canEditPay} />
        </GridField>
        {!gradesOff && (
          <>
            <GridField
              label={label("gradeCount")}
              error={errors.gradeCount}
              help={breakdown.cap ? `Number of grade steps earned (the policy pays at most ${breakdown.cap}).` : "Number of grade steps earned."}
              size="xs"
            >
              <NumberField name="gradeCount" decimals={0} value={form.gradeCount ?? 0} onChange={changeCount} readOnly={!canEditPay} />
            </GridField>
            {canEditPay && !manualPolicy && (
              <GridField label={label("gradeManual")} help="Yes lets you type the grade amount instead of using the company grade policy; policy changes then leave it alone." size="md">
                <YesNoField name="gradeManual" value={form.gradeManual} onChange={(on) => patch({ gradeManual: on, gradeAmount: on ? shownGrade : breakdown.amount })} />
              </GridField>
            )}
            <GridField
              label={label("gradeAmount")}
              required
              error={errors.gradeAmount}
              help={manualGrade && canEditPay ? "Type the total monthly grade amount." : manualGrade ? "Typed by hand." : "Worked out from the company grade policy."}
              size="amount"
              suffix={manualGrade ? (manualPolicy ? undefined : "by hand") : "auto"}
            >
              <NumberField name="gradeAmount" prefix="NPR" value={shownGrade} onChange={(v) => set("gradeAmount", v)} readOnly={!manualGrade || !canEditPay} />
            </GridField>
          </>
        )}
        {gradesOff && <GridValue label="Grades">Not used by this company&apos;s grade policy</GridValue>}
        <GradeBreakdownPanel
          basic={form.basicSalary || 0}
          breakdown={breakdown}
          manual={manualGrade && !manualPolicy}
          gradesOff={gradesOff}
          gradeAmount={shownGrade}
          staleAmount={staleGrade ? ctx.initial.gradeAmount || 0 : null}
        />
      </FormSection>
    </>
  );
}

/**
 * How the pay adds up (the original form's breakdown card, as a calculation
 * strip): the policy, the value of one grade, the grades paid after the cap,
 * the grade amount with its formula, and the total monthly base.
 */
function GradeBreakdownPanel({
  basic,
  breakdown,
  manual,
  gradesOff,
  gradeAmount,
  staleAmount,
}: {
  basic: number;
  breakdown: ReturnType<typeof gradeBreakdown>;
  manual: boolean;
  gradesOff: boolean;
  gradeAmount: number;
  staleAmount: number | null;
}) {
  const calculates = !gradesOff && !!breakdown.formula;
  const cells: { label: string; value: ReactNode; sub?: ReactNode; warn?: boolean }[] = [{ label: "Grade policy", value: breakdown.methodLabel }];
  if (calculates) {
    cells.push(
      { label: "One grade", value: <Amount value={breakdown.rate} prefix="NPR" />, sub: basic > 0 ? undefined : "Enter the basic salary first" },
      {
        label: "Grades paid",
        value: (
          <span className="tabular-nums">
            {breakdown.counted}
            {breakdown.cap ? <span className="font-normal text-ink-muted"> of max {breakdown.cap}</span> : null}
          </span>
        ),
        sub: breakdown.capped ? `${breakdown.count} entered: only ${breakdown.cap} are paid` : undefined,
        warn: breakdown.capped,
      },
      {
        label: manual ? "Grade amount (by hand)" : "Grade amount",
        value: <Amount value={gradeAmount} prefix="NPR" />,
        sub: manual ? `Policy would give NPR ${breakdown.amount.toLocaleString("en-IN")}` : <span className="font-code">{breakdown.formula}</span>,
      }
    );
  } else if (!gradesOff) {
    cells.push({ label: "Grade amount", value: <Amount value={gradeAmount} prefix="NPR" />, sub: "Typed in" });
  }
  cells.push({ label: "Total monthly base", value: <Amount value={basic + gradeAmount} prefix="NPR" emphasis />, sub: gradesOff ? "Basic salary only" : "Basic + grade" });

  return (
    <div className="md:col-span-2 xl:col-span-3 sm:pl-[calc(8.5rem+0.75rem)]">
      <dl
        aria-label="How the pay is worked out"
        className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-md border border-line-card bg-surface sm:grid-cols-2 sm:divide-y-0 xl:flex xl:divide-x"
      >
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 px-3 py-2 xl:flex-1">
            <dt className="text-3xs font-medium uppercase tracking-wide text-ink-muted">{c.label}</dt>
            <dd className={cn("mt-0.5 text-sm font-semibold text-ink", c.warn && "text-warning")}>{c.value}</dd>
            {c.sub ? <dd className={cn("mt-0.5 truncate text-3xs text-ink-muted", c.warn && "font-medium text-warning")}>{c.sub}</dd> : null}
          </div>
        ))}
      </dl>
      {staleAmount !== null && (
        <p role="status" className="mt-1.5 text-3xs font-medium text-warning">
          The saved grade amount (NPR {staleAmount.toLocaleString("en-IN")}) no longer matches the grade policy. Saving updates it to NPR{" "}
          {breakdown.amount.toLocaleString("en-IN")}.
        </p>
      )}
    </div>
  );
}
