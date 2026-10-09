"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Save, Scissors, ShieldCheck, Undo2, X } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { NumberField } from "@/components/kit/number-field";
import { PaneActions, PaneFields, PaneSection, PaneTimeline, approvalSteps } from "@/components/kit/pane";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { addOvertimeAction, decideOvertimeAction } from "@/app/actions/overtime.actions";
import { localClock } from "@/lib/engines/attendance-day.engine";
import { describeRates, describeRounding } from "@/lib/engines/overtime.engine";
import type { AttendancePageData } from "@/lib/types/attendance";
import type { ApprovalActionKind } from "@/lib/types/approval";
import type { OvertimeDayView, OvertimeState } from "@/lib/types/overtime";
import { cn } from "@/lib/utils";

type Decision = "approve" | "final_approve" | "reject" | "withdraw";
type Pending = { keys: string[]; decision: Decision; part?: boolean };

const STATE: Record<OvertimeState, { status: string; label: string }> = {
  auto: { status: "active", label: "Paid automatically" },
  waiting: { status: "pending", label: "Waiting" },
  changed: { status: "pending", label: "Changed: waiting" },
  approved: { status: "approved", label: "Approved" },
  rejected: { status: "rejected", label: "Rejected" },
  withdrawn: { status: "cancelled", label: "Withdrawn" },
};
const ACTION_LABEL: Partial<Record<ApprovalActionKind, string>> = { submitted: "Added", approved: "Approved", final_approved: "Final approved", rejected: "Rejected", withdrawn: "Withdrawn" };
const waits = (o: OvertimeDayView) => o.state === "waiting" || o.state === "changed";

