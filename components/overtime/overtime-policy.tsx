"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Save, Undo2 } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { useDateText } from "@/components/kit/date-cell";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { saveOvertimePolicyAction } from "@/app/actions/overtime.actions";
import { describeRates, describeRounding, otPay, roundMinutes, validatePolicy } from "@/lib/engines/overtime.engine";
import { cn } from "@/lib/utils";
import type { OvertimePolicy, OvertimePolicyData } from "@/lib/types/overtime";

/** The rounding choices: block and mode in one value ("down-15", "nearest-30"). */
const ROUNDING = [
  { value: "0", label: "Not rounded (recommended)" },
  { value: "down-15", label: "Down to whole 15 minutes" },
  { value: "down-30", label: "Down to whole 30 minutes" },
  { value: "nearest-15", label: "To the nearest 15 minutes" },
  { value: "nearest-30", label: "To the nearest 30 minutes" },
];
const roundingValue = (p: OvertimePolicy) => (p.rounding ? `${p.roundingMode}-${p.rounding}` : "0");
/** Days of overtime the comparison table rounds with every choice (minutes). */
const ROUNDING_EXAMPLES = [44, 80, 104];
const asTime = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const choiceOf = (v: string): Pick<OvertimePolicy, "rounding" | "roundingMode"> =>
  v === "0" ? { rounding: 0, roundingMode: "down" } : { rounding: Number(v.split("-")[1]) as OvertimePolicy["rounding"], roundingMode: v.split("-")[0] as OvertimePolicy["roundingMode"] };
const APPROVAL = [
  { value: "required", label: "Approval required (recommended)" },
  { value: "auto", label: "Automatic: pay detected overtime" },
];
/** A worked example on the form: basic 30,000 + grade 2,000, 2 hours on a working day. */
const EXAMPLE = { basic: 30000, minutes: 120 };

/**
 * Policies → Overtime (4.7): the company's one overtime policy. Rates are
 * multiples of basic ÷ 240 (the team's one OT formula), never below the Labour Act's 1.5;
 * eligibility is per employment type and the shortest overtime per shift.
 */
