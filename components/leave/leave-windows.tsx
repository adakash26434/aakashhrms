"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Loader2, Save } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { adjustLeaveBalanceAction, createLeaveRequestAction, previewLeaveAction } from "@/app/actions/leave.actions";
import { fmt } from "@/lib/engines/leave.engine";
import type { LeaveHalf, LeavePageData, LeavePerson, LeavePreview, LeaveRuleType } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

type Saved = (text: string) => void;

export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
export const daysText = (n: number) => `${fmt(n)} day${n === 1 ? "" : "s"}`;

function Failure({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
      {text}
    </p>
  );
}

/** Types a person may ask for (active, their gender). The server also checks department / designation. */
export const typesFor = (types: readonly LeaveRuleType[], person: Pick<LeavePerson, "gender"> | null) =>
  types.filter((t) => t.isActive && (!person || t.genderApplicable === "All" || t.genderApplicable === person.gender));

/** Whether to ask about an SSF claim (Labour Act §47: maternity; sickness beyond 12 days). */
export const ssfAsked = (t: LeaveRuleType | undefined) => t?.statutoryCode === "MATERNITY" || t?.statutoryCode === "SICK";

/** The server's count for a request: days counted / skipped with why, pay, balance, and why it can't be made. */
export function LeavePreviewBox({ preview, loading }: { preview: LeavePreview | null; loading: boolean }) {
  const dateText = useDateText();
  if (!preview) {
    return <p className="text-2xs text-ink-muted">{loading ? "Counting…" : "Choose the type and dates to see the days counted."}</p>;
  }
  const { days, paidDays, unpaidDays, detail, skipped, balance, problems, notes } = preview;
  return (
    <div aria-live="polite" className={cn("space-y-2 text-xs", loading && "opacity-60")}>
      <p className="font-semibold text-ink">
        {daysText(days)}
        {unpaidDays > 0 && <span className="font-normal text-ink-muted"> · {fmt(paidDays)} paid, {fmt(unpaidDays)} unpaid</span>}
        {balance && (
          <span className="font-normal text-ink-muted">
            {" "}
            · balance {fmt(balance.now)}
            {balance.waiting ? ` (${fmt(balance.waiting)} waiting)` : ""} → <span className={cn("font-semibold", balance.after < 0 ? "text-danger" : "text-ink")}>{fmt(balance.after)}</span>
          </span>
        )}
      </p>
      {detail.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Days counted">
          {detail.map((d) => (
            <li key={d.date} title={d.pay === "none" ? "Unpaid" : d.pay === "half" ? "Half pay" : "Paid"} className={cn("rounded px-1.5 py-0.5 text-2xs", d.pay === "none" ? "bg-danger-subtle text-danger" : "bg-info-subtle text-info")}>
              {weekday(d.date)} {dateText(d.date)}
              {d.part < 1 ? " ½" : ""}
            </li>
          ))}
        </ul>
      )}
      {skipped.length > 0 && (
        <p className="text-2xs text-ink-muted">
          Not counted: {skipped.map((s) => `${weekday(s.date)} ${dateText(s.date)} (${s.why.replace(/^Holiday: /, "")})`).join(", ")}
        </p>
      )}
      {problems.map((p) => (
        <p key={p} role="alert" className="flex items-start gap-1.5 text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p}
        </p>
      ))}
      {notes.map((n) => (
        <p key={n} className="flex items-start gap-1.5 text-2xs text-ink-muted">
          <Info className="mt-0.5 h-3 w-3 shrink-0" /> {n}
        </p>
      ))}
    </div>
  );
}

/** Asks the server for the preview as the form changes (debounced; the latest answer wins). */
export function useLeavePreview(input: { employeeId?: string; leaveTypeId: string; from: string; to: string; half: string; certificateNote: string }, ask: (input: unknown) => Promise<{ success: true; data: LeavePreview } | { success: false; error: string }>) {
  const [answer, setAnswer] = useState<{ key: string; preview: LeavePreview } | null>(null);
  const key = JSON.stringify(input);
  const ready = !!(input.leaveTypeId && input.from && (input.employeeId === undefined || input.employeeId));
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const timer = setTimeout(async () => {
      const r = await ask({ ...input, to: input.to || input.from, half: input.half || null });
      if (live) setAnswer({ key, preview: r.success ? r.data : { days: 0, paidDays: 0, unpaidDays: 0, detail: [], skipped: [], balance: null, problems: [r.error], notes: [] } });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the input
  }, [key, ready]);
  // The last answer stays (dimmed) while the next one is on its way.
  return { preview: ready ? (answer?.preview ?? null) : null, loading: ready && answer?.key !== key };
}

const HALF_OPTIONS = [
  { value: "", label: "Whole day(s)" },
  { value: "first", label: "First half" },
  { value: "second", label: "Second half" },
];

