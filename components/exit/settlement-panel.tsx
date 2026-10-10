"use client";

import { useEffect, useState, useTransition } from "react";
import { Calculator, CheckCircle2, Printer, Settings2, Wallet } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { NumberField } from "@/components/kit/number-field";
import { YesNoField } from "@/components/kit/yes-no-field";
import { inputClass } from "@/components/kit/property-form";
import { approveSettlementAction, getSettlementAction, markSettlementPaidAction, prepareSettlementAction, saveSettlementPolicyAction } from "@/app/actions/settlement.actions";
import type { SettlementPolicy } from "@/lib/engines/settlement.engine";
import type { SettlementData, SettlementView } from "@/lib/types/settlement";

// Full & final settlement (4.8 / F8) inside the exit case window: prepare (frozen
// statement), approve (a second person), mark paid (with the payment reference),
// print. The company's gratuity / notice policy is edited here by SYSTEM_CONTROL.

const CHIP = { draft: "pending", approved: "approved", paid: "approved" } as const;
const LABEL = { draft: "Draft", approved: "Approved", paid: "Paid" } as const;

export function SettlementPanel({ caseId, caseOpen }: { caseId: string; caseOpen: boolean }) {
  const [data, setData] = useState<SettlementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [editing, setEditing] = useState(false);
  const [policy, setPolicy] = useState<SettlementPolicy | null>(null);
  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSettlementAction(caseId);
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const run = (step: () => Promise<{ success: true; data: SettlementView } | { success: false; error: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await step();
      if (result.success) setData((d) => (d ? { ...d, settlement: result.data } : d));
      else setError(result.error);
    });

  const savePolicy = () =>
    startTransition(async () => {
      if (!policy) return;
      setError(null);
      setPolicyErrors({});
      const result = await saveSettlementPolicyAction(policy);
      if (result.success) {
        setData((d) => (d ? { ...d, policy: result.data } : d));
        setEditing(false);
      } else {
        setPolicyErrors("validationErrors" in result && result.validationErrors ? result.validationErrors : {});
        setError(result.error);
      }
    });

  if (!data) return <p className="text-xs text-ink-muted">{error ?? "Loading settlement…"}</p>;
  const s = data.settlement;
  const can = data.permissions;

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Full &amp; final settlement · अन्तिम भुक्तानी</h3>
        {s && <StatusChip status={CHIP[s.status]} label={LABEL[s.status]} />}
        <span className="ml-auto flex gap-1">
          {can.policy && (
            <WindowButton
              onClick={() => {
                setPolicy(data.policy);
                setEditing((v) => !v);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" /> Policy
            </WindowButton>
          )}
          {s && (
            <WindowButton onClick={() => window.open(`/workforce/exit/${caseId}/settlement`, "_blank", "noopener")}>
              <Printer className="h-3.5 w-3.5" /> Print
            </WindowButton>
          )}
        </span>
      </div>

      {error && (
        <Notice tone="danger" className="mb-2">
          {error}
        </Notice>
      )}

      {editing && policy && (
        <div className="mb-3 grid gap-2 rounded-md border border-line bg-surface-sunken p-3 text-sm sm:grid-cols-2">
          <label className="block">
            Notice period required (days, resignation)
            <NumberField decimals={0} value={policy.noticeDays} onChange={(v) => setPolicy({ ...policy, noticeDays: v })} showZero />
          </label>
          <div>
            Pay gratuity
            <YesNoField value={policy.gratuity.enabled} onChange={(v) => setPolicy({ ...policy, gratuity: { ...policy.gratuity, enabled: v } })} />
          </div>
          {policy.gratuity.enabled && (
            <>
              <label className="block">
                Minimum completed years
                <NumberField decimals={0} value={policy.gratuity.minYears} onChange={(v) => setPolicy({ ...policy, gratuity: { ...policy.gratuity, minYears: v } })} showZero />
              </label>
              <label className="block">
                Months of basic per year of service
                <NumberField decimals={2} value={policy.gratuity.monthsPerYear} onChange={(v) => setPolicy({ ...policy, gratuity: { ...policy.gratuity, monthsPerYear: v } })} aria-invalid={!!policyErrors.monthsPerYear} />
                {policyErrors.monthsPerYear && <span className="text-xs text-danger">{policyErrors.monthsPerYear}</span>}
              </label>
            </>
          )}
          <div className="sm:col-span-2">
            <WindowButton variant="primary" onClick={savePolicy} disabled={pending}>
              Save policy
            </WindowButton>
            <span className="ml-2 text-xs text-ink-faint">Applies to settlements prepared from now on. Gratuity is off until you set the company&apos;s rate.</span>
          </div>
        </div>
      )}

      {!s ? (
        <p className="text-xs text-ink-muted">
          Not prepared yet. Preparing works out the last salary, leave encashment, loan recovery and final tax and freezes the statement.
          {can.prepare && caseOpen && (
            <>
              {" "}
              <WindowButton className="ml-1" variant="primary" onClick={() => run(() => prepareSettlementAction(caseId))} disabled={pending}>
                <Calculator className="h-3.5 w-3.5" /> {pending ? "Working…" : "Prepare settlement"}
              </WindowButton>
            </>
          )}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody>
              {s.lines.map((l) => (
                <tr key={`${l.code}-${l.label}`} className="border-b border-line align-top last:border-0">
                  <td className="py-1.5 pr-2">
                    {l.label} <span className="text-ink-faint">· {l.labelNp}</span>
                    <div className="text-xs text-ink-faint">{l.basis}</div>
                  </td>
                  <td className="py-1.5 text-right">
                    <Amount value={l.side === "deduction" ? -Number(l.amount) : Number(l.amount)} />
                  </td>
                </tr>
              ))}
              {s.lines.length === 0 && (
                <tr>
                  <td className="py-2 text-xs text-ink-muted">Nothing is due or owed.</td>
                </tr>
              )}
              <tr className="border-t border-line">
                <td className="py-2 font-semibold">{s.recovery ? "Recoverable from the employee" : "Net payable"}</td>
                <td className="py-2 text-right">
                  <Amount value={Number(s.net)} emphasis />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-xs text-ink-faint">
            Prepared by {s.preparedByName}
            {s.approvedByName && <> · approved by {s.approvedByName}</>}
            {s.paidByName && (
              <>
                {" "}· paid by {s.paidByName} (ref {s.paymentRef})
              </>
            )}
          </p>
          {data.funds.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              Welfare funds held (paid under Payroll → Funds, not in this total):{" "}
              {data.funds.map((f, i) => (
                <span key={f.fund}>
                  {i > 0 && ", "}
                  {f.fund} <Amount value={Number(f.total)} />
                </span>
              ))}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {s.status === "draft" && can.prepare && (
              <WindowButton onClick={() => run(() => prepareSettlementAction(caseId))} disabled={pending}>
                <Calculator className="h-3.5 w-3.5" /> Prepare again
              </WindowButton>
            )}
            {s.status === "draft" && can.approve && (
              <WindowButton variant="primary" onClick={() => run(() => approveSettlementAction(caseId))} disabled={pending}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </WindowButton>
            )}
            {s.status === "approved" && can.pay && (
              <>
                <input className={`${inputClass} max-w-48`} placeholder="Payment reference" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} aria-label="Payment reference" />
                <WindowButton variant="primary" onClick={() => run(() => markSettlementPaidAction(caseId, ref))} disabled={pending || !ref.trim()}>
                  <Wallet className="h-3.5 w-3.5" /> Mark paid
                </WindowButton>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
