"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { checkNewRunAction, generateRunAction, savePayrollRunSettingsAction } from "@/app/actions/payroll-run.actions";
import { BS_MONTHS_EN } from "@/lib/utils/bs-calendar";
import { RUN_TYPE_LABEL } from "@/lib/engines/pay-calendar.engine";
import type { ApprovalPolicy, ApprovalType } from "@/lib/types/approval";
import type { ArrearsCandidate, NewRunInput, PayrollRunsPageData, PreflightResult, RunType } from "@/lib/types/payroll-run";

const AD_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The kinds of run the New run window offers in b1 (arrears and final settlement come with b2 / b3). */
const NEW_RUN_TYPES: { value: RunType; help: string }[] = [
  { value: "REGULAR", help: "The month's pay from attendance and the salary structures." },
  { value: "FESTIVAL_BONUS", help: "Only the festival allowance (Dashain), beside the regular run; taxed once." },
  { value: "ARREARS", help: "Differences for months already paid: a back-dated revision, or attendance corrected after the lock." },
];
const money = (v: string | number) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { cn } from "@/lib/utils";
import { ProblemList } from "./payroll-run-workspace";

function Failure({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
      {text}
    </p>
  );
}

/** A list of things to tick (branches, departments …): the whole set when nothing is ticked. */
function PickList({ label, items, value, onChange, allLabel }: { label: string; items: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void; allLabel: string }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-ink-label">
        {label} <span className="font-normal text-ink-faint">· {value.length ? `${value.length} chosen` : allLabel}</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = value.includes(it.id);
          return (
            <label key={it.id} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs", on ? "border-brand bg-brand-subtle text-ink" : "border-line text-ink-muted hover:bg-surface-sunken")}>
              <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={on} onChange={() => toggle(it.id)} />
              {it.name}
            </label>
          );
        })}
        {!items.length && <span className="text-2xs text-ink-faint">None set up.</span>}
      </div>
    </fieldset>
  );
}

/**
 * New run: the month and the scope, then Check (pre-flight on the server)
 * and Generate once nothing blocks it.
 */
