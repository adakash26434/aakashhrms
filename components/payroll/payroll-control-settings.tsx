"use client";

import { useState, useTransition } from "react";
import { PageBar } from "@/components/frame/page-bar";
import { Notice } from "@/components/kit/notice";
import { FieldGroup, FieldRow, PropertyForm } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { NumberField } from "@/components/kit/number-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { savePayrollControlSettingsAction } from "@/app/actions/payroll-control.actions";
import type { PayrollControlSettings } from "@/lib/services/payroll-control.service";

// Payroll controls (4.8 / F1–F2): the three company settings. Saved under
// SYSTEM_CONTROL; the rules themselves are enforced on the server.

const MODES = [
  { value: "admin_exempt", label: "Administrators may approve their own run" },
  { value: "strict", label: "Strict — never approve or lock a run that pays you" },
];

export function PayrollControlSettingsClient({ initial, canEdit }: { initial: PayrollControlSettings; canEdit: boolean }) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      setSaved(false);
      const result = await savePayrollControlSettingsAction(form);
      if (result.success) {
        setForm(result.data);
        setSaved(true);
      } else setError(result.error);
    });

  return (
    <div>
      <PageBar
        title="Payroll controls"
        description="Who may approve a pay run, when a month-on-month change needs a look, and whether attendance must be closed first"
        actions={canEdit ? [{ id: "save", label: pending ? "Saving…" : "Save", group: "create", primary: true, disabled: pending, onClick: save }] : []}
      />
      {error && <Notice tone="danger" className="mb-3" onDismiss={() => setError(null)}>{error}</Notice>}
      {saved && <Notice tone="success" className="mb-3" onDismiss={() => setSaved(false)}>Saved. New rules apply to the next approve or lock.</Notice>}
      <PropertyForm onSubmit={canEdit ? save : undefined}>
        <FieldGroup title="Maker-checker" description="The person who generated a run never approves or locks it. Nobody edits their own payslip in either mode.">
          <FieldRow label="Approval rule" help="Strict also refuses an approver or locker whose own pay is in the run.">
            <SelectField name="makerChecker" options={MODES} value={form.makerChecker} disabled={!canEdit} onChange={(v) => setForm({ ...form, makerChecker: v === "strict" ? "strict" : "admin_exempt" })} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="Variance review" description="A run is compared with the previous month for the same branches. Each flag must be acknowledged with a note before approval.">
          <FieldRow label="Net pay change that is flagged (%)">
            <NumberField decimals={0} min={1} max={100} value={form.variancePct} readOnly={!canEdit} onChange={(n) => setForm({ ...form, variancePct: n })} />
          </FieldRow>
        </FieldGroup>
        <FieldGroup title="Before generating">
          <FieldRow label="Attendance month must be closed" help="Off: an open attendance month only warns in the pre-flight check.">
            <YesNoField value={form.requireClosedAttendance} disabled={!canEdit} onChange={(v) => setForm({ ...form, requireClosedAttendance: v })} />
          </FieldRow>
        </FieldGroup>
      </PropertyForm>
    </div>
  );
}
