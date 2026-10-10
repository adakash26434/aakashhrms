"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Banknote, Check, Loader2, Undo2, X } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateField } from "@/components/kit/date-field";
import { useDateText } from "@/components/kit/date-cell";
import { ImportWindow } from "@/components/kit/import-window";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { PaneTimeline, approvalSteps } from "@/components/kit/pane";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import {
  commitLoanOpeningImportAction,
  decideLoanRequestAction,
  disburseLoanAction,
  loanDetailAction,
  previewLoanOpeningImportAction,
  previewLoanRequestAction,
  recordLoanRepaymentAction,
  requestLoanAction,
  saveLoanTypeAction,
  writeOffLoanAction,
} from "@/app/actions/loan.actions";
import { KIND_LABEL, LOAN_OPENING_COLUMNS, MAX_INSTALLMENTS, PAID_VIA, PAID_VIA_LABEL, WRITE_OFF_REASON_MIN } from "@/lib/engines/loan.engine";
import { payMonthLabel } from "@/lib/utils/pay-month";
import type { ApprovalActionKind } from "@/lib/types/approval";
import type { LoanDetail, LoanRepaymentRow, LoanRequestPreview, LoanRequestRow, LoanRow, LoansPage, LoanTypeRow } from "@/lib/types/loan";

// Loans and salary advances (4.10): the windows. The server works out every amount and checks
// everything again (scope, limits, eligibility, the own-record rule, the approval engine, what
// unlocked payslips already deduct); these windows collect what is typed and show what it says.

