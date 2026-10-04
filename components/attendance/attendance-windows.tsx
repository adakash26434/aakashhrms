"use client";

import { useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField, GridValue } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { addAttendancePunchesAction, createAttendanceAdjustmentAction, saveAttendanceRulesAction } from "@/app/actions/attendance.actions";
import { WEEKDAYS } from "@/lib/engines/pay-period.engine";
import { ADJUSTMENT_KINDS, ADJUSTMENT_KIND_LABEL, type AdjustmentKind, type AttendancePageData } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

type Saved = (text: string) => void;

/** People this user may enter attendance for (in scope, never themselves). */
const peopleOf = (data: AttendancePageData) =>
  data.register
    .filter((r) => r.employee.id !== data.myEmployeeId)
    .map((r) => ({ value: r.employee.id, label: r.employee.fullName, hint: r.employee.employeeCode }));

function Failure({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
      {text}
    </p>
  );
}

/** HR punch: a check-in and / or check-out for a day, with a note (an out before the in is the next morning). */
export function PunchWindow({ data, initial, onClose, onSaved }: { data: AttendancePageData; initial?: { employeeId: string; date: string }; onClose: () => void; onSaved: Saved }) {
  const [form, setForm] = useState({ employeeId: initial?.employeeId ?? "", date: initial?.date ?? data.today, in: "", out: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    const result = await addAttendancePunchesAction(form);
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(result.data.added ? `${result.data.added} punch${result.data.added === 1 ? "" : "es"} added.` : "Those punches were already recorded.");
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      size="md"
      title="Add punch"
      description="For a check-in or check-out the employee could not record. It is kept in the punch log with your name and note."
      footer={
        <>
          <Failure text={failure} />
          <WindowButton onClick={onClose} disabled={saving}>Cancel</WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Add punch
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Employee" required error={errors.employeeId} size="lg">
            <Combobox name="employeeId" options={peopleOf(data)} value={form.employeeId} onChange={(v) => set("employeeId", v)} placeholder="Search employee" />
          </GridField>
          <GridField label="Day" required error={errors.date} size="date">
            <DateField name="date" value={form.date} onChange={(v) => set("date", v)} />
          </GridField>
          <GridField label="Check-in" error={errors.in} size="code" help="24-hour time, e.g. 09:58">
            <input name="in" type="time" value={form.in} onChange={(e) => set("in", e.target.value)} className={inputClass} />
          </GridField>
          <GridField label="Check-out" error={errors.out} size="code" help="Earlier than the check-in means the next morning (night work)">
            <input name="out" type="time" value={form.out} onChange={(e) => set("out", e.target.value)} className={inputClass} />
          </GridField>
          <GridField label="Note" required error={errors.note} span={2} size="lg">
            <input name="note" value={form.note} maxLength={300} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Forgot to check out; confirmed by supervisor" className={inputClass} />
          </GridField>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}

/** A new adjustment (regularization) on an employee's behalf; it waits for their supervisor or an approver. */
export function AdjustmentWindow({ data, initial, onClose, onSaved }: { data: AttendancePageData; initial?: { employeeId: string; date: string }; onClose: () => void; onSaved: Saved }) {
  const [form, setForm] = useState({ employeeId: initial?.employeeId ?? "", date: initial?.date ?? data.today, kind: "missed_out" as AdjustmentKind, in: "", out: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const needIn = form.kind === "missed_in" || form.kind === "wrong_time";
  const needOut = form.kind === "missed_out" || form.kind === "wrong_time";
  const optionalTimes = form.kind === "on_duty";
  const save = async () => {
    setSaving(true);
    const result = await createAttendanceAdjustmentAction({ ...form, in: needIn || optionalTimes ? form.in : "", out: needOut || optionalTimes ? form.out : "" });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved("Adjustment sent for approval to the employee's supervisor or an attendance approver.");
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      size="md"
      title="New adjustment"
      description="For a missed or wrong check-in / check-out, field work, or a day to count as present. It counts once approved (never by the employee themselves)."
      footer={
        <>
          <Failure text={failure} />
          <WindowButton onClick={onClose} disabled={saving}>Cancel</WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Send for approval
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Employee" required error={errors.employeeId} size="lg">
            <Combobox name="employeeId" options={peopleOf(data)} value={form.employeeId} onChange={(v) => set("employeeId", v)} placeholder="Search employee" />
          </GridField>
          <GridField label="Day" required error={errors.date} size="date">
            <DateField name="date" value={form.date} onChange={(v) => set("date", v)} />
          </GridField>
          <GridField label="What to correct" required error={errors.kind} size="lg" span={2}>
            <SelectField name="kind" options={ADJUSTMENT_KINDS.map((k) => ({ value: k, label: ADJUSTMENT_KIND_LABEL[k] }))} value={form.kind} onChange={(v) => set("kind", v)} />
          </GridField>
          {(needIn || optionalTimes) && (
            <GridField label="Check-in" required={needIn} error={errors.in} size="code">
              <input name="in" type="time" value={form.in} onChange={(e) => set("in", e.target.value)} className={inputClass} />
            </GridField>
          )}
          {(needOut || optionalTimes) && (
            <GridField label="Check-out" required={needOut} error={errors.out} size="code">
              <input name="out" type="time" value={form.out} onChange={(e) => set("out", e.target.value)} className={inputClass} />
            </GridField>
          )}
          <GridField label="Reason" required error={errors.reason} span={2} size="lg">
            <input name="reason" value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Fingerprint machine was down in the evening" className={inputClass} />
          </GridField>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}

/** Attendance rules (company administrators): office time, thresholds, weekly offs, no-record and late rules. */
export function RulesWindow({ data, onClose, onSaved }: { data: AttendancePageData; onClose: () => void; onSaved: Saved }) {
  const s = data.rules.shift;
  const initial = {
    start: s.start,
    end: s.end,
    breakMinutes: s.breakMinutes,
    graceMinutes: s.graceMinutes,
    halfDayMinutes: s.halfDayMinutes,
    fullDayMinutes: s.fullDayMinutes,
    otMinimumMinutes: s.otMinimumMinutes,
    weeklyOffs: s.weeklyOffs,
    noRecord: data.rules.noRecord,
    lateEnabled: data.rules.lateRule.enabled,
    lateCount: data.rules.lateRule.count,
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    const result = await saveAttendanceRulesAction(form);
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved("Attendance rules saved. Open months are worked out with them; closed months keep their results.");
  };
  const hours = (m: number) => Math.round((m / 60) * 100) / 100;
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(initial)}
      size="xl"
      title="Attendance rules"
      description="How every day is counted. Office time, break, grace, half day and weekly off are the same settings as Company setup → Work schedule."
      footer={
        <>
          <Failure text={failure} />
          <WindowButton onClick={onClose} disabled={saving}>Cancel</WindowButton>
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rules
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Office starts" required error={errors.start} size="code">
            <input name="start" type="time" value={form.start} onChange={(e) => set("start", e.target.value)} className={inputClass} />
          </GridField>
          <GridField label="Office ends" required error={errors.end} size="code" help="Earlier than the start means a night shift (ends next morning)">
            <input name="end" type="time" value={form.end} onChange={(e) => set("end", e.target.value)} className={inputClass} />
          </GridField>
          <GridField label="Break" error={errors.breakMinutes} size="code" suffix="minutes" help="Taken off days longer than 5 hours (Labour Act: rest after 5 hours)">
            <NumberField name="breakMinutes" decimals={0} value={form.breakMinutes} onChange={(v) => set("breakMinutes", v)} showZero />
          </GridField>
          <GridField label="Grace" error={errors.graceMinutes} size="code" suffix="minutes" help="Arriving within this is not late">
            <NumberField name="graceMinutes" decimals={0} value={form.graceMinutes} onChange={(v) => set("graceMinutes", v)} showZero />
          </GridField>
          <GridField label="Full day from" error={errors.fullDayMinutes} size="code" suffix={`minutes (${hours(form.fullDayMinutes)} h)`}>
            <NumberField name="fullDayMinutes" decimals={0} value={form.fullDayMinutes} onChange={(v) => set("fullDayMinutes", v)} />
          </GridField>
          <GridField label="Half day from" error={errors.halfDayMinutes} size="code" suffix={`minutes (${hours(form.halfDayMinutes)} h)`} help="Less than this worked is absent">
            <NumberField name="halfDayMinutes" decimals={0} value={form.halfDayMinutes} onChange={(v) => set("halfDayMinutes", v)} />
          </GridField>
          <GridField label="Overtime from" error={errors.otMinimumMinutes} size="code" suffix="minutes" help="Extra time below this is not overtime; over 4 h a day or 24 h a week is flagged">
            <NumberField name="otMinimumMinutes" decimals={0} value={form.otMinimumMinutes} onChange={(v) => set("otMinimumMinutes", v)} showZero />
          </GridField>
          <GridField label="Weekly off" error={errors.weeklyOffs} span={2} size="full">
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    name={`weeklyOff.${i}`}
                    className="h-3.5 w-3.5 accent-brand"
                    checked={form.weeklyOffs.includes(i)}
                    onChange={() => set("weeklyOffs", form.weeklyOffs.includes(i) ? form.weeklyOffs.filter((x) => x !== i) : [...form.weeklyOffs, i].sort())}
                  />
                  {d}
                </label>
              ))}
            </div>
          </GridField>
          <GridField label="Nothing recorded" size="md" help="A working day with no punch, leave or adjustment">
            <SelectField
              name="noRecord"
              options={[
                { value: "absent", label: "Absent (unpaid)" },
                { value: "present", label: "Present (record only absences)" },
              ]}
              value={form.noRecord}
              onChange={(v) => set("noRecord", v === "present" ? "present" : "absent")}
            />
          </GridField>
          <GridField label="Late rule" size="md" help="Every N late days = half a day unpaid">
            <YesNoField name="lateEnabled" value={form.lateEnabled} onChange={(v) => set("lateEnabled", v)} />
          </GridField>
          <GridField label="Late days per half day" error={errors.lateCount} size="xs">
            <NumberField name="lateCount" decimals={0} value={form.lateCount} onChange={(v) => set("lateCount", v)} readOnly={!form.lateEnabled} />
          </GridField>
          <GridValue label="Month calendar">
            <span className={cn("text-sm")}>Bikram Sambat months (29–32 days)</span>
            <span className="block text-2xs text-ink-muted">AD months (28–31 days) become available once payroll can run in AD months.</span>
          </GridValue>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}

/** A short reason prompt (void, reject, reopen). */
export function ReasonWindow({ title, description, action, danger, onClose, onConfirm }: { title: string; description: string; action: string; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<string | null> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const error = await onConfirm(reason);
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
          <WindowButton onClick={onClose} disabled={busy}>Cancel</WindowButton>
          <WindowButton variant={danger ? "danger" : "primary"} onClick={go} disabled={busy || reason.trim().length < 3}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {action}
          </WindowButton>
        </>
      }
    >
      <label className="block text-xs font-medium text-ink-label">
        Reason
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1 max-w-none")} />
      </label>
    </Window>
  );
}
