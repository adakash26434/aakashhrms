"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/kit/date-field";
import { FormGrid, GridField } from "@/components/kit/form-grid";
import { PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { Confirm } from "@/components/kit/confirm";
import { LeavePreviewBox, ssfAsked, useLeavePreview } from "@/components/leave/leave-windows";
import { applyForLeaveAction, previewMyLeaveAction, withdrawMyLeaveAction } from "@/app/actions/self-service.actions";
import type { LeaveRuleType } from "@/lib/types/leave";

const HALF_OPTIONS = [
  { value: "", label: "Whole day(s)" },
  { value: "first", label: "First half" },
  { value: "second", label: "Second half" },
];

/**
 * Self-service leave request (4.6). The server counts the days from your own
 * calendar (weekly offs and holidays are not counted) and checks the balance;
 * the request waits for your supervisor or a leave approver. The full My leave
 * redesign is Phase 5.
 */
export function ApplyLeaveModal({ types, today }: { types: LeaveRuleType[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = { leaveTypeId: types[0]?.id ?? "", from: today, to: today, half: "", reason: "", certificateNote: "", ssfClaim: false };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const type = types.find((t) => t.id === form.leaveTypeId);
  const halfAllowed = !!type?.allowHalfDay && form.from === form.to;
  const { preview, loading } = useLeavePreview(
    open ? { leaveTypeId: form.leaveTypeId, from: form.from, to: form.to, half: halfAllowed ? form.half : "", certificateNote: form.certificateNote } : { leaveTypeId: "", from: "", to: "", half: "", certificateNote: "" },
    previewMyLeaveAction
  );

  const start = () => {
    setForm(blank);
    setErrors({});
    setFailure(null);
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    const result = await applyForLeaveAction({ ...form, half: halfAllowed && form.half ? form.half : null, ssfClaim: ssfAsked(type) && form.ssfClaim });
    setSaving(false);
    if (!result.success) {
      setErrors(result.validationErrors ?? {});
      setFailure(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button onClick={start} disabled={!types.length} className="flex cursor-pointer items-center gap-1.5 rounded-md bg-payroll-primary text-xs font-medium text-white shadow-none hover:bg-payroll-primary-hover">
        <Plus className="h-3.5 w-3.5" />
        <span>Apply for leave</span>
      </Button>
      {open && (
        <Window
          open
          onClose={saving ? () => {} : () => setOpen(false)}
          dirty={JSON.stringify(form) !== JSON.stringify(blank)}
          size="lg"
          title="Apply for leave"
          description="Your weekly offs and holidays inside the dates are not counted. The request goes to your supervisor or a leave approver."
          footer={
            <>
              {failure && (
                <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
                  {failure}
                </p>
              )}
              <WindowCancel disabled={saving} />
              <WindowButton ref={saveRef} variant="primary" onClick={save} disabled={saving || loading || !!preview?.problems.length}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Send request
              </WindowButton>
            </>
          }
        >
          <PropertyForm onSubmit={save} enterNavigation={{ end: () => saveRef.current }} className="-mx-4 -mt-4 space-y-0 bg-surface-panel">
            <FormGrid columns={2}>
              <GridField label="Leave type" required error={errors.leaveTypeId} size="lg">
                <SelectField name="leaveTypeId" options={types.map((t) => ({ value: t.id, label: t.name }))} value={form.leaveTypeId} onChange={(v) => set("leaveTypeId", v)} />
              </GridField>
              {halfAllowed ? (
                <GridField label="Part of the day" size="md">
                  <SelectField name="half" options={HALF_OPTIONS} value={form.half} onChange={(v) => set("half", v)} />
                </GridField>
              ) : (
                <div />
              )}
              <GridField label="From" required error={errors.from} size="date">
                <DateField name="from" value={form.from} onChange={(v) => setForm((f) => ({ ...f, from: v, to: !f.to || f.to < v ? v : f.to }))} />
              </GridField>
              <GridField label="To" required error={errors.to} size="date">
                <DateField name="to" value={form.to} onChange={(v) => set("to", v)} />
              </GridField>
              <GridField label="Reason" required error={errors.reason} span={2} size="full">
                <input name="reason" value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} className={inputClass} />
              </GridField>
              {type?.requiresDocument && (
                <GridField label="Certificate" error={errors.certificateNote} span={2} size="full" help={`Needed after ${type.documentThresholdDays ?? 3} days in a row`}>
                  <input name="certificateNote" value={form.certificateNote} maxLength={300} onChange={(e) => set("certificateNote", e.target.value)} placeholder="e.g. Medical certificate from the hospital, doctor, date" className={inputClass} />
                </GridField>
              )}
              {ssfAsked(type) && (
                <GridField label="SSF claim" size="md" help="If you are in the SSF, it pays maternity beyond 60 days and sickness beyond 12.">
                  <YesNoField name="ssfClaim" value={form.ssfClaim} onChange={(v) => set("ssfClaim", v)} />
                </GridField>
              )}
            </FormGrid>
          </PropertyForm>
          <section aria-label="Days counted" className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
            <LeavePreviewBox preview={preview} loading={loading} />
          </section>
        </Window>
      )}
    </>
  );
}

/** Withdraw your own waiting request. */
export function WithdrawLeaveButton({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  return (
    <>
      <button type="button" disabled={busy} onClick={() => setAsking(true)} className="inline-flex cursor-pointer items-center gap-1 text-2xs font-medium text-payroll-primary hover:underline disabled:opacity-50">
        <Undo2 className="h-3 w-3" /> Withdraw
      </button>
      {error && (
        <span role="alert" className="block text-2xs text-danger">
          {error}
        </span>
      )}
      <Confirm
        open={asking}
        title="Withdraw this leave request?"
        message="It will not be decided or taken."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          const r = await withdrawMyLeaveAction(id);
          setAsking(false);
          if (!r.success) setError(r.error);
          else startBusy(() => router.refresh());
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
