"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { NumberField } from "@/components/kit/number-field";
import { PaneActions, PaneSection } from "@/components/kit/pane";
import { inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { addSlipHeadAction, overrideSlipAction, recalculateSlipAction, removeSlipAction, slipDetailAction } from "@/app/actions/payroll-run.actions";
import { describeDetail } from "@/lib/engines/overtime.engine";
import type { PayrollSlip, PayrollSlipHead } from "@/lib/types/payroll";
import type { PayrollRunView, PayrollRunsPageData } from "@/lib/types/payroll-run";
import { cn } from "@/lib/utils";

type Line = { id: string; label: string; amount: string; note?: string | null; editable?: boolean; overridden?: boolean };
type Editing = { id: string; label: string; amount: string } | null;

/** The payslip as the payslip shows it: earnings, deductions, net, the working, and the edit actions (draft runs; never your own). */
export function PayslipPane({ slip: initial, run, data, onChanged }: { slip: PayrollSlip; run: PayrollRunView; data: PayrollRunsPageData; onChanged: () => void }) {
  const [slip, setSlip] = useState(initial);
  const [heads, setHeads] = useState<PayrollSlipHead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const own = data.myEmployeeId === slip.employeeId;
  const canEdit = run.can.edit && !own;

  useEffect(() => {
    let live = true;
    slipDetailAction(initial.id).then((r) => {
      if (!live) return;
      if (r.success && r.data) {
        setSlip(r.data.slip);
        setHeads(r.data.heads);
      } else setError(r.success ? null : r.error);
    });
    return () => {
      live = false;
    };
  }, [initial.id]);

  const apply = (r: { success: boolean; error?: string; data?: { slip: PayrollSlip; heads: PayrollSlipHead[] } }) => {
    if (!r.success || !r.data) {
      setError(r.error ?? "Not changed.");
      return false;
    }
    setSlip(r.data.slip);
    setHeads(r.data.heads);
    setError(null);
    onChanged();
    return true;
  };

  const allowances = (heads ?? []).filter((h) => h.headType === "allowance");
  const deductions = (heads ?? []).filter((h) => h.headType === "deduction");
  const earnings: Line[] = [
    { id: "basic-salary", label: "Basic salary", amount: slip.basicSalary, editable: true },
    ...(Number(slip.gradeAmount) ? [{ id: "grade-amount", label: "Grade", amount: slip.gradeAmount, editable: true }] : []),
    ...allowances.map((h) => ({ id: h.payHeadId, label: h.payHeadName, amount: h.calculatedAmount ?? h.amount, editable: true, overridden: h.isManualOverride, note: h.isManualOverride ? h.overrideReason : null })),
    { id: "ot-amount", label: "Overtime", amount: slip.otAmount, editable: true, note: slip.otDetail && Math.abs(slip.otDetail.amount - Number(slip.otAmount)) < 0.005 ? describeDetail(slip.otDetail) : null },
    ...(Number(slip.absentDeduction) ? [{ id: "absent-deduction", label: "Unpaid days", amount: `-${slip.absentDeduction}`, editable: true }] : []),
  ].filter((l) => Number(l.amount) !== 0 || l.editable);
  const ded: Line[] = [
    ...deductions.map((h) => ({ id: h.payHeadId, label: h.payHeadName, amount: h.calculatedAmount ?? h.amount, editable: true, overridden: h.isManualOverride, note: h.isManualOverride ? h.overrideReason : null })),
    ...(Number(slip.tdsThisMonth) ? [{ id: "tds", label: "Income tax", amount: slip.tdsThisMonth }] : []),
    ...(Number(slip.loanDeduction) ? [{ id: "loan-deduction", label: "Loan instalment", amount: slip.loanDeduction, editable: true }] : []),
    ...(slip.fundDetail ?? []).filter((f) => Number(f.employeeAmount)).map((f) => ({ id: `fund-${f.code}`, label: `${f.name} (fund)`, amount: f.employeeAmount, note: Number(f.employerAmount) ? `Employer adds ${Number(f.employerAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : null })),
  ];
  const lines = (list: Line[]) =>
    list.map((l) => (
      <div key={l.id} className="flex items-start justify-between gap-2 py-0.5">
        <span className="min-w-0">
          <span className={cn("text-ink", l.overridden && "text-warning")}>{l.label}</span>
          {l.note && <span className="block text-3xs text-ink-faint">{l.note}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Amount value={l.amount} />
          {canEdit && l.editable && (
            <button type="button" aria-label={`Change ${l.label}`} className="cursor-pointer rounded p-0.5 text-ink-faint hover:bg-surface-sunken hover:text-ink" onClick={() => setEditing({ id: l.id, label: l.label, amount: String(Math.abs(Number(l.amount))) })}>
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>
    ));

  return (
    <div className="text-xs">
      {run.status === "DRAFT" && (
        <PaneActions hint={own ? "This is your own payslip: someone else changes it (S21)." : !run.can.edit ? undefined : "Changes are kept with a reason and shown to the approver."}>
          {canEdit && (
            <>
              <WindowButton onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" /> Add head
              </WindowButton>
              <WindowButton
                onClick={async () => {
                  setBusy("recalc");
                  apply(await recalculateSlipAction(slip.id));
                  setBusy(null);
                }}
                disabled={!!busy}
              >
                {busy === "recalc" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recalculate
              </WindowButton>
              {data.permissions.delete && (
                <WindowButton variant="danger" onClick={() => setRemoving(true)} disabled={!!busy}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </WindowButton>
              )}
            </>
          )}
        </PaneActions>
      )}
      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-danger">
          {error}
        </p>
      )}
      <PaneSection title="Earnings">
        {heads === null ? <p className="text-ink-faint">Loading…</p> : lines(earnings)}
        <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium">
          <span>Gross earnings</span>
          <Amount value={slip.grossEarnings} emphasis />
        </div>
      </PaneSection>
      <PaneSection title="Deductions">
        {heads === null ? null : ded.length ? lines(ded) : <p className="text-ink-faint">None</p>}
        <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium">
          <span>Total deductions</span>
          <Amount value={slip.totalDeductions} emphasis />
        </div>
      </PaneSection>
      {slip.arrearsDetail && slip.arrearsDetail.length > 0 && (
        <PaneSection title="Arrears: the months">
          <table className="w-full text-2xs">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-0.5 pr-2 font-medium">Month</th>
                <th className="py-0.5 pr-2 font-medium">Why</th>
                <th className="py-0.5 pr-2 text-right font-medium">Paid</th>
                <th className="py-0.5 pr-2 text-right font-medium">Due</th>
                <th className="py-0.5 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {slip.arrearsDetail.map((l) => (
                <tr key={`${l.calendar}-${l.year}-${l.month}`} className="border-t border-line">
                  <td className="py-0.5 pr-2 text-ink">{l.label}</td>
                  <td className="py-0.5 pr-2 text-ink-muted">{l.kind === "salary" ? "Salary revision" : "Attendance corrected"}</td>
                  <td className="py-0.5 pr-2 text-right tabular-nums"><Amount value={l.paid.grossEarnings} /></td>
                  <td className="py-0.5 pr-2 text-right tabular-nums"><Amount value={l.due.grossEarnings} /></td>
                  <td className="py-0.5 text-right tabular-nums"><Amount value={l.diff.grossEarnings} emphasis /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </PaneSection>
      )}
      {slip.settlementDetail && (
        <PaneSection title="Settlement">
          <p className="mb-1 text-2xs text-ink-muted">
            Last working day {slip.settlementDetail.lastWorkingDay} · {slip.settlementDetail.monthsServed} months served
            {slip.settlementDetail.month === null ? " · the last month was already paid" : slip.settlementDetail.month.unpaidDays ? ` · ${slip.settlementDetail.month.unpaidDays} unpaid days in ${slip.settlementDetail.month.label}` : ""}
          </p>
          <dl className="space-y-0.5 text-2xs">
            {slip.settlementDetail.earnings.map((l, i) => (
              <div key={`e${i}`} className="flex justify-between gap-2">
                <dt className="text-ink">{l.label}</dt>
                <dd className="tabular-nums"><Amount value={l.amount} /></dd>
              </div>
            ))}
            {slip.settlementDetail.deductions.map((l, i) => (
              <div key={`d${i}`} className="flex justify-between gap-2 text-ink-muted">
                <dt>{l.label}</dt>
                <dd className="tabular-nums">−<Amount value={l.amount} /></dd>
              </div>
            ))}
          </dl>
          {slip.settlementDetail.gratuity.reason && <p className="mt-1 text-3xs text-ink-faint">No gratuity: {slip.settlementDetail.gratuity.reason}.</p>}
        </PaneSection>
      )}
      {slip.taxDetail && slip.taxDetail.method === "ytd" && (
        <PaneSection title="Income tax">
          {(() => {
            const t = slip.taxDetail!;
            const n = (v: string | number) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            return (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs">
                <dt className="text-ink-muted">Paid so far this year</dt>
                <dd className="text-right tabular-nums text-ink">{n(t.ytd.taxableGross)} taxable · {t.ytd.months} month{t.ytd.months === 1 ? "" : "s"}</dd>
                <dt className="text-ink-muted">This month taxable</dt>
                <dd className="text-right tabular-nums text-ink">{n(t.month.taxableGross)}{Number(t.month.oneOffTaxable) ? ` (one-off ${n(t.month.oneOffTaxable)})` : ""}</dd>
                <dt className="text-ink-muted">Projected year</dt>
                <dd className="text-right tabular-nums text-ink">{n(t.projected.gross)} − retirement {n(t.projected.retirement)} − insurance {n(t.month.insuranceAnnual)} = {n(t.projected.taxable)}</dd>
                <dt className="text-ink-muted">Annual tax</dt>
                <dd className="text-right tabular-nums text-ink">{n(t.annualTax)} · deducted so far {n(t.ytd.tds)}</dd>
                <dt className="text-ink-muted">{t.monthsRemaining === 1 ? "Year-end month: the rest" : `Spread over ${t.monthsRemaining} months`}</dt>
                <dd className="text-right font-medium tabular-nums text-ink">{n(t.tdsThisMonth)}</dd>
              </dl>
            );
          })()}
        </PaneSection>
      )}
      <PaneSection>
        <div className="flex items-center justify-between text-sm font-semibold text-ink">
          <span>Net payable</span>
          <Amount value={slip.netPayable} emphasis />
        </div>
        <p className="mt-1 text-2xs text-ink-muted">
          {slip.bankName && slip.bankName !== "N/A" ? `${slip.bankName} · ${slip.bankAccountNumber}` : "No bank account on file"} · employer SSF <Amount value={slip.ssfEmployer} /> · taxable <Amount value={slip.taxableIncome} />
        </p>
        {slip.warnings && <p className="mt-1 whitespace-pre-line text-2xs text-warning">{slip.warnings}</p>}
      </PaneSection>

      {editing && (
        <OverrideWindow
          slip={slip}
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={async (amount, reason) => {
            const payload: Parameters<typeof overrideSlipAction>[0] = { slipId: slip.id, reason };
            if (editing.id === "basic-salary") payload.basicSalary = amount;
            else if (editing.id === "grade-amount") payload.gradeAmount = amount;
            else if (editing.id === "ot-amount") payload.otAmount = amount;
            else if (editing.id === "absent-deduction") payload.absentDeduction = amount;
            else if (editing.id === "loan-deduction") payload.loanDeduction = amount;
            else {
              payload.headId = editing.id;
              payload.amount = amount;
            }
            const r = await overrideSlipAction(payload);
            if (!apply(r)) return r.success ? "Not changed." : r.error;
            setEditing(null);
            return null;
          }}
        />
      )}
      {adding && (
        <AddHeadWindow
          slip={slip}
          heads={data.allPayHeads.filter((h) => !(heads ?? []).some((x) => x.payHeadId === h.id))}
          onClose={() => setAdding(false)}
          onSaved={async (payHeadId, amount, reason) => {
            const r = await addSlipHeadAction({ slipId: slip.id, payHeadId, amount, reason });
            if (!apply(r)) return r.success ? "Not added." : r.error;
            setAdding(false);
            return null;
          }}
        />
      )}
      <Confirm
        open={removing}
        title={`Remove ${slip.employeeName} from ${run.label}?`}
        message="Their payslip is deleted from this run. They can be paid in a later run."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          const r = await removeSlipAction(slip.id);
          setRemoving(false);
          if (!r.success) setError(r.error);
          else onChanged();
        }}
        onCancel={() => setRemoving(false)}
      />
    </div>
  );
}

function OverrideWindow({ slip, line, onClose, onSaved }: { slip: PayrollSlip; line: NonNullable<Editing>; onClose: () => void; onSaved: (amount: string, reason: string) => Promise<string | null> }) {
  const [amount, setAmount] = useState(Number(line.amount) || 0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const e = await onSaved(String(amount), reason);
    setBusy(false);
    if (e) setFailure(e);
  };
  return (
    <Window open onClose={busy ? () => {} : onClose} size="sm" title={`Change ${line.label}`} description={`${slip.employeeName}: the figure for this month only. Income tax, SSF and net are worked out again.`} footer={<><span className="mr-auto text-2xs text-danger">{failure}</span><WindowCancel disabled={busy} /><WindowButton variant="primary" onClick={go} disabled={busy || reason.trim().length < 3}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</WindowButton></>}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-label">
          Amount
          <NumberField name="amount" value={amount} onChange={setAmount} prefix="NPR" className="mt-1" aria-label="Amount" />
        </label>
        <label className="block text-xs font-medium text-ink-label">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1 max-w-none")} placeholder="e.g. Arrears for Bhadra agreed with the employee" />
        </label>
      </div>
    </Window>
  );
}

function AddHeadWindow({ slip, heads, onClose, onSaved }: { slip: PayrollSlip; heads: PayrollRunsPageData["allPayHeads"]; onClose: () => void; onSaved: (payHeadId: string, amount: string, reason: string) => Promise<string | null> }) {
  const [payHeadId, setPayHeadId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    const e = await onSaved(payHeadId, String(amount), reason);
    setBusy(false);
    if (e) setFailure(e);
  };
  return (
    <Window open onClose={busy ? () => {} : onClose} size="sm" title="Add a pay head" description={`${slip.employeeName}: an allowance or deduction for this month only.`} footer={<><span className="mr-auto text-2xs text-danger">{failure}</span><WindowCancel disabled={busy} /><WindowButton variant="primary" onClick={go} disabled={busy || !payHeadId || !(amount > 0) || reason.trim().length < 3}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add</WindowButton></>}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-label">
          Pay head
          <div className="mt-1">
            <SelectField name="payHeadId" options={heads.map((h) => ({ value: h.id, label: `${h.name} (${h.type})` }))} value={payHeadId} onChange={setPayHeadId} placeholder="Choose a pay head" allowEmpty />
          </div>
        </label>
        <label className="block text-xs font-medium text-ink-label">
          Amount
          <NumberField name="amount" value={amount} onChange={setAmount} prefix="NPR" className="mt-1" aria-label="Amount" />
        </label>
        <label className="block text-xs font-medium text-ink-label">
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1 max-w-none")} />
        </label>
      </div>
    </Window>
  );
}
