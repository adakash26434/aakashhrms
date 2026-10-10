"use client";

import { useMemo, useRef, useState } from "react";
import { Amount } from "@/components/kit/amount";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { submitSalaryChangeAction } from "@/app/actions/salary-structure.actions";
import type { SubmitResult } from "@/lib/services/salary-structure.service";
import {
  EMPTY_LINES,
  applyTemplate,
  estimatePay,
  gradeAmountFor,
  headAppliesTo,
  largeChangeWarning,
  needsStructure,
  setupEffectiveFrom,
  setupLines,
  templatesFor,
  validateLines,
} from "@/lib/engines/salary-structure.engine";
import { gradeBreakdown } from "@/lib/engines/grade-policy.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { RetirementScheme, SalaryStructureData, StructureLines, StructureRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";
import { SaveButtons, SaveOutcome, saveOutcome } from "./salary-structure-approval";
import { SalaryBreakdown } from "./salary-breakdown";

const SCHEMES = [
  { value: "ssf", label: "SSF (11% + 20%)" },
  { value: "pf", label: "Provident fund" },
  { value: "none", label: "None" },
];

export const SCHEME_HELP = "SSF: 31% is deposited (11% from the salary + 20% from the company); the payslip shows the 20% in earnings and the 31% as a deduction. Payroll works the amounts out.";

/**
 * Revise one employee's salary: a new dated revision (the old one stays in
 * the history). Add new opens it for someone with no structure yet or only
 * basic + grade: a template, the retirement scheme, allowances and deductions.
 */
export function SalaryStructureReviseWindow({ row, data, onClose, onSaved }: { row: StructureRow | null; data: SalaryStructureData; onClose: () => void; onSaved: (result: SubmitResult) => void }) {
  if (!row) return null;
  return <ReviseBody key={row.employeeId} row={row} data={data} onClose={onClose} onSaved={onSaved} />;
}

