"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/kit/notice";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { acknowledgeFlagsAction, getVarianceReviewAction, holdSlipAction, publishRunAction, releaseSlipAction } from "@/app/actions/payroll-control.actions";
import type { VarianceFlag } from "@/lib/engines/payroll-control.engine";
import type { VarianceReview } from "@/lib/services/payroll-control.service";
import type { PayrollRun, PayrollSlip } from "@/lib/types/payroll";

// Payroll controls (4.8 / F1, F3): the variance review (flags against last
// month; approval waits until each one is acknowledged with a note) and the
// payslip release (publish a locked run, hold or release one payslip). The
// server decides who may do what and refuses the rest.

type Held = { id: string; employeeName: string; employeeCode: string; holdReason: string | null };

const buttonClass = "inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none";

const CODE_LABEL: Record<VarianceFlag["code"], string> = {
  net_change: "Net pay changed",
  non_positive_net: "Net pay is zero or negative",
  new_in_payroll: "New in payroll",
  missing_from_run: "Missing from this run",
  ot_high: "High overtime",
  no_bank_account: "No bank account",
};

export function PayrollControlsPanel({ run, slips, onChanged }: { run: PayrollRun; slips: PayrollSlip[]; onChanged?: () => void }) {
  const router = useRouter();
  const [review, setReview] = useState<VarianceReview | null>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [holdFor, setHoldFor] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = run.status === "LOCKED";
  const published = !!run.publishedAt;

  const load = useCallback(async () => {
    const result = await getVarianceReviewAction(run.id);
    if (result.success) {
      setReview(result.data.review);
      setHeld(result.data.held);
    } else setMessage({ tone: "danger", text: result.error });
  }, [run.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getVarianceReviewAction(run.id);
      if (cancelled) return;
      if (result.success) {
        setReview(result.data.review);
        setHeld(result.data.held);
      } else setMessage({ tone: "danger", text: result.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [run.id, run.status]);

  const done = (text: string) => {
    setMessage({ tone: "success", text });
    onChanged?.();
    router.refresh();
  };

  const acknowledge = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await acknowledgeFlagsAction(run.id, [...picked], note);
      if (result.success) {
        setReview(result.data);
        setPicked(new Set());
        setNote("");
        done("Acknowledged.");
      } else setMessage({ tone: "danger", text: result.error });
    });

  const publish = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await publishRunAction(run.id);
      if (result.success) done("Payslips published. Employees can now see them in the portal.");
      else setMessage({ tone: "danger", text: result.error });
    });

  const hold = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await holdSlipAction(holdFor, holdReason);
      if (result.success) {
        setHoldFor("");
        setHoldReason("");
        await load();
        done("Payslip held back from the employee.");
      } else setMessage({ tone: "danger", text: result.error });
    });

  const release = (slipId: string) =>
    startTransition(async () => {
      setMessage(null);
      const result = await releaseSlipAction(slipId);
      if (result.success) {
        await load();
        done("Payslip released.");
      } else setMessage({ tone: "danger", text: result.error });
    });

  if (!review) return message ? <Notice tone={message.tone}>{message.text}</Notice> : null;

  const acked = new Set(review.acknowledged);
  const open = review.flags.filter((f) => f.severity === "review" && !acked.has(f.key));
  const canAck = !locked && open.length > 0;

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-xs" aria-label="Payroll controls">
      {message && <Notice tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</Notice>}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Variance review</h2>
          <span className="text-xs text-ink-muted">
            {review.comparedWith ? `Compared with ${review.comparedWith}; net changes of ${review.thresholdPct}% or more are flagged.` : "No earlier run for these branches to compare with."}
          </span>
        </div>
        {review.flags.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing to look at: no flags on this run.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-muted">
              {open.length > 0 ? `${open.length} flag(s) must be acknowledged before this run can be approved.` : "Every flag has been acknowledged."}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    {canAck && <th className="w-8 px-2 py-1.5" />}
                    <th className="px-2 py-1.5">Employee</th>
                    <th className="px-2 py-1.5">Flag</th>
                    <th className="px-2 py-1.5">Detail</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {review.flags.map((f) => {
                    const isAcked = acked.has(f.key);
                    const needs = f.severity === "review" && !isAcked;
                    return (
                      <tr key={f.key} className="border-b border-line/60 align-top">
                        {canAck && (
                          <td className="px-2 py-1.5">
                            {needs && (
                              <input
                                type="checkbox"
                                aria-label={`Acknowledge ${f.name}: ${CODE_LABEL[f.code]}`}
                                checked={picked.has(f.key)}
                                onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(f.key); else n.delete(f.key); return n; })}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-2 py-1.5 font-medium text-ink">{f.name} <span className="font-normal text-ink-faint">{f.employeeCode}</span></td>
                        <td className="px-2 py-1.5">{CODE_LABEL[f.code]}</td>
                        <td className="px-2 py-1.5 text-ink-muted">{f.detail}</td>
                        <td className="px-2 py-1.5">
                          {f.severity === "info" ? <StatusChip status="draft" label="For information" /> : isAcked ? <StatusChip status="approved" label="Acknowledged" /> : <StatusChip status="pending" label="Needs a look" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {canAck && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1">
                  <label className="mb-1 block text-xs text-ink-muted" htmlFor="ack-note">Note (why this is expected)</label>
                  <input id="ack-note" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button type="button" className={primaryClass} disabled={pending || picked.size === 0 || note.trim().length < 3} onClick={acknowledge}>
                  Acknowledge {picked.size || ""} selected
                </button>
                <button type="button" className={buttonClass} disabled={pending} onClick={() => setPicked(new Set(open.map((f) => f.key)))}>
                  Select all open
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {locked && (
        <div className="border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Payslip release</h2>
            {published ? (
              <StatusChip status="approved" label="Published to employees" />
            ) : (
              <button type="button" className={primaryClass} disabled={pending} onClick={publish}>
                Publish payslips to employees
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {published ? "Employees see their payslip in the portal unless it is held back below." : "Employees cannot see these payslips until you publish the run."}
          </p>
          {held.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {held.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{h.employeeName}</span>
                  <span className="text-ink-faint">{h.employeeCode}</span>
                  <span className="text-ink-muted">on hold{h.holdReason ? `: ${h.holdReason}` : ""}</span>
                  <button type="button" className={buttonClass} disabled={pending} onClick={() => release(h.id)}>Release</button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-64">
              <label className="mb-1 block text-xs text-ink-muted">Hold one payslip back</label>
              <SelectField
                options={slips.filter((s) => !held.some((h) => h.id === s.id)).map((s) => ({ value: s.id, label: `${s.employeeName} (${s.employeeCode})` }))}
                value={holdFor}
                onChange={setHoldFor}
                placeholder="Choose an employee"
              />
            </div>
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs text-ink-muted" htmlFor="hold-reason">Reason</label>
              <input id="hold-reason" className={inputClass} value={holdReason} maxLength={300} onChange={(e) => setHoldReason(e.target.value)} />
            </div>
            <button type="button" className={buttonClass} disabled={pending || !holdFor || holdReason.trim().length < 3} onClick={hold}>Hold</button>
          </div>
        </div>
      )}
    </section>
  );
}
