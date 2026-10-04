"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { submitSalaryChangeAction } from "@/app/actions/salary-structure.actions";
import { EMPTY_LINES, gradeAmountFor, largeChangeWarning, structureTotals, validateLines } from "@/lib/engines/salary-structure.engine";
import { gradeBreakdown } from "@/lib/engines/grade-policy.engine";
import { nepalDateIso } from "@/lib/utils/nepal-time";
import type { RetirementScheme, SalaryStructureData, StructureLines, StructureRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

const SCHEMES = [
  { value: "ssf", label: "SSF (11% + 20%)" },
  { value: "pf", label: "Provident fund" },
  { value: "none", label: "None" },
];

/** Revise one employee's salary: a new dated revision (the old one stays in the history). */
export function SalaryStructureReviseWindow({ row, data, onClose, onSaved }: { row: StructureRow | null; data: SalaryStructureData; onClose: () => void; onSaved: () => void }) {
  if (!row) return null;
  return <ReviseBody key={row.employeeId} row={row} data={data} onClose={onClose} onSaved={onSaved} />;
}

function ReviseBody({ row, data, onClose, onSaved }: { row: StructureRow; data: SalaryStructureData; onClose: () => void; onSaved: () => void }) {
  const level = data.levels.find((l) => l.code === row.levelCode || l.name === row.levelCode);
  const start: StructureLines = row.current?.lines ?? { ...EMPTY_LINES, basic: level?.minSalary ?? 0, scheme: "ssf" };
  const [lines, setLines] = useState<StructureLines>(start);
  const [effectiveFrom, setEffectiveFrom] = useState(nepalDateIso());
  const [reason, setReason] = useState(row.current ? "" : "Starting salary");
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const policy = data.gradePolicy;
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

  const totals = useMemo(() => structureTotals(lines, data.heads, settings), [lines, data.heads, settings.ssfBase, settings.pfPercent]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = row.current?.totals ?? null;
  const check = validateLines(lines, data.heads, level?.minSalary ?? 0);
  const jump = largeChangeWarning(row.current?.lines.basic, lines.basic);
  // Label heads (Basic Salary / Grade Amount) only while this structure holds an amount on them.
  const amountHeads = (type: "allowance" | "deduction") =>
    data.heads.filter((h) => h.kind === "amount" && h.type === type && (!h.labelOnly || (start.amounts[h.id] ?? 0) > 0));
  const computedHeads = data.heads.filter((h) => h.kind === "computed");
  const breakdown = gradeBreakdown(lines.basic, lines.gradeCount, policy ?? undefined);
  const linesChanged = JSON.stringify(lines) !== JSON.stringify(start);
  const dirty = linesChanged || reason !== (row.current ? "" : "Starting salary");
  // A revision that changes nothing is refused by the server; say so before sending.
  const nothingToSend = !!row.current && !linesChanged;

  const save = async () => {
    if (saving) return;
    const local: Record<string, string> = { ...check.errors };
    if (!effectiveFrom) local.effectiveFrom = "Choose the date the change takes effect";
    if (reason.trim().length < 3) local.reason = "Give a short reason";
    setErrors(local);
    if (Object.keys(local).length) {
      setFailure("Some fields need attention.");
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await submitSalaryChangeAction({ kind: "single", effectiveFrom, reason, rows: [{ employeeId: row.employeeId, lines }] });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors?.[row.employeeId] ?? {});
      setFailure(result.error);
      return;
    }
    onSaved();
  };

  const validate = (name: string) => {
    const message = name === "reason" ? (reason.trim().length < 3 ? "Give a short reason" : undefined) : name === "effectiveFrom" ? (!effectiveFrom ? "Choose a date" : undefined) : check.errors[name];
    setErrors((e) => ({ ...e, [name]: message ?? "" }));
    return !message;
  };

  const diff = before ? totals.gross - before.gross : totals.gross;
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={dirty}
      size="xl"
      title={row.current ? `Revise salary · ${row.fullName}` : `New salary structure · ${row.fullName}`}
      description={`${row.employeeCode} · ${row.designationName}${level ? ` · ${level.code}` : ""}. The current salary stays in the history.`}
      footer={
        <>
          {failure ? (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          ) : (
            <span className="mr-auto text-2xs text-ink-muted">
              {nothingToSend
                ? "Change the basic salary, grade or an amount to revise."
                : data.approvalRequired
                  ? "Saved as a change waiting for approval by someone else."
                  : "Takes effect once saved."}
            </span>
          )}
          <WindowButton onClick={onClose} disabled={saving}>
            Cancel
          </WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || nothingToSend}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {data.approvalRequired ? "Send for approval" : "Save revision"}
          </WindowButton>
        </>
      }
    >
      <div className="-mx-4 -my-4 grid @container lg:grid-cols-[minmax(0,1fr)_17rem]">
        <PropertyForm onSubmit={save} enterNavigation={{ validate, end: () => saveRef.current }} className="space-y-0 bg-surface-panel">
          <FormGrid columns={2}>
            <GridField label="Effective from" required error={errors.effectiveFrom} size="date" help="The first day the new salary counts. Payroll uses the revision in force for each month.">
              <DateField name="effectiveFrom" value={effectiveFrom} onChange={setEffectiveFrom} />
            </GridField>
            <GridField label="Reason" required error={errors.reason} size="lg">
              <input name="reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual increment" className={inputClass} />
            </GridField>
            <GridField label="Basic salary" required error={errors.basic} size="amount" help={jump ?? check.warnings.basic} suffix={check.warnings.basic ? <span className="text-warning">below scale</span> : jump ? <span className="text-warning">check</span> : undefined}>
              <NumberField name="basic" prefix="NPR" value={lines.basic} onChange={(v) => update({ basic: v })} />
            </GridField>
            <GridField label="Retirement scheme" error={errors.scheme} size="md" help="SSF (11% employee + 20% employer) or provident fund; payroll works the amounts out.">
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
                    <GridField key={h.id} label={h.labelOnly ? `${h.name} (pay head)` : h.name} error={errors[h.id]} size="amount" help={check.warnings[h.id] ?? h.rule} suffix={check.warnings[h.id] ? <span className="text-warning">check</span> : undefined}>
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
                  <GridField key={h.id} label={h.name} size="md" help={h.rule} suffix={<span className="text-ink-faint">{h.rule}</span>}>
                    <YesNoField name={`computed.${h.id}`} value={lines.computed.includes(h.id)} onChange={(v) => setComputed(h.id, v)} />
                  </GridField>
                ))}
              </>
            )}
          </FormGrid>
        </PropertyForm>

        <aside aria-label="Monthly totals" className="border-t border-line bg-surface px-4 py-4 lg:border-l lg:border-t-0">
          <h3 className="mb-2 text-xs font-semibold text-ink">Monthly, before tax</h3>
          <dl className="space-y-1.5 text-xs">
            {[
              ["Basic + grade", lines.basic + lines.gradeAmount],
              ["Allowances", totals.allowances],
              ["Gross", totals.gross],
              ["Deductions", -totals.deductions],
              [lines.scheme === "ssf" ? "SSF 11% (employee)" : lines.scheme === "pf" ? "PF (employee)" : "Retirement", -totals.retirementEmployee],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className={cn("tabular-nums", label === "Gross" && "font-semibold text-ink")}>
                  <Amount value={value as number} />
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-line pt-1.5">
              <dt className="font-semibold text-ink">Net before tax</dt>
              <dd className="font-semibold tabular-nums">
                <Amount value={totals.netBeforeTax} emphasis />
              </dd>
            </div>
            <div className="flex justify-between gap-2 text-ink-muted">
              <dt>Employer cost</dt>
              <dd className="tabular-nums">
                <Amount value={totals.employerCost} />
              </dd>
            </div>
          </dl>
          <div className="mt-4 rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs">
            <p className="text-ink-muted">{before ? "Change in monthly gross" : "New monthly gross"}</p>
            <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-ink")}>
              {diff > 0 ? "+" : ""}
              <Amount value={diff} />
              {before && before.gross > 0 && <span className="ml-1.5 text-2xs font-medium">({((diff / before.gross) * 100).toFixed(1)}%)</span>}
            </p>
            {before && <p className="mt-1 text-3xs text-ink-faint">Current gross: {before.gross.toLocaleString("en-IN")}</p>}
          </div>
          <p className="mt-3 text-3xs leading-relaxed text-ink-faint">
            Income tax (TDS), overtime, absence and festival / remote allowances are worked out by payroll each month.
          </p>
        </aside>
      </div>
    </Window>
  );
}