function ReviseBody({ row, data, onClose, onSaved }: { row: StructureRow; data: SalaryStructureData; onClose: () => void; onSaved: (result: SubmitResult) => void }) {
  const level = data.levels.find((l) => l.code === row.levelCode || l.name === row.levelCode);
  // Adding (Add new): no structure yet, or basic + grade only from the employee form.
  const setup = needsStructure(row);
  const policy = data.gradePolicy;
  const start: StructureLines = row.current?.lines ?? { ...EMPTY_LINES, basic: level?.minSalary ?? 0 };
  const { fitting, other } = templatesFor(data.templates, row);
  // Adding for someone with no salary yet: the template's basic applies (else basic + grade are kept).
  const addOpts = { levelStart: row.current ? null : level?.minSalary ?? 0, employee: row };
  // Set-up starts from the first template that fits and the expected scheme.
  const [initial] = useState(() => {
    const template = setup ? fitting[0] ?? null : null;
    return {
      templateId: template?.id ?? "",
      lines: setup ? setupLines(start, template, row.ssfExpected, data.heads, policy, addOpts) : start,
      effectiveFrom: setup ? setupEffectiveFrom(row.joiningDate, row.employeeId, data.finalisedUntil) : nepalDateIso(),
      reason: setup ? "Salary structure set up" : "",
    };
  });
  const [lines, setLines] = useState<StructureLines>(initial.lines);
  const [templateId, setTemplateId] = useState(initial.templateId);
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom);
  const [reason, setReason] = useState(initial.reason);
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<false | "submit" | "approve">(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const manualPolicy = policy?.calculationMethod === "MANUAL_INPUT";
  const gradesOff = policy?.calculationMethod === "DISABLED_NO_GRADES";
  const settings = { ssfBase: data.ssfBase, pfPercent: data.pfPercent };

  const update = (part: Partial<StructureLines>) =>
    setLines((l) => {
      const next = { ...l, ...part };
      return { ...next, gradeAmount: gradeAmountFor(next, policy) };
    });
  const setAmount = (id: string, v: number) => setLines((l) => ({ ...l, amounts: { ...l.amounts, [id]: v } }));
  const setComputed = (id: string, on: boolean) => setLines((l) => ({ ...l, computed: on ? [...new Set([...l.computed, id])] : l.computed.filter((x) => x !== id) }));

  // As payroll would pay it, income tax estimated (the same calculatePayslip).
  const totals = useMemo(() => estimatePay(lines, data.heads, row.profile, data.tax, settings), [lines, data.heads, row.profile, data.tax, settings.ssfBase, settings.pfPercent]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = row.current?.totals ?? null;
  const check = validateLines(lines, data.heads, level?.minSalary ?? 0);
  const jump = largeChangeWarning(row.current?.lines.basic, lines.basic);
  // Heads for this employee (Pay heads → applicable departments / designations); one already
  // held outside its list stays, with a warning. Label heads (Basic Salary / Grade Amount)
  // only while this structure holds an amount on them.
  const forMe = (id: string) => headAppliesTo(data.heads.find((h) => h.id === id)!, row);
  const held = (id: string) => (start.amounts[id] ?? 0) > 0 || (lines.amounts[id] ?? 0) > 0 || start.computed.includes(id) || lines.computed.includes(id);
  const amountHeads = (type: "allowance" | "deduction") =>
    data.heads.filter((h) => h.kind === "amount" && h.type === type && (!h.labelOnly || (start.amounts[h.id] ?? 0) > 0) && (forMe(h.id) || held(h.id)));
  const computedHeads = data.heads.filter((h) => h.kind === "computed" && (forMe(h.id) || held(h.id)));
  const notForMe = (id: string) => (forMe(id) ? undefined : "This pay head is set for other departments / designations (Pay heads)");
  const breakdown = gradeBreakdown(lines.basic, lines.gradeCount, policy ?? undefined);
  const linesChanged = JSON.stringify(lines) !== JSON.stringify(start);
  const dirty = JSON.stringify(lines) !== JSON.stringify(initial.lines) || reason !== initial.reason || effectiveFrom !== initial.effectiveFrom;
  // A revision that changes nothing is refused by the server; say so before sending.
  // Set-up may confirm basic + grade unchanged.
  const nothingToSend = !!row.current && !linesChanged && !setup;

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const t = data.templates.find((x) => x.id === id) ?? null;
    if (setup) setLines(setupLines(start, t, row.ssfExpected, data.heads, policy, addOpts));
    else if (t) setLines((l) => applyTemplate(t, l, data.heads, level?.minSalary ?? 0, policy, row));
  };
  const templateOptions = [
    { value: "", label: setup ? "None (basic + grade only)" : "None" },
    ...fitting.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` })),
    ...other.map((t) => ({ value: t.id, label: `${t.name} (${t.code}) · other level / designation` })),
  ];
  // Same rules as the server: what saving does.
  const outcome = saveOutcome(data, [row.employeeId]);

  const save = async (approveNow = false) => {
    if (saving) return;
    const local: Record<string, string> = { ...check.errors };
    if (!effectiveFrom) local.effectiveFrom = "Choose the date the change takes effect";
    if (reason.trim().length < 3) local.reason = "Give a short reason";
    setErrors(local);
    if (Object.keys(local).length) {
      setFailure("Some fields need attention.");
      return;
    }
    setSaving(approveNow ? "approve" : "submit");
    setFailure(null);
    const result = await submitSalaryChangeAction({ kind: setup ? "setup" : "single", effectiveFrom, reason, rows: [{ employeeId: row.employeeId, lines }] }, { approveNow });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors?.[row.employeeId] ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(result.data);
  };

  const validate = (name: string) => {
    const message = name === "reason" ? (reason.trim().length < 3 ? "Give a short reason" : undefined) : name === "effectiveFrom" ? (!effectiveFrom ? "Choose a date" : undefined) : check.errors[name];
    setErrors((e) => ({ ...e, [name]: message ?? "" }));
    return !message;
  };

  const diff = before ? totals.totalSalary - before.totalSalary : totals.totalSalary;
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="xl"
      title={setup ? `Add salary structure · ${row.fullName}` : `Revise salary · ${row.fullName}`}
      description={`${row.employeeCode} · ${row.designationName}${level ? ` · ${level.code}` : ""}. ${
        !setup
          ? "The current salary stays in the history."
          : row.current
            ? "Basic and grade come from the employee form; add the scheme, allowances and deductions (or save as it is to confirm none apply)."
            : `No salary yet: ${level?.minSalary ? "the basic starts at the level's scale" : "type the basic salary"}, then add the grade, scheme, allowances and deductions.`
      }`}
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            nothingToSend ? (
              <span className="mr-auto text-2xs text-ink-muted">Change the basic salary, grade or an amount to revise.</span>
            ) : (
              <SaveOutcome data={data} outcome={outcome} className="mr-auto" />
            )
          )}
          <WindowCancel disabled={!!saving} />
          <SaveButtons outcome={outcome} saving={saving} disabled={nothingToSend} onSave={(now) => void save(now)} submitRef={saveRef} plainLabel={setup ? "Save structure" : "Save revision"} />
        </>
      }
    >
      <div className="-mx-4 -my-4 grid @container lg:grid-cols-[minmax(0,1fr)_17rem]">
        <PropertyForm onSubmit={() => void save(false)} enterNavigation={{ validate, end: () => saveRef.current }} className="space-y-0 bg-surface-panel">
          <FormGrid columns={2}>
            {data.templates.some((t) => t.isActive) && (
              <GridField label="Template" size="lg" span={2} help={
                  !row.levelKnown
                    ? `This employee's level ("${row.levelCode}") is not in Setup → Levels, so no template by level fits. Correct the level in the employee record.`
                    : fitting.length
                      ? "Templates for this level / designation are listed first. A template replaces the allowances and deductions (and fills the scheme); you can change any amount."
                      : "No template is set for this level / designation (Templates tab)."
                }>
                <SelectField name="template" options={templateOptions} value={templateId} onChange={chooseTemplate} />
              </GridField>
            )}
            <GridField label="Effective from" required error={errors.effectiveFrom || undefined} size="date" help="Payroll uses the revision in force at each month's end, so a change counts for the whole month it falls in. A date in a month already approved or locked pays the difference as arrears in the next run.">
              <DateField name="effectiveFrom" value={effectiveFrom} onChange={setEffectiveFrom} />
            </GridField>
            <GridField label="Reason" required error={errors.reason} size="lg">
              <input name="reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual increment" className={inputClass} />
            </GridField>
            <GridField label="Basic salary" required error={errors.basic} size="amount" help={jump ?? check.warnings.basic} suffix={check.warnings.basic ? <span className="text-warning">below scale</span> : jump ? <span className="text-warning">check</span> : undefined}>
              <NumberField name="basic" prefix="NPR" value={lines.basic} onChange={(v) => update({ basic: v })} />
            </GridField>
            <GridField label="Retirement scheme" error={errors.scheme} size="md" help={setup && row.ssfExpected && lines.scheme !== "ssf" ? `The company has SSF and ${row.category || "this employment type"} is eligible. ${SCHEME_HELP}` : SCHEME_HELP}>
              <SelectField name="scheme" options={SCHEMES} value={lines.scheme} onChange={(v) => update({ scheme: v as RetirementScheme })} />
            </GridField>
            {!gradesOff && (
              <>
                <GridField label="Grade count" error={errors.gradeCount} size="xs">
                  <NumberField name="gradeCount" decimals={0} value={lines.gradeCount} onChange={(v) => update({ gradeCount: v })} showZero />
                </GridField>
                {!manualPolicy && (
                  <GridField label="Grade by hand" size="md" help="Yes lets you type the grade amount instead of using the grade policy.">
                    <YesNoField name="gradeManual" value={lines.gradeManual} onChange={(v) => update({ gradeManual: v })} />
                  </GridField>
                )}
                <GridField label="Grade amount" error={errors.gradeAmount} size="amount" suffix={lines.gradeManual || manualPolicy ? "by hand" : breakdown.formula ? <span className="font-code">{breakdown.formula}</span> : "auto"}>
                  <NumberField name="gradeAmount" prefix="NPR" value={lines.gradeAmount} onChange={(v) => setLines((l) => ({ ...l, gradeAmount: v }))} readOnly={!(lines.gradeManual || manualPolicy)} />
                </GridField>
              </>
            )}
            {(["allowance", "deduction"] as const).map((type) =>
              amountHeads(type).length ? (
                <div key={type} className="contents">
                  <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                    {type === "allowance" ? "Allowances (monthly)" : "Deductions (monthly)"}
                  </p>
                  {amountHeads(type).map((h) => (
                    <GridField key={h.id} label={h.labelOnly ? `${h.name} (pay head)` : h.name} error={errors[h.id]} size="amount" help={check.warnings[h.id] ?? notForMe(h.id) ?? h.rule} suffix={check.warnings[h.id] || notForMe(h.id) ? <span className="text-warning">check</span> : undefined}>
                      <NumberField name={`head.${h.id}`} prefix="NPR" value={lines.amounts[h.id] ?? 0} onChange={(v) => setAmount(h.id, v)} />
                    </GridField>
                  ))}
                </div>
              ) : null
            )}
            {computedHeads.length > 0 && (
              <>
                <p className="col-span-full border-t border-line pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Worked out by payroll</p>
                {computedHeads.map((h) => (
                  <GridField key={h.id} label={h.name} size="md" help={notForMe(h.id) ?? h.rule} suffix={<span className={notForMe(h.id) ? "text-warning" : "text-ink-faint"}>{h.rule}</span>}>
                    <YesNoField name={`computed.${h.id}`} value={lines.computed.includes(h.id)} onChange={(v) => setComputed(h.id, v)} />
                  </GridField>
                ))}
              </>
            )}
          </FormGrid>
        </PropertyForm>

        <aside aria-label="Monthly breakdown" className="border-t border-line bg-surface px-4 py-4 lg:border-l lg:border-t-0">
          <SalaryBreakdown totals={totals} lines={lines} heads={data.heads} />
          <div className="mt-4 rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs">
            <p className="text-ink-muted">{before ? "Change in total salary" : "New total salary"}</p>
            <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-ink")}>
              {diff > 0 ? "+" : ""}
              <Amount value={diff} />
              {before && before.totalSalary > 0 && <span className="ml-1.5 text-2xs font-medium">({((diff / before.totalSalary) * 100).toFixed(1)}%)</span>}
            </p>
            {before && <p className="mt-1 text-3xs text-ink-faint">Current total salary: {before.totalSalary.toLocaleString("en-IN")}</p>}
          </div>
        </aside>
      </div>
    </Window>
  );
}
