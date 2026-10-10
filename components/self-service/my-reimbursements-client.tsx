"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { DateField } from "@/components/kit/date-field";
import { NumberField } from "@/components/kit/number-field";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { Amount } from "@/components/kit/amount";
import { submitMyReimbursementAction } from "@/app/actions/ess-extras.actions";
import { nprText } from "@/lib/engines/reimbursement.engine";
import { t, type EssKey, type EssLang } from "@/lib/i18n/ess";
import type { ReimbursementClaimRow, ReimbursementTypeRow } from "@/lib/types/reimbursement";
import { adToBSString } from "@/lib/utils/bs-calendar";

// My reimbursements (F16): the employee's own claims and a submit form. The server takes the
// employee from the session, checks the type's limits and submits the claim at once.

const bs = (iso: string) => {
  try {
    return adToBSString(new Date(`${iso}T00:00:00`));
  } catch {
    return iso;
  }
};

export function MyReimbursementsClient({ lang, claims, types }: { lang: EssLang; claims: ReimbursementClaimRow[]; types: ReimbursementTypeRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const L = (k: EssKey) => t(lang, k);
  const typeName = (c: ReimbursementClaimRow) => (lang === "np" && c.typeNameNp ? c.typeNameNp : c.typeName);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{L("reimb.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{L("reimb.description")}</p>
        </div>
        {types.length > 0 && (
          <WindowButton variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {L("reimb.new")}
          </WindowButton>
        )}
      </header>
      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {types.length === 0 && <Notice tone="info">{L("reimb.noTypes")}</Notice>}
      {claims.length === 0 ? (
        <p className="text-sm text-ink-muted">{L("reimb.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-2">{L("reimb.type")}</th>
                <th className="px-4 py-2">{L("reimb.date")}</th>
                <th className="px-4 py-2 text-right">{L("reimb.amount")}</th>
                <th className="px-4 py-2">{L("claims.status")}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top">
                  <td className="px-4 py-2 font-medium text-ink">
                    {typeName(c)}
                    <span className="block text-2xs font-normal text-ink-muted">{c.description}</span>
                    {c.decisionNote && (
                      <span className="block text-2xs text-ink-muted">
                        {L("claims.decision")}: {c.decisionNote}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                    {bs(c.expenseDate)} <span className="hidden text-2xs text-ink-faint sm:inline">{c.expenseDate}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Amount value={c.amount} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusChip status={c.status} label={`${t(lang, `claims.status.${c.status}` as EssKey)}${c.status === "settled" && c.paidByPayroll ? ` · ${L("reimb.paidPayroll")}` : ""}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <NewReimbursementWindow
          lang={lang}
          types={types}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setNotice(L("reimb.submitted"));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewReimbursementWindow({ lang, types, onClose, onSaved }: { lang: EssLang; types: ReimbursementTypeRow[]; onClose: () => void; onSaved: () => void }) {
  const L = (k: EssKey) => t(lang, k);
  const [form, setForm] = useState({ typeId: types.length === 1 ? types[0].id : "", expenseDate: "", amount: 0, receiptNo: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const type = types.find((x) => x.id === form.typeId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const limits = type
    ? [
        type.perClaimCap > 0 ? L("reimb.perClaim").replace("{amount}", nprText(type.perClaimCap)) : null,
        type.yearlyCap > 0 ? L("reimb.perYear").replace("{amount}", nprText(type.yearlyCap)) : null,
      ].filter(Boolean)
    : [];

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await submitMyReimbursementAction(form);
      if (r.success) onSaved();
      else {
        setErrors(("validationErrors" in r && r.validationErrors) || {});
        setError(r.error);
      }
    });

  return (
    <Window
      open
      onClose={pending ? () => {} : onClose}
      title={L("reimb.new")}
      size="md"
      dirty
      footer={
        <>
          <WindowButton onClick={onClose} disabled={pending}>
            {L("claims.cancel")}
          </WindowButton>
          <WindowButton variant="primary" onClick={submit} disabled={pending}>
            {L("claims.submit")}
          </WindowButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title={L("reimb.new")}>
            <FieldRow label={L("reimb.type")} required error={errors.typeId} help={limits.length ? `${L("reimb.limits")}: ${limits.join(" · ")}` : undefined}>
              <SelectField options={types.map((x) => ({ value: x.id, label: lang === "np" && x.nameNp ? x.nameNp : x.name }))} value={form.typeId} onChange={(v) => set("typeId", v)} placeholder="—" />
            </FieldRow>
            <FieldRow label={L("reimb.date")} required error={errors.expenseDate}>
              <DateField value={form.expenseDate} onChange={(v) => set("expenseDate", v)} />
            </FieldRow>
            <FieldRow label={L("reimb.amount")} required error={errors.amount}>
              <NumberField value={form.amount} onChange={(v) => set("amount", v)} prefix="NPR" />
            </FieldRow>
            <FieldRow label={L("reimb.receipt")} required={type?.receiptRequired ?? true} error={errors.receiptNo}>
              <input className={inputClass} value={form.receiptNo} maxLength={60} onChange={(e) => set("receiptNo", e.target.value)} />
            </FieldRow>
            <FieldRow label={L("reimb.what")} required error={errors.description} wide>
              <textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={form.description} maxLength={500} onChange={(e) => set("description", e.target.value)} />
            </FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