type Fail = { success: false; error: string; validationErrors?: Record<string, string> };
const errorsOf = (r: Fail) => ("validationErrors" in r && r.validationErrors) || {};
export const rs = (n: number) => `NPR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
const textArea = `${inputClass} h-auto min-h-14 max-w-none py-2`;

const STEP_LABEL: Partial<Record<ApprovalActionKind, string>> = {
  submitted: "Asked",
  approved: "Approved",
  final_approved: "Approved as company administrator",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  skipped: "Skipped",
  not_required: "Approved (approvals off)",
};

/** A request's status, in the list and the window. */
export function RequestStatus({ r }: { r: LoanRequestRow }) {
  switch (r.status) {
    case "pending":
      return <StatusChip status="pending" label={r.statusText} />;
    case "approved":
      return <StatusChip status="approved" label="To disburse" />;
    case "disbursed":
      return <StatusChip status="paid" label="Disbursed" />;
    case "rejected":
      return <StatusChip status="rejected" />;
    default:
      return <StatusChip status="cancelled" label="Withdrawn" />;
  }
}

/** A loan's status: running, or how it closed. */
export function LoanStatus({ l }: { l: LoanRow }) {
  if (l.status === "ACTIVE") return <StatusChip status="active" label={l.heldBySettlement ? "Running · settlement" : "Running"} />;
  if (l.closedHow === "written_off") return <StatusChip status="cancelled" label="Written off" />;
  if (l.closedHow === "settlement") return <StatusChip status="paid" label="Settled" />;
  return <StatusChip status="paid" label="Repaid" />;
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---- request --------------------------------------------------------------------------------

/** A new loan or salary advance request (HR on someone's behalf; the server checks the type's limits). */
export function RequestWindow({ data, onClose, onSaved }: { data: LoansPage; onClose: () => void; onSaved: (text: string) => void }) {
  const offered = data.types.filter((t) => t.isActive);
  const [form, setForm] = useState({ employeeId: "", loanTypeId: offered.length === 1 ? offered[0].id : "", amount: 0, installments: offered.length === 1 ? offered[0].maxInstallments : 0, reason: "" });
  const [preview, setPreview] = useState<LoanRequestPreview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const type = offered.find((t) => t.id === form.loanTypeId) ?? null;

  // The server works out the limit, the installment and what saving does as the form is filled.
  const { employeeId, loanTypeId, amount, installments } = form;
  useEffect(() => {
    if (!employeeId || !loanTypeId) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await previewLoanRequestAction({ employeeId, loanTypeId, amount, installments, reason: "preview" });
      if (live && r.success) setPreview(r.data);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [employeeId, loanTypeId, amount, installments]);
  const shown = employeeId && loanTypeId ? preview : null;
  // What the server says is wrong, once that field has something in it.
  const soft = (key: "employeeId" | "loanTypeId" | "amount" | "installments") => errors[key] || (shown && form[key] ? shown.problems[key] : undefined);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await requestLoanAction(form);
      if (r.success) onSaved(r.data.status === "approved" ? "Requested and approved at once (approvals for loans are off): disburse it when it is paid out." : `Requested: ${r.data.statusText.toLowerCase()}.`);
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title="New loan or salary advance"
      description="Asked for an employee in your scope. Someone else approves it; it is then paid out and payroll recovers it."
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit request
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Request">
            <FieldRow label="Employee" required error={soft("employeeId")}>
              <Combobox options={data.employees.map((e) => ({ value: e.id, label: e.name, hint: e.code, keywords: e.code }))} value={form.employeeId} onChange={(v) => set("employeeId", v)} placeholder="Type a name or code" />
            </FieldRow>
            <FieldRow label="Type" required error={soft("loanTypeId")} help={type ? `${KIND_LABEL[type.kind]} · up to ${months(type.maxInstallments)}${type.interestRate ? ` · ${type.interestRate}% interest (flat, once)` : " · no interest"}` : undefined}>
              <SelectField
                options={offered.map((t) => ({ value: t.id, label: t.name }))}
                value={form.loanTypeId}
                onChange={(v) => {
                  set("loanTypeId", v);
                  const t = offered.find((x) => x.id === v);
                  if (t && (!form.installments || form.installments > t.maxInstallments)) set("installments", t.maxInstallments);
                }}
                placeholder="Choose"
              />
            </FieldRow>
            <FieldRow
              label="Amount"
              required
              error={soft("amount")}
              help={shown ? (shown.needsSalary ? "No salary structure in force: the limit can't be worked out" : shown.limit !== null ? `At most ${rs(shown.limit)} (${shown.limitBasis})` : "No limit for this type") : undefined}
            >
              <NumberField value={form.amount} onChange={(v) => set("amount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label="Months to repay" required error={soft("installments")} help={type ? `At most ${type.maxInstallments}` : undefined}>
              <NumberField value={form.installments} onChange={(v) => set("installments", v)} decimals={0} />
            </FieldRow>
            <FieldRow label="What it is for" required error={errors.reason} wide>
              <textarea className={textArea} value={form.reason} maxLength={500} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Motorbike for field visits" />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
        {shown?.terms && (
          <Facts
            items={[
              ["Each month", rs(Number(shown.terms.installment))],
              ["Months", `${shown.terms.months}${Number(shown.terms.lastInstallment) !== Number(shown.terms.installment) ? ` (last ${rs(Number(shown.terms.lastInstallment))})` : ""}`],
              ["Interest", rs(Number(shown.terms.interest))],
              ["Total to repay", rs(Number(shown.terms.totalPayable))],
              ["Running loans, a month", rs(shown.runningMonthly)],
              ["All installments", shown.burdenPct === null ? "—" : `${shown.burdenPct}% of basic + grade`],
            ]}
          />
        )}
        {shown && shown.burdenPct !== null && shown.burdenPct > 50 && <Notice tone="warning">With this one, loans take {shown.burdenPct}% of basic + grade each month.</Notice>}
        {shown && <p className="text-2xs text-ink-muted">{shown.route}</p>}
      </div>
    </Window>
  );
}

// ---- deciding -------------------------------------------------------------------------------

/** One request: what was asked, its timeline, and the steps this person may take. */
export function DecisionWindow({ request, onClose, onDone, onDisburse }: { request: LoanRequestRow; onClose: () => void; onDone: (text: string) => void; onDisburse: () => void }) {
  const dateText = useDateText();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | "withdraw" | null>(null);
  const pending = request.status === "pending";
  const decides = pending && (request.can.approve || request.can.reject);

  const act = async (decision: "approve" | "reject" | "withdraw") => {
    if (busy) return;
    if (decision === "reject" && note.trim().length < 3) {
      setError("Say why it is rejected (the person who asked reads it).");
      return;
    }
    setBusy(decision);
    const r = await decideLoanRequestAction(request.id, decision, note);
    setBusy(null);
    if (!r.success) return setError(r.error);
    const status = r.data.status;
    onDone(status === "approved" ? "Approved: it can be disbursed now." : status === "pending" ? "Approved at your level: it goes to the next level." : status === "rejected" ? "Rejected." : "Withdrawn.");
  };

  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      title={`${request.employeeName} · ${request.typeName}`}
      description={`${request.employeeCode} · asked by ${request.preparedByName ?? "—"}${request.source === "self_service" ? " in self-service" : ""} on ${dateText(request.requestedAt)}`}
      size="md"
      dirty={!!note.trim() && pending}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={!!busy}>
            Close
          </WindowButton>
          {pending && request.can.withdraw && (
            <WindowButton onClick={() => act("withdraw")} disabled={!!busy}>
              {busy === "withdraw" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Withdraw
            </WindowButton>
          )}
          {pending && request.can.reject && (
            <WindowButton variant="danger" onClick={() => act("reject")} disabled={!!busy}>
              {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject
            </WindowButton>
          )}
          {pending && request.can.approve && (
            <WindowButton variant="primary" onClick={() => act("approve")} disabled={!!busy}>
              {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
            </WindowButton>
          )}
          {request.status === "approved" && request.can.disburse && (
            <WindowButton variant="primary" onClick={onDisburse}>
              <Banknote className="h-3.5 w-3.5" /> Disburse
            </WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <RequestStatus r={request} />
          <Link href={`/workforce/employees/${request.employeeId}`} className="text-ink-muted underline underline-offset-2 hover:text-ink">
            Open the employee
          </Link>
        </div>
        <Facts
          items={[
            ["Amount", rs(request.amount)],
            ["Months", months(request.installments)],
            ["Each month", rs(Number(request.terms.installment))],
            ["Interest", request.interestRate ? `${request.interestRate}% · ${rs(Number(request.terms.interest))}` : "None"],
            ["Total to repay", rs(Number(request.terms.totalPayable))],
            ["Kind", KIND_LABEL[request.kind]],
          ]}
        />
        <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs">
          <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">What it is for</p>
          <p className="mt-0.5 text-ink">{request.reason}</p>
          {request.decisionNote && (
            <>
              <p className="mt-2 text-2xs font-medium uppercase tracking-wide text-ink-faint">Decision note</p>
              <p className="mt-0.5 text-ink">{request.decisionNote}</p>
            </>
          )}
        </div>
        {pending && request.can.reason && !request.can.approve && <Notice tone="info">{request.can.reason}</Notice>}
        {request.status === "approved" && !request.can.disburse && request.can.disburseReason && <Notice tone="info">{request.can.disburseReason}</Notice>}
        {decides && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              Note <span className="font-normal text-ink-faint">— needed to reject</span>
            </span>
            <textarea className={textArea} maxLength={500} value={note} onChange={(e) => (setNote(e.target.value), setError(null))} placeholder="e.g. Within the limit; guarantor on file" />
          </label>
        )}
        <section aria-label="Approval timeline">
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Timeline</p>
          <PaneTimeline steps={approvalSteps(request.timeline, { label: STEP_LABEL, dateText, waiting: request.status === "pending" && request.flow.type === "simple" ? "any approver other than the person who asked" : null })} />
        </section>
      </div>
    </Window>
  );
}

// ---- disbursement ---------------------------------------------------------------------------

/** Pays out an approved request: the loan starts with its terms frozen. */
export function DisburseWindow({ request, data, onClose, onDone }: { request: LoanRequestRow; data: LoansPage; onClose: () => void; onDone: (text: string) => void }) {
  const [form, setForm] = useState({ givenDate: data.today, firstDeductionMonth: data.payMonths[1]?.value ?? data.payMonths[0]?.value ?? "", paidVia: "bank", paymentRef: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const month = data.payMonths.find((m) => m.value === form.firstDeductionMonth)?.label;

  const save = () =>
    start(async () => {
      setError(null);
      const r = await disburseLoanAction(request.id, form);
      if (r.success) onDone(`Disbursed: payroll deducts ${rs(r.data.installment)} a month from ${month ?? "the chosen month"}.`);
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`Disburse · ${request.employeeName}`}
      description={`${request.typeName}: ${rs(request.amount)} over ${months(request.installments)}, ${rs(Number(request.terms.installment))} a month.`}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />} Disburse
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Paid out">
            <FieldRow label="Paid on" required error={errors.givenDate}>
              <DateField value={form.givenDate} onChange={(v) => set("givenDate", v)} />
            </FieldRow>
            <FieldRow label="How" required error={errors.paidVia}>
              <SelectField options={PAID_VIA.map((v) => ({ value: v, label: PAID_VIA_LABEL[v] }))} value={form.paidVia} onChange={(v) => set("paidVia", v)} />
            </FieldRow>
            <FieldRow label="Reference" required={form.paidVia !== "cash"} error={errors.paymentRef} help={form.paidVia === "cheque" ? "Cheque number" : form.paidVia === "bank" ? "Transfer or voucher number" : "Optional: voucher number"}>
              <input className={inputClass} value={form.paymentRef} maxLength={100} onChange={(e) => set("paymentRef", e.target.value)} />
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Recovery">
            <FieldRow label="Payroll deducts from" required error={errors.firstDeductionMonth} help="That month's regular pay run takes the first installment. If it is already worked out, recalculate the payslip — or it starts the month after.">
              <SelectField options={data.payMonths.map((m) => ({ value: m.value, label: `${m.label} pay run` }))} value={form.firstDeductionMonth} onChange={(v) => set("firstDeductionMonth", v)} />
            </FieldRow>
            <FieldRow label="Note" error={errors.note} wide>
              <textarea className={textArea} value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

// ---- repayment and write-off ----------------------------------------------------------------

/** Money received outside payroll (cash, a transfer). Never more than unlocked payslips leave. */
export function RepaymentWindow({ loan, today, onClose, onDone }: { loan: LoanRow; today: string; onClose: () => void; onDone: (text: string) => void }) {
  const open = Math.max(0, Number((loan.remaining - loan.reserved).toFixed(2)));
  const [form, setForm] = useState({ date: today, amount: open, note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const save = () =>
    start(async () => {
      setError(null);
      const r = await recordLoanRepaymentAction(loan.id, form);
      if (r.success) onDone(r.data.closed ? "Repayment recorded: the loan is repaid and closed." : `Repayment recorded: ${rs(r.data.remaining)} left.`);
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`Repayment · ${loan.employeeName}`}
      description={`${loan.typeName}: ${rs(loan.remaining)} left of ${rs(loan.totalPayable)}.`}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Record repayment
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        {loan.reserved > 0 && <Notice tone="info">{rs(loan.reserved)} is on the {loan.reservedIn.join(", ")} payslip, not yet locked: at most {rs(open)} can be repaid now.</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Received">
            <FieldRow label="On" required error={errors.date}>
              <DateField value={form.date} onChange={(v) => set("date", v)} />
            </FieldRow>
            <FieldRow label="Amount" required error={errors.amount} help={`Up to ${rs(open)}`}>
              <NumberField value={form.amount} onChange={(v) => set("amount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label="Receipt / note" error={errors.note} wide>
              <input className={inputClass} value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Receipt 1234" />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

/** Closes what is left as written off, with the decision's reason. */
export function WriteOffWindow({ loan, onClose, onDone }: { loan: LoanRow; onClose: () => void; onDone: (text: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const r = await writeOffLoanAction(loan.id, reason);
      if (r.success) onDone(`Written off: ${rs(r.data.writtenOff)}.`);
      else setError(errorsOf(r).reason ?? r.error);
    });
  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`Write off · ${loan.employeeName}`}
      description={`${loan.typeName}: ${rs(loan.remaining)} still owed is closed and no longer recovered.`}
      size="md"
      dirty={!!reason.trim()}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="danger" onClick={save} disabled={pending || reason.trim().length < WRITE_OFF_REASON_MIN}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Write off
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink">Why (the decision and its reference)</span>
          <textarea className={textArea} value={reason} maxLength={500} onChange={(e) => (setReason(e.target.value), setError(null))} placeholder="e.g. Board decision 12/2083: unrecoverable after absconding" />
        </label>
      </div>
    </Window>
  );
}

// ---- detail ---------------------------------------------------------------------------------

const REPAYMENT_COLUMNS: GridColumn<LoanRepaymentRow>[] = [
  { id: "date", header: "On", type: "date", value: (r) => r.date, width: 110 },
  { id: "how", header: "How", value: (r) => (r.method === "SALARY_DEDUCTION" ? `Payroll${r.payMonth ? ` · ${r.payMonth}` : ""}` : r.method === "SETTLEMENT" ? "Final settlement" : "Cash / transfer"), width: 170 },
  { id: "amount", header: "Amount", type: "amount", value: (r) => r.amount, total: "sum" },
  { id: "note", header: "Note", value: (r) => r.note ?? "", width: 180 },
  { id: "by", header: "Recorded by", value: (r) => r.byName ?? "", width: 140, defaultHidden: true },
];

/** One loan: its terms, what came back, what unlocked payslips will deduct. */
export function LoanDetailWindow({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const dateText = useDateText();
  const [detail, setDetail] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loanDetailAction(loanId).then((r) => {
      if (!live) return;
      if (r.success) setDetail(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [loanId]);
  const l = detail?.loan;
  return (
    <Window open onClose={onClose} title={l ? `${l.employeeName} · ${l.typeName}` : "Loan"} description={l ? `${l.employeeCode} · ${l.source === "opening" ? "carried from the old system" : `given ${dateText(l.givenDate)}`}` : undefined} size="lg" footer={<WindowButton onClick={onClose}>Close</WindowButton>}>
      {error && <Notice tone="danger">{error}</Notice>}
      {!detail && !error && (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      )}
      {l && detail && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <LoanStatus l={l} />
            {l.status === "CLOSED" && l.closedAt && <span className="text-ink-muted">closed {dateText(l.closedAt)}</span>}
          </div>
          <Facts
            items={[
              ["Amount given", rs(l.amount)],
              ["Interest", l.interestRate ? `${l.interestRate}% (flat, once)` : "None"],
              ["Total to repay", rs(l.totalPayable)],
              ["Each month", rs(l.installment)],
              ["Paid back", `${rs(l.returned)} (${l.repaidPct}%)`],
              ["Balance", rs(l.remaining)],
              ["Payroll deducts from", l.firstDeductionMonth ? payMonthLabel(l.firstDeductionMonth) : "the month it was given"],
              ["Installments left", l.status === "ACTIVE" ? String(l.installmentsLeft) : "—"],
              ...(l.writtenOff > 0 ? ([["Written off", rs(l.writtenOff)]] as [string, React.ReactNode][]) : []),
              ...(l.paidVia ? ([["Paid out by", `${PAID_VIA_LABEL[l.paidVia]}${l.paymentRef ? ` · ${l.paymentRef}` : ""}`]] as [string, React.ReactNode][]) : []),
            ]}
          />
          {l.heldBySettlement && <Notice tone="info">The final settlement is approved and recovers this loan when it is paid: nothing else moves it now.</Notice>}
          {detail.pending.length > 0 && (
            <Notice tone="info">
              On payslips not yet locked: {detail.pending.map((p) => `${p.payMonth} ${rs(p.amount)}`).join(", ")}. Locking the run posts it here.
            </Notice>
          )}
          {(l.note || l.closeNote) && (
            <p className="text-xs text-ink-muted">
              {l.note && <span>Note: {l.note}. </span>}
              {l.closeNote && <span>Closed: {l.closeNote}</span>}
            </p>
          )}
          <DataGrid id="loan-repayments" label="Repayments" columns={REPAYMENT_COLUMNS} rows={detail.repayments} getRowId={(r) => r.id} pageSize={0} empty={{ title: "Nothing repaid yet", description: "Payroll deductions appear here when their run is locked." }} />
        </div>
      )}
    </Window>
  );
}

// ---- loan types -----------------------------------------------------------------------------

export function LoanTypeWindow({ type, onClose, onSaved }: { type: LoanTypeRow | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [form, setForm] = useState({
    name: type?.name ?? "",
    nameNp: type?.nameNp ?? "",
    kind: type?.kind ?? "loan",
    maxAmount: type?.maxAmount ?? 0,
    maxSalaryMonths: type?.maxSalaryMonths ?? 0,
    maxInstallments: type?.maxInstallments ?? 12,
    interestRate: type?.interestRate ?? 0,
    eligibleAfterMonths: type?.eligibleAfterMonths ?? 0,
    selfService: type?.selfService ?? false,
    isActive: type?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const advance = form.kind === "advance";

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveLoanTypeAction(type?.id ?? null, form);
      if (r.success) onSaved(type ? "Loan type saved. Loans already given keep their terms." : "Loan type added.");
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={type ? `Edit · ${type.name}` : "New loan type"}
      description="The limits every request of this type is checked against. Loans already given keep the terms they were given with."
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton variant="primary" onClick={save} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Type">
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vehicle loan" />
            </FieldRow>
            <FieldRow label="Name in Nepali" error={errors.nameNp} help="Shown in self-service in Nepali">
              <input className={inputClass} value={form.nameNp} maxLength={100} onChange={(e) => set("nameNp", e.target.value)} placeholder="e.g. सवारी साधन ऋण" />
            </FieldRow>
            <FieldRow label="Kind" required error={errors.kind} help={advance ? "No interest; recovered within 12 months" : undefined}>
              <SelectField
                options={(["loan", "advance"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                value={form.kind}
                onChange={(v) => {
                  set("kind", v as "loan" | "advance");
                  if (v === "advance") {
                    set("interestRate", 0);
                    if (form.maxInstallments > MAX_INSTALLMENTS.advance) set("maxInstallments", 3);
                  }
                }}
              />
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Limits">
            <FieldRow label="Most it lends" error={errors.maxAmount} help="0: no fixed limit">
              <NumberField value={form.maxAmount} onChange={(v) => set("maxAmount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label="Or months of salary" error={errors.maxSalaryMonths} help="Up to this many months of basic + grade (0: no such limit); with both, the smaller wins">
              <NumberField value={form.maxSalaryMonths} onChange={(v) => set("maxSalaryMonths", v)} decimals={2} />
            </FieldRow>
            <FieldRow label="Months to repay, at most" required error={errors.maxInstallments}>
              <NumberField value={form.maxInstallments} onChange={(v) => set("maxInstallments", v)} decimals={0} />
            </FieldRow>
            <FieldRow label="Interest %" error={errors.interestRate} help="Flat, once on the amount: installment = (amount + interest) ÷ months">
              <NumberField value={form.interestRate} onChange={(v) => set("interestRate", v)} decimals={2} readOnly={advance} />
            </FieldRow>
            <FieldRow label="After months of service" error={errors.eligibleAfterMonths} help="0: from joining">
              <NumberField value={form.eligibleAfterMonths} onChange={(v) => set("eligibleAfterMonths", v)} decimals={0} />
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Use">
            <FieldRow label="Employees ask in self-service" error={errors.selfService} help="Only with a limit; someone else still approves">
              <YesNoField value={form.selfService} onChange={(v) => set("selfService", v)} />
            </FieldRow>
            <FieldRow label="Offered" error={errors.isActive} help="Switched off: no new requests; running loans continue">
              <YesNoField value={form.isActive} onChange={(v) => set("isActive", v)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

// ---- opening balances (F15) -----------------------------------------------------------------

/** Loans still being repaid from before this system, from a file (one row per loan). */
export function LoanOpeningImportWindow({ onClose, onImported }: { onClose: () => void; onImported: (text: string) => void }) {
  return (
    <ImportWindow
      title="Import loan opening balances"
      description="Loans employees are still repaying from before this system: the date given, the amount, what is still to recover and the installment payroll deducts from the next pay run. Never your own; one running loan of a type per person."
      columns={LOAN_OPENING_COLUMNS}
      templateFile="loan-opening-balances-template.csv"
      rowHint="Add one row per loan"
      commitLabel={(n) => (n ? `Save ${n} loan${n === 1 ? "" : "s"}` : "Save")}
      onClose={onClose}
      onPreview={async (csv) => {
        const r = await previewLoanOpeningImportAction(csv);
        return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error };
      }}
      onCommit={async (csv) => {
        const r = await commitLoanOpeningImportAction(csv);
        if (!r.success) return { ok: false, error: r.error };
        const text = `${r.data.saved} loan${r.data.saved === 1 ? "" : "s"} carried. Payroll deducts them from the next pay run it works out.`;
        onImported(text);
        return { ok: true, value: text };
      }}
    />
  );
}
