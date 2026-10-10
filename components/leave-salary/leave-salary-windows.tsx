"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Combobox } from "@/components/kit/combobox";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { cancelLeaveSalaryAction, prepareDueLeaveSalaryAction, prepareLeaveSalaryAction, previewLeaveSalaryAction, updateLeaveSalaryAction } from "@/app/actions/leave-salary.actions";
import type { LeaveSalaryDue, LeaveSalaryPage, LeaveSalaryPreview, LeaveSalaryRow } from "@/lib/types/leave-salary";

// Leave salary (4.9): the windows. The server works out every amount and checks everything again
// (scope, the balance in force, leaving employees, S21); these windows collect what is typed and
// show what the server says.

type Fail = { success: false; error: string; validationErrors?: Record<string, string> };
const errorsOf = (r: Fail) => ("validationErrors" in r && r.validationErrors) || {};
const days = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
const rs = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A new encashment from the balance, or a draft (year-end drafts change only the pay month and note). */
export function EncashmentWindow({
  data,
  record,
  onClose,
  onSaved,
}: {
  data: LeaveSalaryPage;
  record: LeaveSalaryRow | null;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const yearEnd = record?.source === "year_end";
  const [form, setForm] = useState({
    employeeId: record?.employeeId ?? "",
    leaveTypeId: record?.leaveTypeId ?? (data.types.length === 1 ? data.types[0].id : ""),
    days: record?.days ?? 0,
    payMonth: record && data.payMonths.some((m) => m.value === record.payMonth) ? record.payMonth : (data.payMonths[0]?.value ?? ""),
    note: record?.note ?? "",
  });
  const [preview, setPreview] = useState<LeaveSalaryPreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  // The server works out the balance in force, the rate and the amount as the form is filled.
  const { employeeId, leaveTypeId, days: chosen } = form;
  useEffect(() => {
    if (yearEnd || !employeeId || !leaveTypeId) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await previewLeaveSalaryAction({ employeeId, leaveTypeId, days: chosen });
      if (live && r.success) setPreview(r.data);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [yearEnd, employeeId, leaveTypeId, chosen]);
  const shown = !yearEnd && employeeId && leaveTypeId ? preview : null;

  const save = () =>
    start(async () => {
      setError(null);
      const r = record ? await updateLeaveSalaryAction(record.id, form) : await prepareLeaveSalaryAction(form);
      if (r.success) onSaved(record ? "Draft saved." : `Prepared: ${rs(Number(r.data.amount))}. Someone else approves it.`);
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={record ? `Edit draft · ${record.employeeName}` : "New leave encashment"}
      description={yearEnd ? "Days over the limit when the leave year opened: only the pay month and the note change." : "Days paid out from the balance in force. They leave the balance when approved."}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {record ? "Save" : "Prepare"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {shown?.problem && <Notice tone="warning">{shown.problem}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Leave paid out">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox
                options={data.employees.map((e) => ({ value: e.id, label: e.name, hint: e.code, keywords: e.code }))}
                value={form.employeeId}
                onChange={(v) => set("employeeId", v)}
                disabled={!!record}
                placeholder="Type a name or code"
              />
            </FieldRow>
            <FieldRow label="Leave" required error={errors.leaveTypeId} help={data.types.find((t) => t.id === form.leaveTypeId)?.rateText}>
              <SelectField
                options={(record && !data.types.some((t) => t.id === record.leaveTypeId) ? [{ value: record.leaveTypeId, label: record.leaveTypeName }] : []).concat(data.types.map((t) => ({ value: t.id, label: t.name })))}
                value={form.leaveTypeId}
                onChange={(v) => set("leaveTypeId", v)}
                disabled={!!record}
                placeholder="Choose"
              />
            </FieldRow>
            <FieldRow
              label="Days"
              required
              error={errors.days}
              help={yearEnd ? "From the year's opening; it can't change." : shown ? `Available now: ${days(shown.available)}${shown.leaveYear ? ` (${shown.leaveYear})` : ""}` : "Whole or half days"}
            >
              <NumberField value={form.days} onChange={(v) => set("days", v)} decimals={1} readOnly={yearEnd} />
            </FieldRow>
            <FieldRow label="Amount" help={shown?.perDayRate ? `${rs(shown.perDayRate)} a day (basic in force ${rs(shown.basicSalary ?? 0)})` : record ? "Worked out again when saved." : undefined}>
              <span className="text-sm">
                {shown?.amount != null ? <Amount value={shown.amount} prefix="NPR" emphasis /> : record ? <Amount value={record.amount} prefix="NPR" emphasis /> : <span className="text-ink-faint">—</span>}
              </span>
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Payment">
            <FieldRow label="Pay with" required error={errors.payMonth} help="That month's regular pay run pays it — or the next one, if that run is already final. Taxed through the payslip.">
              <SelectField options={data.payMonths.map((m) => ({ value: m.value, label: `${m.label} pay run` }))} value={form.payMonth} onChange={(v) => set("payMonth", v)} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note} wide>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

/** Drafts for the chosen days over the limit at a year's opening. */
export function PrepareDueWindow({
  data,
  lines,
  onClose,
  onDone,
}: {
  data: LeaveSalaryPage;
  lines: LeaveSalaryDue[];
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [payMonth, setPayMonth] = useState(data.payMonths[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = lines.filter((l) => !l.problem);
  const total = ready.reduce((sum, l) => sum + (l.amount ?? 0), 0);

  const prepare = () =>
    start(async () => {
      setError(null);
      const r = await prepareDueLeaveSalaryAction({ lineIds: ready.map((l) => l.lineId), payMonth, note });
      if (r.success) {
        const skipped = r.data.skipped.length ? ` Not prepared: ${r.data.skipped.join("; ")}` : "";
        onDone(`${r.data.prepared} prepared for approval.${skipped}`);
      } else setError(("validationErrors" in r && r.validationErrors?.payMonth) || r.error);
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`Prepare ${ready.length} payout${ready.length === 1 ? "" : "s"}`}
      description="Days over the limit when the leave year opened (Labour Act §49). They are already off the balance; these drafts pay them."
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={prepare} disabled={pending || !ready.length}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Prepare
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {ready.length < lines.length && <Notice tone="warning">{lines.length - ready.length} of the chosen can&apos;t be prepared now and are left out (see why in the list).</Notice>}
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2 text-xs">
          {ready.map((l) => (
            <li key={l.lineId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                {l.employeeName} <span className="text-ink-faint">· {l.leaveTypeName} · {days(l.days)}</span>
              </span>
              <Amount value={l.amount ?? 0} />
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-ink-muted">Total</span>
          <Amount value={total} prefix="NPR" emphasis />
        </p>
        <PropertyForm>
          <FieldGroup title="Payment">
            <FieldRow label="Pay with" required help="That month's regular pay run pays them — or the next one, if that run is already final.">
              <SelectField options={data.payMonths.map((m) => ({ value: m.value, label: `${m.label} pay run` }))} value={payMonth} onChange={setPayMonth} />
            </FieldRow>
            <FieldRow label="Note" wide>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

/** Cancels an approved record no pay run has taken: a balance encashment's days come back. */
export function CancelWindow({ record, onClose, onDone }: { record: LeaveSalaryRow; onClose: () => void; onDone: (text: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancel = () =>
    start(async () => {
      setError(null);
      const r = await cancelLeaveSalaryAction(record.id, reason);
      if (r.success) onDone(record.source === "balance" ? `Cancelled: ${days(record.days)} back on ${record.employeeName}'s balance.` : "Cancelled: the days can be prepared again.");
      else setError(("validationErrors" in r && r.validationErrors?.reason) || r.error);
    });
  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`Cancel leave salary · ${record.employeeName}`}
      description={`${record.leaveTypeName}: ${days(record.days)}, ${rs(record.amount)}. ${record.source === "balance" ? "The days come back on the balance." : "The days can be prepared again."}`}
      size="sm"
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Keep it
          </WindowButton>
          <WindowButton variant="danger" onClick={cancel} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cancel leave salary
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm>
          <FieldGroup title="Why">
            <FieldRow label="Reason" required wide>
              <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