export function NewRunWindow({ data, onClose, onGenerated }: { data: PayrollRunsPageData; onClose: () => void; onGenerated: (runId: string, employees: number) => void }) {
  const [start] = useState<NewRunInput>(() => ({
    runType: "REGULAR",
    payPeriodYear: data.suggested.year,
    payPeriodMonth: data.suggested.month,
    branchIds: data.branches.map((b) => b.id),
    departmentIds: [],
    designationIds: [],
    employeeCategories: [],
    employeeIds: [],
    occasionalAllowanceHeadIds: [],
    payslipDate: null,
    recreateIfExists: false,
  }));
  const [form, setForm] = useState<NewRunInput>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  // Arrears: the employee-months ticked (all by default, blocked ones never).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const checkRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof NewRunInput>(k: K, v: NewRunInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setResult(null);
  };
  const years = useMemo(() => {
    const y = data.suggested.year;
    return [y + 1, y, y - 1, y - 2].map((v) => ({ value: String(v), label: String(v) }));
  }, [data.suggested.year]);
  const months = (data.calendar === "AD" ? AD_MONTHS : BS_MONTHS_EN).slice(1).map((m, i) => ({ value: String(i + 1), label: m }));
  const bonus = form.runType === "FESTIVAL_BONUS";
  const arrears = form.runType === "ARREARS";
  const festivalOptions = data.occasionalAllowances.filter((a) => a.isFestivalAllowance);
  const keyOf = (c: ArrearsCandidate, l: ArrearsCandidate["lines"][number]) => `${c.employeeId}|${l.calendar}|${l.year}|${l.month}`;
  const picks = (): NewRunInput["picks"] =>
    (result?.arrears ?? [])
      .map((c) => ({ employeeId: c.employeeId, months: c.lines.filter((l) => picked.has(keyOf(c, l))).map((l) => ({ calendar: l.calendar, year: l.year, month: l.month, kind: l.kind })) }))
      .filter((p) => p.months.length);
  const employees = useMemo(
    () => data.employees.filter((e) => form.branchIds.includes(e.branchId) && (!form.departmentIds.length || form.departmentIds.includes(e.departmentId)) && (!form.designationIds.length || form.designationIds.includes(e.designationId)) && (!form.employeeCategories.length || form.employeeCategories.includes(e.category))),
    [data.employees, form.branchIds, form.departmentIds, form.designationIds, form.employeeCategories]
  );
  const blocking = result ? result.problems.filter((p) => p.severity === "blocking" && !(form.recreateIfExists && p.code === "run_exists")).length : null;
  const existing = result?.problems.some((p) => p.code === "run_exists") ?? false;

  const check = async () => {
    setChecking(true);
    setFailure(null);
    const r = await checkNewRunAction(form);
    setChecking(false);
    if (!r.success) {
      setErrors(r.validationErrors ?? {});
      setFailure(r.error);
      return;
    }
    setErrors({});
    setResult(r.data ?? null);
    setPicked(new Set((r.data?.arrears ?? []).filter((c) => !c.blocked).flatMap((c) => c.lines.map((l) => keyOf(c, l)))));
  };
  const generate = async () => {
    setGenerating(true);
    setFailure(null);
    const r = await generateRunAction(arrears ? { ...form, picks: picks() } : form);
    setGenerating(false);
    if (!r.success) {
      setErrors(r.validationErrors ?? {});
      setFailure(r.error);
      return;
    }
    onGenerated(r.data!.runId, result?.employees ?? employees.length);
  };
  const busy = checking || generating;
  const nothingPicked = arrears && !picks()?.length;

  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title="New pay run"
      description={`Choose the kind of run, the ${data.calendar === "AD" ? "Gregorian" : "Bikram Sambat"} month and who is paid. Check runs the pre-flight; Generate calculates every payslip as a draft.`}
      footer={
        <>
          <Failure text={failure} />
          <WindowCancel disabled={busy} />
          <WindowButton ref={checkRef} onClick={check} disabled={busy}>
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Check
          </WindowButton>
          <WindowButton variant="primary" onClick={generate} disabled={busy || blocking === null || blocking > 0 || nothingPicked}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Generate
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={check} enterNavigation={{ end: () => checkRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Kind of run" required span={2} size="lg">
            <div role="radiogroup" aria-label="Kind of run" className="flex flex-wrap gap-2">
              {NEW_RUN_TYPES.map((t) => (
                <label key={t.value} className={cn("flex cursor-pointer gap-2 rounded-md border px-3 py-1.5", form.runType === t.value ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken")}>
                  <input type="radio" name="runType" className="mt-0.5 h-3.5 w-3.5 accent-brand" checked={form.runType === t.value} onChange={() => set("runType", t.value)} />
                  <span>
                    <span className="block text-xs font-medium text-ink">{RUN_TYPE_LABEL[t.value]}</span>
                    <span className="block text-2xs text-ink-muted">{t.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </GridField>
          <GridField label="Month" required error={errors.period} size="md">
            <div className="flex gap-2">
              <SelectField name="month" options={months} value={String(form.payPeriodMonth)} onChange={(v) => set("payPeriodMonth", Number(v))} />
              <SelectField name="year" options={years} value={String(form.payPeriodYear)} onChange={(v) => set("payPeriodYear", Number(v))} className="w-24" />
            </div>
          </GridField>
          <GridField label="Payslip date" size="date" help="Printed on the payslips; blank = the day they are locked">
            <DateField name="payslipDate" value={form.payslipDate ?? ""} onChange={(v) => set("payslipDate", v || null)} />
          </GridField>
          <GridField label="Branches" required error={errors.branchIds} span={2} size="lg">
            <PickList label="" items={data.branches} value={form.branchIds} onChange={(v) => set("branchIds", v)} allLabel="none" />
          </GridField>
          <GridField label="Narrow to" span={2} size="lg" help="Leave everything unticked to pay everyone in the branches.">
            <div className="space-y-2">
              <PickList label="Departments" items={data.departments} value={form.departmentIds} onChange={(v) => set("departmentIds", v)} allLabel="all" />
              <PickList label="Designations" items={data.designations} value={form.designationIds} onChange={(v) => set("designationIds", v)} allLabel="all" />
              <PickList label="Employment types" items={data.categories.map((c) => ({ id: c, name: c }))} value={form.employeeCategories} onChange={(v) => set("employeeCategories", v)} allLabel="all" />
            </div>
          </GridField>
          {bonus ? (
            <GridField label="Festival allowance" required span={2} size="lg" help={festivalOptions.length ? undefined : "No pay head is marked as a festival allowance (Setup → Pay heads)."}>
              <PickList label="" items={festivalOptions.map((a) => ({ id: a.id, name: a.name }))} value={form.occasionalAllowanceHeadIds.filter((id) => festivalOptions.some((a) => a.id === id))} onChange={(v) => set("occasionalAllowanceHeadIds", v)} allLabel="none" />
            </GridField>
          ) : data.occasionalAllowances.length > 0 ? (
            <GridField label="This month also pays" span={2} size="lg">
              <PickList label="" items={data.occasionalAllowances.map((a) => ({ id: a.id, name: `${a.name} (${a.isFestivalAllowance ? "festival" : "remote area"})` }))} value={form.occasionalAllowanceHeadIds} onChange={(v) => set("occasionalAllowanceHeadIds", v)} allLabel="none" />
            </GridField>
          ) : null}
          <GridField label="Only these people" span={2} size="lg" help="Optional: a few people instead of everyone in the scope (e.g. a missed joiner).">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-64 flex-1">
                <Combobox name="employee" options={employees.filter((e) => !form.employeeIds.includes(e.id)).map((e) => ({ value: e.id, label: e.name, hint: e.employeeCode }))} value="" onChange={(v) => v && set("employeeIds", [...form.employeeIds, v])} placeholder="Add a person" />
              </div>
              {form.employeeIds.map((id) => {
                const e = data.employees.find((x) => x.id === id);
                return (
                  <button key={id} type="button" className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink hover:bg-surface-sunken" onClick={() => set("employeeIds", form.employeeIds.filter((x) => x !== id))} title="Remove">
                    {e?.name ?? id} <span className="text-ink-faint">×</span>
                  </button>
                );
              })}
            </div>
          </GridField>
        </FormGrid>
        <div className="border-t border-line px-4 py-3 text-xs">
          <p className="text-ink-muted">
            <span className="font-medium text-ink">{employees.length}</span> employee{employees.length === 1 ? "" : "s"} in scope.
            {existing && (
              <label className="ml-3 inline-flex cursor-pointer items-center gap-1.5 text-warning">
                <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={!!form.recreateIfExists} onChange={(e) => setForm((f) => ({ ...f, recreateIfExists: e.target.checked }))} />
                Discard the existing draft and generate again
              </label>
            )}
          </p>
          {result && (
            <div className="mt-2">
              {result.problems.length === 0 ? (
                <p className="font-medium text-success">Pre-flight passed: nothing stops this run.</p>
              ) : (
                <ProblemList result={result} compact />
              )}
            </div>
          )}
          {result?.arrears && result.arrears.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Months with a difference to pay</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-2xs text-ink-muted">
                    <th className="w-6 py-1" />
                    <th className="py-1 pr-2 font-medium">Employee</th>
                    <th className="py-1 pr-2 font-medium">Month</th>
                    <th className="py-1 pr-2 font-medium">Why</th>
                    <th className="py-1 pr-2 text-right font-medium">Paid</th>
                    <th className="py-1 pr-2 text-right font-medium">Due</th>
                    <th className="py-1 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {result.arrears.flatMap((c) =>
                    c.lines.map((l, i) => {
                      const key = keyOf(c, l);
                      const diff = Number(l.diff.grossEarnings);
                      return (
                        <tr key={key} className={cn("border-b border-line last:border-0", c.blocked && "text-ink-faint")}>
                          <td className="py-1">
                            <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={picked.has(key)} disabled={!!c.blocked} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(key); else n.delete(key); return n; })} aria-label={`${c.employeeName} ${l.label}`} />
                          </td>
                          <td className="py-1 pr-2">{i === 0 ? <span className="font-medium text-ink">{c.employeeName} <span className="font-code text-3xs text-ink-faint">{c.employeeCode}</span>{c.blocked && <span className="block text-3xs text-warning">{c.blocked}</span>}</span> : ""}</td>
                          <td className="py-1 pr-2">{l.label}</td>
                          <td className="py-1 pr-2 text-ink-muted">{l.kind === "salary" ? "Salary revision" : "Attendance corrected"}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{money(l.paid.grossEarnings)}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{money(l.due.grossEarnings)}</td>
                          <td className={cn("py-1 text-right font-medium tabular-nums", diff < 0 ? "text-danger" : "text-ink")}>{diff < 0 ? "−" : "+"}{money(Math.abs(diff))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <p className="mt-1 text-3xs text-ink-faint">Gross differences; retirement contributions and CIT follow, income tax is worked out once on the arrears. Untick a month to leave it for later.</p>
            </div>
          )}
        </div>
      </PropertyForm>
    </Window>
  );
}

const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = { none: "No approval", simple: "Simple", multi_level: "Multi-level" };

/** Approval policy for pay runs (simple or multi-level) and the variance threshold. */
export function PayrollSettingsWindow({ data, onClose, onSaved }: { data: PayrollRunsPageData; onClose: () => void; onSaved: () => void }) {
  const initial = { policy: data.policy.type === "none" ? ({ type: "simple", levels: [] } as ApprovalPolicy) : data.policy, thresholdPct: data.varianceThresholdPct, calendar: data.calendar };
  const [policy, setPolicy] = useState<ApprovalPolicy>(initial.policy);
  const [threshold, setThreshold] = useState(initial.thresholdPct);
  const [calendar, setCalendar] = useState<"BS" | "AD">(initial.calendar);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const eligible = data.approvers.filter((a) => a.active && a.canApprove);
  const setLevels = (levels: string[]) => setPolicy((p) => ({ ...p, levels }));
  const move = (i: number, d: -1 | 1) => {
    const next = [...policy.levels];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setLevels(next);
  };
  const save = async () => {
    setSaving(true);
    const r = await savePayrollRunSettingsAction({ policy: { type: policy.type, levels: policy.type === "multi_level" ? policy.levels.filter(Boolean) : [] }, thresholdPct: threshold, calendar });
    setSaving(false);
    if (!r.success) {
      setErrors(r.validationErrors ?? {});
      setFailure(r.error);
      return;
    }
    onSaved();
  };
  const TYPES: { value: ApprovalType; help: string }[] = [
    { value: "simple", help: "Any user with Payroll review → Approve approves it; never the person who prepared it, not even an administrator." },
    { value: "multi_level", help: "Named approvers in order: Level 2 acts only after Level 1. Approved when the last level approves." },
  ];
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify({ policy, thresholdPct: threshold, calendar }) !== JSON.stringify(initial)}
      size="lg"
      title="Payroll settings"
      description="Who approves a run before it can be locked and paid (the person who prepares a run never approves it), what counts as a variance, and the pay calendar."
      footer={
        <>
          <Failure text={failure} />
          <WindowCancel disabled={saving} />
          <WindowButton variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save settings
          </WindowButton>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-ink">Approval type {errors.type && <span className="font-normal text-danger">· {errors.type}</span>}</legend>
        {TYPES.map((t) => (
          <label key={t.value} className={cn("flex cursor-pointer gap-2.5 rounded-md border px-3 py-2", policy.type === t.value ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken")}>
            <input type="radio" name="payroll-approval-type" className="mt-0.5 h-4 w-4 accent-brand" checked={policy.type === t.value} onChange={() => setPolicy({ type: t.value, levels: t.value === "multi_level" ? (policy.levels.length ? policy.levels : [""]) : [] })} />
            <span>
              <span className="block text-sm font-medium text-ink">{APPROVAL_TYPE_LABEL[t.value]}</span>
              <span className="block text-2xs text-ink-muted">{t.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {policy.type === "multi_level" && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-ink">
            Approvers in order {errors.levels && <span className="font-normal text-danger">· {errors.levels}</span>}
          </p>
          <ol className="space-y-2">
            {policy.levels.map((id, i) => {
              const error = errors[`level.${i + 1}`];
              return (
                <li key={i} className="flex flex-wrap items-start gap-2">
                  <span className="mt-1.5 w-16 shrink-0 text-xs font-medium text-ink-label">Level {i + 1}</span>
                  <div className="min-w-56 flex-1">
                    <Combobox name={`level.${i + 1}`} aria-label={`Level ${i + 1} approver`} options={eligible.map((a) => ({ value: a.userId, label: a.name }))} value={id} onChange={(v) => setLevels(policy.levels.map((x, j) => (j === i ? v : x)))} placeholder="Choose an approver" />
                    {error && <p className="mt-0.5 text-2xs text-danger">{error}</p>}
                  </div>
                  <span className="flex gap-1">
                    <WindowButton aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </WindowButton>
                    <WindowButton aria-label="Move down" title="Move down" disabled={i === policy.levels.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </WindowButton>
                    <WindowButton aria-label="Remove level" title="Remove level" disabled={policy.levels.length === 1} onClick={() => setLevels(policy.levels.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </WindowButton>
                  </span>
                </li>
              );
            })}
          </ol>
          {policy.levels.length < 5 && (
            <WindowButton className="mt-2" onClick={() => setLevels([...policy.levels, ""])}>
              <Plus className="h-3.5 w-3.5" /> Add level
            </WindowButton>
          )}
          <p className="mt-2 text-2xs text-ink-muted">A level is skipped when its approver prepared the run. Approvers away can delegate in Users.</p>
        </div>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <label className="block text-xs font-semibold text-ink">
          Variance threshold {errors.thresholdPct && <span className="font-normal text-danger">· {errors.thresholdPct}</span>}
          <div className="mt-1 flex items-center gap-2">
            <NumberField name="thresholdPct" decimals={1} max={50} value={threshold} onChange={setThreshold} className="max-w-24" aria-label="Variance threshold in percent" />
            <span className="text-2xs font-normal text-ink-muted">% change in gross, net, income tax or SSF against the last locked run that an approver must see acknowledged.</span>
          </div>
        </label>
      </div>
      <fieldset className="mt-4 border-t border-line pt-3">
        <legend className="mb-1 text-xs font-semibold text-ink">
          Pay calendar {errors.calendar && <span className="font-normal text-danger">· {errors.calendar}</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["BS", "Bikram Sambat months", "Baisakh … Chaitra (29–32 days). Nepal's usual payroll month."],
              ["AD", "Gregorian months", "January … December (28–31 days). The fiscal year stays Shrawan–Ashadh; its year-end month is July."],
            ] as const
          ).map(([value, label, help]) => (
            <label key={value} className={cn("flex min-w-56 flex-1 cursor-pointer gap-2.5 rounded-md border px-3 py-2", calendar === value ? "border-brand bg-brand-subtle" : "border-line hover:bg-surface-sunken")}>
              <input type="radio" name="pay-calendar" className="mt-0.5 h-4 w-4 accent-brand" checked={calendar === value} onChange={() => setCalendar(value)} />
              <span>
                <span className="block text-sm font-medium text-ink">{label}</span>
                <span className="block text-2xs text-ink-muted">{help}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-2xs text-ink-muted">Attendance months follow the pay calendar. It changes only between months: every attendance month closed, every run locked or discarded.</p>
      </fieldset>
      {eligible.length === 0 && <p className="mt-3 text-2xs text-warning">No active user can approve pay runs yet. Give a role Payroll review → Approve in Roles.</p>}
      <span className="hidden">
        <ShieldCheck className="hidden" />
      </span>
    </Window>
  );
}

/** A short note prompt (reject with a reason, acknowledge a variance, submit with a note). */
export function NoteWindow({ title, description, action, label = "Reason", danger, optional, onClose, onConfirm }: { title: string; description: string; action: string; label?: string; danger?: boolean; optional?: boolean; onClose: () => void; onConfirm: (note: string) => Promise<string | null> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const error = await onConfirm(note);
    setBusy(false);
    if (error) setFailure(error);
  };
  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Failure text={failure} />
          <WindowCancel disabled={busy} />
          <WindowButton variant={danger ? "danger" : "primary"} onClick={go} disabled={busy || (!optional && note.trim().length < 3)}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {action}
          </WindowButton>
        </>
      }
    >
      <label className="block text-xs font-medium text-ink-label">
        {label}
        {optional && <span className="font-normal text-ink-faint"> (optional)</span>}
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={cn(inputClass, "mt-1 max-w-none")} />
      </label>
    </Window>
  );
}