export function OvertimePolicyView({ data, onDone }: { data: OvertimePolicyData; onDone: (text: string) => void }) {
  const [form, setForm] = useState<OvertimePolicy>(data.policy);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const dateText = useDateText();
  const dirty = JSON.stringify(form) !== JSON.stringify(data.policy);
  const local = validatePolicy(form);
  const example = useMemo(() => otPay({ work: EXAMPLE.minutes, off: 0 }, { basic: EXAMPLE.basic, grade: 0 }, form), [form]);
  const readOnly = !data.canEdit;
  const set = <K extends keyof OvertimePolicy>(k: K, v: OvertimePolicy[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const save = async () => {
    if (saving || readOnly) return;
    if (Object.keys(local).length) {
      setErrors(local);
      setFailure("Some fields need attention.");
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await saveOvertimePolicyAction(form);
    setSaving(false);
    if (!result.success) {
      setErrors("validationErrors" in result && result.validationErrors ? result.validationErrors : {});
      setFailure(result.error);
      return;
    }
    onDone(`Overtime policy saved: ${describeRates(form)}; ${describeRounding(form).toLowerCase()}; ${form.approval === "required" ? "approval required" : "paid automatically"}.`);
  };

  const eligible = data.employmentTypes.filter((t) => t.otEligible);
  const notEligible = data.employmentTypes.filter((t) => !t.otEligible);

  return (
    <div className="p-3">
      <Guide
        id="overtime-policy"
        className="mb-3"
        title="How overtime works"
        steps={[
          { title: "Only with consent", text: "Nobody is made to work overtime against their will (Labour Act §29). Approval records that it was agreed." },
          { title: "Paid at least 1.5 times", text: "Hourly rate = basic ÷ 240. Overtime is paid at least 1.5 times that (§31)." },
          { title: "4 hours a day, 24 a week", text: "The law's limits (§30). Hours above them are still paid, but approving them needs a reason." },
          { title: "Weekly offs and holidays", text: "The normal day's hours earn a substitute day off (§42, in Leave). Only the hours beyond a full day are overtime." },
        ]}
      />

      {data.isDefault && (
        <Notice tone="info" className="mb-3" title="Not saved yet">
          These rates come from the old System control settings, and overtime is paid automatically as before. Check them and save to make this the
          company&apos;s overtime policy. Approval is recommended.
        </Notice>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Overtime policy" className="rounded-md border border-line bg-surface">
          <PropertyForm onSubmit={() => void save()} enterNavigation={{ end: () => saveRef.current }} className="space-y-0 bg-surface-panel">
            <FormGrid columns={2}>
              <GridField label="Working day rate" required error={errors.workRate || undefined} size="sm" suffix="× hourly rate" help="Overtime beyond the planned day. Set in Policies → Overtime rates (never below 1.5).">
                <NumberField name="workRate" value={form.workRate} onChange={(v) => set("workRate", v)} readOnly />
              </GridField>
              <GridField label="Weekly off / holiday rate" required error={errors.offRate || undefined} size="sm" suffix="× hourly rate" help="Only hours beyond a full day (the normal hours earn a substitute day off). Set in Policies → Overtime rates.">
                <NumberField name="offRate" value={form.offRate} onChange={(v) => set("offRate", v)} readOnly />
              </GridField>
              <GridField label="Rounding" size="md" help="Each day's overtime is rounded on its own, then the days are added up. The table below shows what every choice pays.">
                <SelectField
                  name="rounding"
                  options={ROUNDING}
                  value={roundingValue(form)}
                  onChange={(v) => setForm((f) => ({ ...f, ...choiceOf(v) }))}
                  disabled={readOnly}
                />
              </GridField>
              <GridField
                label="Approval"
                size="lg"
                help={
                  form.approval === "required"
                    ? "Only overtime approved by the supervisor or HR is paid; the month can't be closed while some waits."
                    : "Detected overtime is paid as it is. Days over the legal limit still wait for HR."
                }
              >
                <SelectField name="approval" options={APPROVAL} value={form.approval} onChange={(v) => set("approval", v as OvertimePolicy["approval"])} disabled={readOnly} />
              </GridField>
            </FormGrid>
          </PropertyForm>
          <div className="border-t border-line px-4 py-3">
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">What each rounding choice pays for one day</p>
            <div className="overflow-x-auto">
              <table className="w-full max-w-2xl text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-line text-left text-2xs text-ink-muted">
                    <th className="py-1 pr-3 font-medium">Choice</th>
                    {ROUNDING_EXAMPLES.map((m) => (
                      <th key={m} className="py-1 pr-3 text-right font-medium">
                        Worked {asTime(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROUNDING.map((o) => {
                    const chosen = o.value === roundingValue(form);
                    return (
                      <tr key={o.value} className={cn("border-b border-line last:border-0", chosen && "bg-brand-subtle font-medium text-ink")}>
                        <td className="py-1 pr-3">
                          {o.label}
                          {chosen && <span className="ml-1.5 text-3xs font-semibold uppercase text-brand-strong">selected</span>}
                        </td>
                        {ROUNDING_EXAMPLES.map((m) => {
                          const paid = roundMinutes(m, choiceOf(o.value));
                          return (
                            <td key={m} className={cn("py-1 pr-3 text-right", paid < m ? "text-danger" : paid > m ? "text-success" : chosen ? "text-ink" : "text-ink-muted")}>
                              {asTime(paid)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-3xs text-ink-faint">Red: fewer minutes paid than worked. Green: more. &quot;Down&quot; pays only full blocks; &quot;nearest&quot; goes up from half a block (8 minutes for 15, 15 minutes for 30).</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-2.5 text-xs">
            <p className="mr-auto text-ink-muted">
              Example: basic {EXAMPLE.basic.toLocaleString("en-IN")} → hourly rate{" "}
              <Amount value={example.hourlyRate} />; 2 hours on a working day = <Amount value={example.amount} emphasis />.
            </p>
            {failure && (
              <span role="alert" className="text-danger">
                {failure}
              </span>
            )}
            {data.canEdit ? (
              <>
                <WindowButton onClick={() => setForm(data.policy)} disabled={!dirty || saving}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo changes
                </WindowButton>
                <WindowButton ref={saveRef} variant="primary" onClick={() => void save()} disabled={(!dirty && !data.isDefault) || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save policy
                </WindowButton>
              </>
            ) : (
              <span className="text-ink-muted">Only a company-wide administrator can change it.</span>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <section aria-label="Who gets overtime" className="rounded-md border border-line bg-surface px-4 py-3 text-xs">
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Who gets overtime</h3>
            <p className="mb-2 text-ink-muted">
              By employment type. Managers can have other benefits instead (§31): mark their type as not eligible.
            </p>
            <ul className="space-y-1">
              {[...eligible, ...notEligible].map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink">{t.name}</span>
                  <StatusChip status={t.otEligible ? "active" : "inactive"} label={t.otEligible ? "Eligible" : "Not eligible"} />
                </li>
              ))}
            </ul>
            <Link href="/workforce/organization?tab=types" className="mt-2 inline-block font-medium text-brand-strong hover:underline">
              Change in Organization → Employment types
            </Link>
          </section>
          <section aria-label="Shortest overtime" className="rounded-md border border-line bg-surface px-4 py-3 text-xs">
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Shortest overtime that counts</h3>
            <ul className="space-y-1">
              {data.shifts.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink">{s.name}</span>
                  <span className="tabular-nums text-ink-muted">{s.otMinimumMinutes} min</span>
                </li>
              ))}
            </ul>
            <Link href="/timeAndLeave/attendance?tab=shifts" className="mt-2 inline-block font-medium text-brand-strong hover:underline">
              Change in Attendance → Shifts
            </Link>
          </section>
          <section aria-label="History" className="rounded-md border border-line bg-surface px-4 py-3 text-xs">
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">History</h3>
            {data.history.length ? (
              <ul className="space-y-2">
                {data.history.map((h) => (
                  <li key={h.at}>
                    <p className="text-ink">{describeRates(h.after)}; {h.after.approval === "required" ? "approval required" : "automatic"}{h.after.rounding ? `; ${describeRounding(h.after).toLowerCase()}` : ""}</p>
                    <p className="text-3xs text-ink-faint">
                      {dateText(h.at.slice(0, 10))} · {h.by}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">No changes saved yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
