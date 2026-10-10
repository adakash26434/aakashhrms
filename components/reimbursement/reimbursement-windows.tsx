"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Combobox } from "@/components/kit/combobox";
import { DateField } from "@/components/kit/date-field";
import { Notice } from "@/components/kit/notice";
import { NumberField } from "@/components/kit/number-field";
import { FieldGroup, FieldRow, PropertyForm, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { Amount } from "@/components/kit/amount";
import { DateCell } from "@/components/kit/date-cell";
import { StatusChip } from "@/components/kit/status-chip";
import { moveReimbursementClaimAction, saveReimbursementClaimAction, saveReimbursementTypeAction } from "@/app/actions/reimbursement.actions";
import { nprText } from "@/lib/engines/reimbursement.engine";
import type { ReimbursementClaimRow, ReimbursementPage, ReimbursementTypeRow } from "@/lib/types/reimbursement";

// Reimbursements (4.8 / F16): the claim, decision and type windows. The server checks everything
// again (scope, caps, S21); these windows only collect what is typed and show what it says.

type Fail = { success: false; error: string; validationErrors?: Record<string, string> };
const errorsOf = (r: Fail) => ("validationErrors" in r && r.validationErrors) || {};

export function ClaimWindow({
  data,
  claim,
  onClose,
  onSaved,
}: {
  data: ReimbursementPage;
  /** A draft to edit; null for a new claim. */
  claim: ReimbursementClaimRow | null;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [form, setForm] = useState({
    employeeId: claim?.employeeId ?? "",
    typeId: claim?.typeId ?? "",
    expenseDate: claim?.expenseDate ?? "",
    amount: claim?.amount ?? 0,
    receiptNo: claim?.receiptNo ?? "",
    description: claim?.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const type = data.types.find((t) => t.id === form.typeId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const save = (submit: boolean) =>
    start(async () => {
      setError(null);
      const r = await saveReimbursementClaimAction(claim?.id ?? null, form, submit);
      if (r.success) onSaved(submit ? `Claim of ${nprText(r.data.amount)} submitted for approval.` : "Draft saved.");
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={claim ? "Edit draft claim" : "New reimbursement claim"}
      description="One bill per claim. Approved claims are paid with the next pay run."
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Cancel
          </WindowButton>
          <WindowButton onClick={() => save(false)} disabled={pending}>
            Save draft
          </WindowButton>
          {!claim && (
            <WindowButton variant="primary" onClick={() => save(true)} disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save and submit
            </WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title="Claim">
            <FieldRow label="Employee" required error={errors.employeeId}>
              <Combobox
                options={data.employees.map((e) => ({ value: e.id, label: e.name, hint: e.code, keywords: e.code }))}
                value={form.employeeId}
                onChange={(v) => set("employeeId", v)}
                disabled={!!claim}
                placeholder="Type a name or code"
              />
            </FieldRow>
            <FieldRow
              label="For"
              required
              error={errors.typeId}
              help={type ? [type.taxable ? "Taxable" : "Not taxable", type.perClaimCap > 0 ? `at most ${nprText(type.perClaimCap)} a claim` : null, type.yearlyCap > 0 ? `${nprText(type.yearlyCap)} a year` : null].filter(Boolean).join(" · ") : undefined}
            >
              <SelectField
                options={data.types.filter((t) => t.isActive || t.id === form.typeId).map((t) => ({ value: t.id, label: t.name, hint: t.code }))}
                value={form.typeId}
                onChange={(v) => set("typeId", v)}
                placeholder="Choose"
              />
            </FieldRow>
            <FieldRow label="Bill date" required error={errors.expenseDate}>
              <DateField value={form.expenseDate} onChange={(v) => set("expenseDate", v)} />
            </FieldRow>
            <FieldRow label="Amount" required error={errors.amount}>
              <NumberField value={form.amount} onChange={(v) => set("amount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label="Bill / receipt no." required={type?.receiptRequired ?? true} error={errors.receiptNo}>
              <input className={inputClass} value={form.receiptNo} maxLength={60} onChange={(e) => set("receiptNo", e.target.value)} />
            </FieldRow>
            <FieldRow label="What for" required error={errors.description} wide>
              <textarea className={`${inputClass} h-auto min-h-16 max-w-none py-2`} value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

/** Approve, return to draft or reject a submitted claim (never one's own: the server refuses). */
export function DecisionWindow({ claim, onClose, onDone }: { claim: ReimbursementClaimRow; onClose: () => void; onDone: (text: string) => void }) {
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (to: "approved" | "draft" | "rejected") =>
    start(async () => {
      setError(null);
      const r = await moveReimbursementClaimAction(claim.id, to, note);
      if (r.success) onDone(to === "approved" ? `${claim.employeeName}'s claim approved: the next pay run pays it.` : to === "draft" ? "Returned to the employee to change." : "Claim rejected.");
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={`${claim.typeName} · ${claim.employeeName}`}
      size="md"
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            Close
          </WindowButton>
          <WindowButton onClick={() => decide("rejected")} disabled={pending}>
            Reject
          </WindowButton>
          <WindowButton onClick={() => decide("draft")} disabled={pending}>
            Return
          </WindowButton>
          <WindowButton variant="primary" onClick={() => decide("approved")} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Approve
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Notice tone="danger">{error}</Notice>}
        {errors.amount && <Notice tone="warning">{errors.amount}</Notice>}
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-ink-muted">Employee</dt>
          <dd className="text-ink">
            {claim.employeeName} <span className="text-ink-faint">{claim.employeeCode}</span>
          </dd>
          <dt className="text-ink-muted">For</dt>
          <dd className="text-ink">
            {claim.typeName} <span className="text-ink-faint">({claim.taxable ? "taxable" : "not taxable"})</span>
          </dd>
          <dt className="text-ink-muted">Bill date</dt>
          <dd>
            <DateCell value={claim.expenseDate} />
          </dd>
          <dt className="text-ink-muted">Amount</dt>
          <dd>
            <Amount value={claim.amount} prefix="NPR" emphasis />
          </dd>
          <dt className="text-ink-muted">Bill / receipt no.</dt>
          <dd className="text-ink">{claim.receiptNo || "—"}</dd>
          <dt className="text-ink-muted">What for</dt>
          <dd className="whitespace-pre-wrap text-ink">{claim.description}</dd>
          <dt className="text-ink-muted">Status</dt>
          <dd>
            <StatusChip status={claim.status} />
          </dd>
        </dl>
        <PropertyForm>
          <FieldGroup title="Decision">
            <FieldRow label="Note" help="Needed to return or reject: say what to change or why." error={errors.note} wide>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}

export function TypeWindow({ type, onClose, onSaved }: { type: ReimbursementTypeRow | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [form, setForm] = useState({
    code: type?.code ?? "",
    name: type?.name ?? "",
    nameNp: type?.nameNp ?? "",
    taxable: type?.taxable ?? false,
    perClaimCap: type?.perClaimCap ?? 0,
    yearlyCap: type?.yearlyCap ?? 0,
    receiptRequired: type?.receiptRequired ?? true,
    isActive: type?.isActive ?? true,
  });
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
      const r = await saveReimbursementTypeAction(type?.id ?? null, form);
      if (r.success) onSaved(`${r.data.name} saved.`);
      else {
        setErrors(errorsOf(r));
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={type ? `Edit ${type.name}` : "New reimbursement type"}
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
            <FieldRow label="Code" required help={type ? "A type's code never changes." : "e.g. MEDICAL, MOBILE, FUEL"} error={errors.code}>
              <input className={inputClass} value={form.code} maxLength={30} readOnly={!!type} onChange={(e) => set("code", e.target.value.toUpperCase())} />
            </FieldRow>
            <FieldRow label="Name" required error={errors.name}>
              <input className={inputClass} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
            </FieldRow>
            <FieldRow label="Name (नेपाली)" help="Shown in self-service when the employee reads Nepali." error={errors.nameNp}>
              <input className={inputClass} value={form.nameNp} maxLength={100} onChange={(e) => set("nameNp", e.target.value)} />
            </FieldRow>
            <FieldRow label="Taxable" help="Yes: paid as taxable income (REIMBURSE_TAX). No: a reimbursement of costs (REIMBURSE).">
              <YesNoField name="taxable" value={form.taxable} onChange={(v) => set("taxable", v)} />
            </FieldRow>
          </FieldGroup>
          <FieldGroup title="Limits">
            <FieldRow label="Most per claim" help="0 = no limit." error={errors.perClaimCap}>
              <NumberField value={form.perClaimCap} onChange={(v) => set("perClaimCap", v)} prefix="NPR" showZero />
            </FieldRow>
            <FieldRow label="Most per year" help="Per employee and fiscal year; 0 = no limit." error={errors.yearlyCap}>
              <NumberField value={form.yearlyCap} onChange={(v) => set("yearlyCap", v)} prefix="NPR" showZero />
            </FieldRow>
            <FieldRow label="Bill number needed">
              <YesNoField name="receiptRequired" value={form.receiptRequired} onChange={(v) => set("receiptRequired", v)} />
            </FieldRow>
            <FieldRow label="In use" help="No: kept for its claims, not offered for new ones.">
              <YesNoField name="isActive" value={form.isActive} onChange={(v) => set("isActive", v)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