/** "2 h 15 min", "45 min", "3 h". */
export const asTime = (m: number) => {
  const v = Math.max(0, Math.round(m));
  return v >= 60 ? `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60} min` : ""}` : `${v} min`;
};

/**
 * Overtime (4.7b): every overtime day this month, from the punches or added
 * by hand, and what it pays. Approval required: only approved minutes are
 * paid. Automatic: detected overtime is paid, days over the legal limits
 * (4 h a day, 24 h a week) wait. Decided by the employee's supervisor or an
 * attendance approver (company administrators Final approve); never your own.
 */
export function AttendanceOvertime({ data, onAdd, onDone }: { data: AttendancePageData; onAdd: () => void; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const mine = useMemo(() => data.overtime.filter((o) => waits(o) && (o.can.approve || o.can.finalApprove)), [data.overtime]);
  const [view, setView] = useState<"mine" | "all">(mine.length ? "mine" : "all");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rows = view === "mine" ? mine : data.overtime;
  const active = data.overtime.find((o) => o.key === activeKey) ?? null;
  const decidableKeys = new Set(data.overtime.filter((o) => o.can.approve || o.can.reject).map((o) => o.key));
  const bulk = [...selected].filter((k) => decidableKeys.has(k));
  const policy = data.overtimePolicy;
  const totalWaiting = data.overtime.filter(waits).length;

  const decide = async (input?: { minutes?: number | null; note?: string }): Promise<string | null> => {
    if (!pending) return null;
    const result = await decideOvertimeAction(pending.keys, pending.decision, input);
    if (!result.success) {
      if (pending.keys.length === 1 && ("validationErrors" in result) && result.validationErrors) return Object.values(result.validationErrors)[0] ?? result.error;
      setPending(null);
      setMessage(result.error);
      return result.error;
    }
    const decision = pending.decision;
    setPending(null);
    setSelected(new Set());
    const done = result.data?.done ?? 0;
    const failed = result.data?.failed ?? [];
    setMessage(failed.length ? `${failed.length} not changed: ${failed.map((f) => f.error).join(" · ")}` : null);
    onDone(`${done} overtime day${done === 1 ? "" : "s"} ${decision === "reject" ? "rejected" : decision === "withdraw" ? "withdrawn" : "approved"}.`);
    return null;
  };

  const columns = useMemo<GridColumn<OvertimeDayView>[]>(
    () => [
      { id: "date", header: "Day", type: "date", value: (o) => o.date },
      { id: "name", header: "Employee", width: 180, value: (o) => o.employeeName, cell: (o) => <span className="font-medium text-ink">{o.employeeName} <span className="font-code text-3xs text-ink-faint">{o.employeeCode}</span></span> },
      { id: "kind", header: "Kind of day", width: 150, value: (o) => (o.kind === "off" ? "Weekly off / holiday" : "Working day") },
      { id: "source", header: "From", width: 120, value: (o) => (o.source === "manual" ? "Added by hand" : "Punches"), cell: (o) => <span className={o.source === "manual" ? "text-ink" : "text-ink-muted"}>{o.source === "manual" ? "Added by hand" : "Punches"}</span> },
      { id: "worked", header: "Worked", width: 100, value: (o) => o.workMinutes, cell: (o) => <span className="tabular-nums text-ink-muted">{o.workMinutes ? asTime(o.workMinutes) : "—"}</span> },
      { id: "minutes", header: "Overtime", width: 110, value: (o) => o.minutes, cell: (o) => <span className="font-medium tabular-nums text-ink">{asTime(o.minutes)}</span> },
      { id: "paid", header: "Paid", width: 110, value: (o) => o.paidMinutes, cell: (o) => <span className={cn("tabular-nums", o.paidMinutes ? "text-ink" : "text-ink-faint")}>{o.paidMinutes ? asTime(o.paidMinutes) : "—"}</span> },
      { id: "status", header: "Status", width: 160, value: (o) => STATE[o.state].label, cell: (o) => <StatusChip status={STATE[o.state].status} label={STATE[o.state].label} /> },
      {
        id: "flags",
        header: "Notes",
        width: 220,
        value: (o) => [o.limitText, o.state === "changed" ? "Punches changed since decided" : ""].filter(Boolean).join(" · "),
        cell: (o) => (
          <span className="text-2xs">
            {o.limitText && <span className="font-medium text-danger">{o.limitText}</span>}
            {o.limitText && o.state === "changed" && " · "}
            {o.state === "changed" && <span className="text-warning">Punches changed since decided</span>}
            {!o.limitText && o.state !== "changed" && <span className="text-ink-faint">—</span>}
          </span>
        ),
      },
    ],
    []
  );

  const one = pending && pending.keys.length === 1 ? data.overtime.find((o) => o.key === pending.keys[0]) ?? null : null;
  const overLimitInPending = pending ? data.overtime.filter((o) => pending.keys.includes(o.key) && o.overLimit).length : 0;
  const approving = pending?.decision === "approve" || pending?.decision === "final_approve";
  // A reason is needed to reject, to approve days over the legal limits, and with "approve part".
  const needsWindow = pending && (pending.decision === "reject" || (approving && (pending.part || overLimitInPending > 0)));

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which overtime" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {(
            [
              ["mine", `Waiting for me (${mine.length})`],
              ["all", `All (${data.overtime.length})`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("cursor-pointer rounded px-3 py-1 font-medium", view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}>
              {label}
            </button>
          ))}
        </div>
        {data.permissions.add && (
          <WindowButton onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add overtime
          </WindowButton>
        )}
        {bulk.length > 0 && (
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-ink-muted">{bulk.length} selected</span>
            <WindowButton variant="primary" onClick={() => setPending({ keys: bulk, decision: "approve" })}>
              <Check className="h-3.5 w-3.5" /> Approve selected
            </WindowButton>
            <WindowButton variant="danger" onClick={() => setPending({ keys: bulk, decision: "reject" })}>
              <X className="h-3.5 w-3.5" /> Reject selected
            </WindowButton>
          </span>
        )}
      </div>
      <div className="mb-2 rounded-md border border-line bg-surface-panel px-3 py-2 text-2xs text-ink-muted">
        <p>
          <span className="font-medium text-ink">{policy.approval === "required" ? "Approval required:" : "Paid automatically:"}</span>{" "}
          {policy.approval === "required"
            ? "only approved overtime is paid. Overtime the punches show waits here until the employee's supervisor or an attendance approver decides it."
            : "overtime the punches show is paid as it is; days over the legal limits (4 hours a day, 24 hours a week) wait here for a decision. Approvers may still cut or refuse any day before the month closes."}{" "}
          {describeRates(policy)}; {describeRounding(policy).toLowerCase()}.{" "}
          <Link href="/timeAndLeave/policies?tab=overtime" className="font-medium text-brand-strong hover:underline">
            Overtime policy
          </Link>
        </p>
        <p className="mt-0.5">
          Nobody decides their own overtime. The month can be closed once nothing waits{totalWaiting ? ` (${totalWaiting} waiting now)` : ""}. Normal hours worked on a weekly off or holiday earn a substitute day off (Leave), not overtime.
        </p>
      </div>
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      <SplitView
        id="attendance-overtime"
        detailTitle={active ? `${active.employeeName} · ${dateText(active.date)}` : undefined}
        onCloseDetail={() => setActiveKey(null)}
        detail={active ? <OvertimePane o={active} onDecide={(decision, part) => setPending({ keys: [active.key], decision, part })} /> : null}
        master={
          <DataGrid
            id="attendance-overtime"
            label="Overtime days"
            columns={columns}
            rows={rows}
            getRowId={(o) => o.key}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            activeRowId={activeKey}
            onActiveRowChange={(o) => setActiveKey(o.key)}
            onOpen={(o) => setActiveKey(o.key)}
            rowTone={(o) => (waits(o) && o.overLimit ? "danger" : waits(o) ? "warning" : undefined)}
            defaultSort={{ columnId: "date", direction: "desc" }}
            pageSize={50}
            empty={
              view === "mine"
                ? { title: "Nothing waiting for you", description: "Overtime you can decide appears here." }
                : { title: "No overtime this month", description: "Overtime from the punches, and overtime added by hand, appears here." }
            }
          />
        }
      />
      <Confirm
        open={!!pending && !needsWindow && pending.decision !== "withdraw"}
        title={pending?.decision === "final_approve" ? "Final approve this overtime?" : `Approve ${pending?.keys.length === 1 ? "this overtime" : `${pending?.keys.length} overtime days`}?`}
        message={one ? `${asTime(one.minutes)} is paid at the ${one.kind === "off" ? "weekly off / holiday" : "working-day"} rate${policy.rounding ? `, ${describeRounding(policy).toLowerCase()}` : ""}.` : "Each day is paid as detected (or as asked for, when added by hand)."}
        confirmLabel={pending?.decision === "final_approve" ? "Final approve" : "Approve"}
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.decision === "withdraw"}
        title="Withdraw this overtime?"
        message="It will not be paid."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      {needsWindow && pending && (
        <DecideWindow
          decision={pending.decision}
          count={pending.keys.length}
          day={one}
          part={!!pending.part}
          overLimit={overLimitInPending}
          onClose={() => setPending(null)}
          onConfirm={(input) => decide(input)}
        />
      )}
    </div>
  );
}

/** One overtime day: its buttons, the day's punches and shift, what it pays, and the approval timeline. */
function OvertimePane({ o, onDecide }: { o: OvertimeDayView; onDecide: (decision: Decision, part?: boolean) => void }) {
  const dateText = useDateText();
  const decidableNow = o.can.approve || o.can.finalApprove || o.can.reject || o.can.withdraw;
  const approveLabel = o.state === "auto" ? "Confirm" : "Approve";
  return (
    <div className="text-xs">
      {(decidableNow || o.can.reason) && (
        <PaneActions hint={o.can.reason && !o.can.approve ? o.can.reason : o.limitText ? `${o.limitText}: approving needs a reason (Labour Act §30).` : undefined} hintTone={o.limitText ? "warning" : "muted"}>
          {o.can.approve && (
            <>
              <WindowButton variant="primary" onClick={() => onDecide("approve")}>
                <Check className="h-3.5 w-3.5" /> {approveLabel}
              </WindowButton>
              <WindowButton onClick={() => onDecide("approve", true)}>
                <Scissors className="h-3.5 w-3.5" /> Approve part
              </WindowButton>
            </>
          )}
          {o.can.finalApprove && (
            <WindowButton variant="primary" onClick={() => onDecide("final_approve")}>
              <ShieldCheck className="h-3.5 w-3.5" /> Final approve
            </WindowButton>
          )}
          {o.can.reject && (
            <WindowButton variant="danger" onClick={() => onDecide("reject")}>
              <X className="h-3.5 w-3.5" /> Reject
            </WindowButton>
          )}
          {o.can.withdraw && (
            <WindowButton onClick={() => onDecide("withdraw")}>
              <Undo2 className="h-3.5 w-3.5" /> Withdraw
            </WindowButton>
          )}
        </PaneActions>
      )}
      <PaneSection>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-ink">
            {asTime(o.minutes)} on a {o.kind === "off" ? "weekly off / holiday" : "working day"}
          </p>
          <StatusChip status={STATE[o.state].status} label={STATE[o.state].label} />
        </div>
        {o.source === "manual" && o.entry?.reason && <p className="mt-1 text-ink">“{o.entry.reason}”</p>}
        {o.state === "changed" && <p className="mt-1 text-warning">The punches changed after it was decided ({asTime(o.entry?.detectedMinutes ?? 0)} then, {asTime(o.minutes)} now), so it waits for a decision again.</p>}
        {o.limitText && <p className="mt-1 font-medium text-danger">{o.limitText} (the Labour Act allows at most 4 hours a day and 24 hours a week).</p>}
      </PaneSection>
      <PaneSection title="The day">
        <PaneFields
          rows={[
            { label: "Day", value: dateText(o.date) },
            { label: "Shift", value: o.shiftText ?? "—" },
            { label: "Punches", value: [localClock(o.firstIn), localClock(o.lastOut)].filter(Boolean).join(" – ") || "None", note: o.workMinutes ? `${asTime(o.workMinutes)} worked` : undefined },
            { label: "How it counts", value: o.dayText || "—" },
          ]}
        />
      </PaneSection>
      <PaneSection title="Overtime">
        <PaneFields
          rows={[
            { label: o.source === "manual" ? "Asked for" : "From the punches", value: asTime(o.minutes), note: o.source === "manual" ? `Added by ${o.preparedByName ?? "someone"}` : undefined },
            { label: "Approved", value: o.approvedMinutes === null ? "—" : asTime(o.approvedMinutes), note: o.decidedByName ? `${o.decidedByName}${o.entry?.decidedAt ? ` · ${dateText(o.entry.decidedAt)}` : ""}` : undefined },
            { label: "Paid", value: o.paidMinutes ? asTime(o.paidMinutes) : "Nothing yet", note: o.state === "auto" ? "Paid automatically (within the legal limits)" : undefined },
            ...(o.entry?.decisionNote ? [{ label: "Note", value: o.entry.decisionNote }] : []),
          ]}
        />
      </PaneSection>
      {o.timeline.length > 0 && (
        <PaneSection title="Approval">
          <PaneTimeline steps={approvalSteps(o.timeline, { label: ACTION_LABEL, dateText, waiting: waits(o) ? "the supervisor or an attendance approver" : null })} />
        </PaneSection>
      )}
    </div>
  );
}

/** Reject (reason), approve part (minutes) or approve days over the legal limits (reason). */
function DecideWindow({
  decision,
  count,
  day,
  part,
  overLimit,
  onClose,
  onConfirm,
}: {
  decision: Decision;
  count: number;
  day: OvertimeDayView | null;
  part: boolean;
  overLimit: number;
  onClose: () => void;
  onConfirm: (input: { minutes?: number | null; note?: string }) => Promise<string | null>;
}) {
  const reject = decision === "reject";
  const [minutes, setMinutes] = useState(day?.minutes ?? 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const noteNeeded = reject || overLimit > 0;
  const minutesOk = !part || !day || (minutes >= 1 && minutes <= day.minutes);
  const go = async () => {
    setBusy(true);
    const error = await onConfirm({ minutes: part ? minutes : null, note });
    setBusy(false);
    if (error) setFailure(error);
  };
  const what = count === 1 ? "this overtime" : `${count} overtime days`;
  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      size="sm"
      title={reject ? `Reject ${what}?` : part ? "Approve part of this overtime" : `Approve ${what}?`}
      description={
        reject
          ? "It is not paid. The person who added it, and anyone looking at the day, sees your reason."
          : overLimit
            ? `${overLimit === 1 && count === 1 ? "This day is" : `${overLimit} of these days are`} over the legal limits (4 hours a day, 24 hours a week). The work was done, so it is paid once approved; say why it was needed. It stays flagged in reports.`
            : "Only the minutes you approve are paid."
      }
      footer={
        <>
          {failure && <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">{failure}</p>}
          <WindowCancel disabled={busy} />
          <WindowButton variant={reject ? "danger" : "primary"} onClick={go} disabled={busy || !minutesOk || (noteNeeded && note.trim().length < 3)}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {reject ? "Reject" : decision === "final_approve" ? "Final approve" : "Approve"}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {part && day && (
          <label className="block text-xs font-medium text-ink-label">
            Minutes to pay
            <div className="mt-1 flex items-center gap-2">
              <NumberField name="minutes" decimals={0} max={day.minutes} value={minutes} onChange={setMinutes} className="max-w-28" aria-label="Minutes to pay" />
              <span className="text-2xs font-normal text-ink-muted">
                = {asTime(minutes)} of {asTime(day.minutes)}
              </span>
            </div>
          </label>
        )}
        <label className="block text-xs font-medium text-ink-label">
          {reject ? "Reason" : noteNeeded ? "Why it is approved" : "Note (optional)"}
          <input autoFocus={!part} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1 max-w-none")} />
        </label>
      </div>
    </Window>
  );
}

/** Overtime added by hand (worked without punches, e.g. at a client site); it waits for a decision. */
export function OvertimeWindow({ data, onClose, onSaved }: { data: AttendancePageData; onClose: () => void; onSaved: (text: string) => void }) {
  const [start] = useState(() => ({ employeeId: "", date: data.today, hours: 0, minutes: 0, reason: "" }));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const people = data.register.filter((r) => r.employee.id !== data.myEmployeeId).map((r) => ({ value: r.employee.id, label: r.employee.fullName, hint: r.employee.employeeCode }));
  const total = form.hours * 60 + form.minutes;
  const save = async () => {
    setSaving(true);
    const result = await addOvertimeAction({ employeeId: form.employeeId, date: form.date, minutes: total, reason: form.reason });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    onSaved(`Overtime added (${asTime(total)}). It waits for the employee's supervisor or an attendance approver on the Overtime tab.`);
  };
  return (
    <Window
      open
      onClose={saving ? () => {} : onClose}
      dirty={JSON.stringify(form) !== JSON.stringify(start)}
      size="md"
      title="Add overtime"
      description="For overtime the punches do not show (work at a client site, an event, from home). It is paid once approved, never by the employee themselves. Only the overtime itself: normal hours on a weekly off earn a substitute day off instead."
      footer={
        <>
          {failure && <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">{failure}</p>}
          <WindowCancel disabled={saving} />
          <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Send for approval
          </WindowButton>
        </>
      }
    >
      <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -my-4 space-y-0 bg-surface-panel">
        <FormGrid columns={2}>
          <GridField label="Employee" required error={errors.employeeId} size="lg">
            <Combobox name="employeeId" options={people} value={form.employeeId} onChange={(v) => set("employeeId", v)} placeholder="Search employee" />
          </GridField>
          <GridField label="Day" required error={errors.date} size="date">
            <DateField name="date" value={form.date} onChange={(v) => set("date", v)} />
          </GridField>
          <GridField label="Hours" required error={errors.minutes} size="xs" help={total ? `${asTime(total)} in all` : "At most 12 hours"}>
            <NumberField name="hours" decimals={0} max={12} value={form.hours} onChange={(v) => set("hours", v)} />
          </GridField>
          <GridField label="Minutes" size="xs">
            <NumberField name="minutes" decimals={0} max={59} value={form.minutes} onChange={(v) => set("minutes", v)} />
          </GridField>
          <GridField label="What it was for" required error={errors.reason} span={2} size="lg">
            <input name="reason" value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Year-end stock count at the warehouse" className={inputClass} />
          </GridField>
        </FormGrid>
      </PropertyForm>
    </Window>
  );
}