/** HR raises a leave request for someone in scope; it waits for the supervisor or a leave approver. */
export function NewRequestWindow({ data, onClose, onSaved }: { data: LeavePageData; onClose: () => void; onSaved: Saved }) {
  const [start] = useState(() => ({ employeeId: "", leaveTypeId: "", from: data.today, to: data.today, half: "", reason: "", certificateNote: "", ssfClaim: false }));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const person = data.people.find((p) => p.id === form.employeeId) ?? null;
  const types = typesFor(data.types, person);
  const type = types.find((t) => t.id === form.leaveTypeId);
  const oneDay = form.from === form.to;
  const halfAllowed = !!type?.allowHalfDay && oneDay;
  const { preview, loading } = useLeavePreview(
    { employeeId: form.employeeId, leaveTypeId: form.leaveTypeId, from: form.from, to: form.to, half: halfAllowed ? form.half : "", certificateNote: form.certificateNote },
    previewLeaveAction
  );
  const save = async () => {
    setSaving(true);
    const result = await createLeaveRequestAction({ ...form, half: halfAllowed && form.half ? form.half : null, ssfClaim: ssfAsked(type) && form.ssfClaim });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(`Leave request for ${person?.fullName ?? "the employee"} sent to their supervisor or a leave approver.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="lg"
      title="New leave request"
      description="On an employee's behalf. The days are counted from their own calendar (weekly offs and holidays) and it waits for their supervisor or a leave approver."
      footer={
        <>
          <Failure text={failure} />
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || loading || !!preview?.problems.length}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Send for approval
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -mt-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Employee" required error={errors.employeeId} size="lg">
            <Combobox
              name="employeeId"
              options={data.people.filter((p) => p.id !== data.myEmployeeId).map((p) => ({ value: p.id, label: p.fullName, hint: p.employeeCode }))}
              value={form.employeeId}
              onChange={(v) => set("employeeId", v)}
              placeholder="Search employee"
            />
          </GridField>
          <GridField label="Leave type" required error={errors.leaveTypeId} size="lg">
            <SelectField name="leaveTypeId" options={types.map((t) => ({ value: t.id, label: t.name }))} value={form.leaveTypeId} onChange={(v) => set("leaveTypeId", v)} placeholder="Choose type" />
          </GridField>
          <GridField label="From" required error={errors.from} size="date">
            <DateField name="from" value={form.from} onChange={(v) => setForm((f) => ({ ...f, from: v, to: !f.to || f.to < v ? v : f.to }))} />
          </GridField>
          <GridField label="To" required error={errors.to} size="date">
            <DateField name="to" value={form.to} onChange={(v) => set("to", v)} />
          </GridField>
          {halfAllowed && (
            <GridField label="Part of the day" size="md">
              <SelectField name="half" options={HALF_OPTIONS} value={form.half} onChange={(v) => set("half", v as LeaveHalf | "")} />
            </GridField>
          )}
          <GridField label="Reason" required error={errors.reason} span={2} size="full">
            <input name="reason" value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Fever; family wedding in Pokhara" className={inputClass} />
          </GridField>
          {type?.requiresDocument && (
            <GridField label="Certificate" error={errors.certificateNote} span={2} size="full" help={`Needed after ${type.documentThresholdDays ?? 3} days in a row`}>
              <input name="certificateNote" value={form.certificateNote} maxLength={300} onChange={(e) => set("certificateNote", e.target.value)} placeholder="e.g. Medical certificate from Bir Hospital, Dr. …, 6 Oct" className={inputClass} />
            </GridField>
          )}
          {ssfAsked(type) && (
            <GridField label="SSF claim" size="md" help="The SSF pays enrolled staff for maternity beyond 60 days and sickness beyond 12 (§47). Those days stay unpaid in payroll.">
              <YesNoField name="ssfClaim" value={form.ssfClaim} onChange={(v) => set("ssfClaim", v)} />
            </GridField>
          )}
        </FormGrid>
      </PropertyForm>
      <section aria-label="Days counted" className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
        <LeavePreviewBox preview={preview} loading={loading} />
      </section>
    </Window>
  );
}

/** HR adds days to a balance or takes them away, with a reason. Never their own balance. */
export function AdjustBalanceWindow({ data, person, onClose, onSaved }: { data: LeavePageData; person: LeavePerson; onClose: () => void; onSaved: Saved }) {
  const balanceTypes = typesFor(data.types, person).filter((t) => t.kind === "balance");
  const [start] = useState(() => ({ leaveTypeId: balanceTypes[0]?.id ?? "", direction: "add", days: 1, reason: "" }));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const signedDays = form.direction === "take" ? -form.days : form.days;
  const cell = data.balances.find((b) => b.employee.id === person.id)?.cells.find((c) => c.leaveTypeId === form.leaveTypeId);
  const save = async () => {
    setSaving(true);
    const result = await adjustLeaveBalanceAction({ employeeId: person.id, leaveTypeId: form.leaveTypeId, days: signedDays, reason: form.reason });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    const n = signedDays;
    onSaved(`${daysText(Math.abs(n))} ${n > 0 ? "added to" : "taken from"} ${person.fullName}'s ${balanceTypes.find((t) => t.id === form.leaveTypeId)?.name ?? "leave"}.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="md"
      title={`Adjust balance: ${person.fullName}`}
      description="Adds a line to the leave ledger with your name and reason; lines are never edited or deleted."
      footer={
        <>
          <Failure text={failure} />
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Adjust
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Leave type" required error={errors.leaveTypeId} size="lg">
            <SelectField name="leaveTypeId" options={balanceTypes.map((t) => ({ value: t.id, label: t.name }))} value={form.leaveTypeId} onChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v }))} />
          </GridField>
          <GridField label="Change" required size="md">
            <SelectField
              name="direction"
              options={[
                { value: "add", label: "Add days" },
                { value: "take", label: "Take days away" },
              ]}
              value={form.direction}
              onChange={(v) => setForm((f) => ({ ...f, direction: v }))}
            />
          </GridField>
          <GridField label="Days" required error={errors.days} size="code" help="Whole or half days" suffix={cell ? <span className="whitespace-nowrap text-2xs text-ink-muted">now {fmt(cell.balance)} → {fmt(cell.balance + signedDays)}</span> : null}>
            <NumberField name="days" value={form.days} onChange={(v) => setForm((f) => ({ ...f, days: v }))} decimals={1} max={365} selectOnFocus aria-label="Days" />
          </GridField>
          <GridField label="Reason" required error={errors.reason} span={2} size="full">
            <input name="reason" value={form.reason} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Opening balance from the old system" className={inputClass} />
          </GridField>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}
