"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Window, WindowButton } from "@/components/kit/window";
import { PropertyForm, FieldGroup, FieldRow, inputClass } from "@/components/kit/property-form";
import { SelectField } from "@/components/kit/select-field";
import { DateField } from "@/components/kit/date-field";
import { Notice } from "@/components/kit/notice";
import { TRAVEL_MODES } from "@/lib/engines/travel.engine";
import { submitMyClaimAction } from "@/app/actions/ess-extras.actions";
import { t, type EssKey, type EssLang } from "@/lib/i18n/ess";
import type { ClaimRow } from "@/lib/types/travel";
import { adToBSString } from "@/lib/utils/bs-calendar";

// My travel claims (G12): the employee's own claims and a submit form. Amounts
// come from the rate card on the server; the employee types only the trip facts.

const bs = (iso: string) => { try { return adToBSString(new Date(`${iso}T00:00:00`)); } catch { return iso; } };
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MyClaimsClient({ lang, claims, hasRateCard }: { lang: EssLang; claims: ClaimRow[]; hasRateCard: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const L = (k: EssKey) => t(lang, k);
  const statusVariant = (s: ClaimRow["status"]) => (s === "approved" || s === "settled" ? "success" : s === "rejected" ? "danger" : s === "submitted" ? "pending" : "draft");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-payroll-navy">{L("claims.title")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{L("claims.description")}</p>
        </div>
        {hasRateCard && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-payroll-primary px-4 text-xs font-bold text-white shadow-2xs hover:bg-payroll-navy">
            <Plus className="h-4 w-4" /> {L("claims.new")}
          </button>
        )}
      </header>
      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {claims.length === 0 ? (
        <p className="text-sm text-zinc-600">{L("claims.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-payroll-border bg-white shadow-payroll-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-payroll-border text-left text-xs text-zinc-500">
                <th className="px-4 py-2">{L("claims.trip")}</th>
                <th className="px-4 py-2">{L("claims.start")}</th>
                <th className="px-4 py-2 text-right">{L("claims.days")}</th>
                <th className="px-4 py-2 text-right">{L("claims.gross")}</th>
                <th className="px-4 py-2 text-right">{L("claims.payable")}</th>
                <th className="px-4 py-2">{L("claims.status")}</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="border-b border-payroll-border/60">
                  <td className="px-4 py-2 font-medium text-payroll-navy">
                    {c.fromPlace} → {c.toPlace}
                    <span className="block text-2xs font-normal text-zinc-500">{c.purpose}</span>
                    {c.decisionNote && <span className="block text-2xs text-zinc-500">{L("claims.decision")}: {c.decisionNote}</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{bs(c.startAd)} <span className="text-2xs text-zinc-500">{c.startAd}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.days}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(c.gross)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{money(c.payable)}</td>
                  <td className="px-4 py-2"><Badge variant={statusVariant(c.status)} size="sm">{t(lang, `claims.status.${c.status}` as EssKey)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <NewClaimWindow
          lang={lang}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setNotice(L("claims.submitted"));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NewClaimWindow({ lang, onClose, onSaved }: { lang: EssLang; onClose: () => void; onSaved: () => void }) {
  const L = (k: EssKey) => t(lang, k);
  const [form, setForm] = useState({ purpose: "", fromPlace: "", toPlace: "", startAd: "", endAd: "", mode: "", km: "", fareActual: "", nights: "0", lodgingActual: "", advance: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const input = (k: keyof typeof form, mode?: "decimal" | "numeric") => <input className={inputClass} inputMode={mode} value={form[k]} onChange={(e) => set(k)(e.target.value)} />;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await submitMyClaimAction(form);
      if (result.success) onSaved();
      else {
        setErrors(("validationErrors" in result && result.validationErrors) || {});
        setError(result.error);
      }
    });

  return (
    <Window open onClose={onClose} title={L("claims.new")} size="md" dirty footer={<><WindowButton onClick={onClose}>{L("claims.cancel")}</WindowButton><WindowButton variant="primary" onClick={submit} disabled={pending}>{L("claims.submit")}</WindowButton></>}>
      <div className="space-y-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <PropertyForm enterNavigation>
          <FieldGroup title={L("claims.trip")}>
            <FieldRow label={L("claims.purpose")} required error={errors.purpose}>{input("purpose")}</FieldRow>
            <FieldRow label={L("claims.from")} required error={errors.fromPlace}>{input("fromPlace")}</FieldRow>
            <FieldRow label={L("claims.to")} required error={errors.toPlace}>{input("toPlace")}</FieldRow>
            <FieldRow label={L("claims.start")} required error={errors.startAd}><DateField value={form.startAd} onChange={set("startAd")} /></FieldRow>
            <FieldRow label={L("claims.end")} required error={errors.endAd}><DateField value={form.endAd} onChange={set("endAd")} /></FieldRow>
            <FieldRow label={L("claims.mode")} required error={errors.mode}><SelectField options={TRAVEL_MODES.map((m) => ({ value: m.code, label: m.name }))} value={form.mode} onChange={set("mode")} placeholder="—" /></FieldRow>
            {form.mode === "own_vehicle" ? <FieldRow label={L("claims.km")} required error={errors.km}>{input("km", "decimal")}</FieldRow> : <FieldRow label={L("claims.fare")} error={errors.fareActual}>{input("fareActual", "decimal")}</FieldRow>}
            <FieldRow label={L("claims.nights")} error={errors.nights}>{input("nights", "numeric")}</FieldRow>
            <FieldRow label={L("claims.lodging")} error={errors.lodgingActual}>{input("lodgingActual", "decimal")}</FieldRow>
            <FieldRow label={L("claims.advance")} error={errors.advance}>{input("advance", "decimal")}</FieldRow>
            <FieldRow label={L("claims.note")} error={errors.note}><textarea className={`${inputClass} h-auto min-h-14 max-w-none py-2`} value={form.note} maxLength={1000} onChange={(e) => set("note")(e.target.value)} /></FieldRow>
          </FieldGroup>
        </PropertyForm>
      </div>
    </Window>
  );
}
