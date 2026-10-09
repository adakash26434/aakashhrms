"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, Info, Loader2, Lock, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { PaneTimeline, approvalSteps } from "@/components/kit/pane";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { acknowledgeVarianceAction, checkRunAction, decideRunAction, discardRunAction, lockRunAction, refreshVarianceAction, submitRunAction, syncRunAttendanceAction } from "@/app/actions/payroll-run.actions";
import { generateBankExportCSVAction } from "@/app/actions/payroll.actions";
import { downloadTextFile } from "@/lib/export/download";
import { stepOf } from "@/lib/engines/payroll-run.engine";
import type { PayrollSlip } from "@/lib/types/payroll";
import { RUN_STEPS, RUN_STEP_LABEL, type PayrollRunsPageData, type PreflightProblem, type PreflightResult, type RunDetail, type RunStep, type VarianceItem } from "@/lib/types/payroll-run";
import type { ApprovalActionKind } from "@/lib/types/approval";
import { cn } from "@/lib/utils";
import { PayslipPane } from "./payslip-pane";
import { NoteWindow } from "./payroll-run-windows";

const ACTION_LABEL: Partial<Record<ApprovalActionKind, string>> = { submitted: "Submitted", approved: "Approved", final_approved: "Final approved", rejected: "Rejected" };
const SEVERITY: Record<PreflightProblem["severity"], { icon: typeof Info; className: string; label: string }> = {
  blocking: { icon: X, className: "text-danger", label: "Stops the run" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Look first" },
  info: { icon: Info, className: "text-ink-muted", label: "For information" },
};

/** The pre-flight findings, blocking first, each with where to fix it. */
export function ProblemList({ result, compact }: { result: PreflightResult; compact?: boolean }) {
  return (
    <ul className={cn("divide-y divide-line rounded-md border border-line bg-surface text-xs", compact && "max-h-56 overflow-y-auto")}>
      {result.problems.map((p, i) => {
        const s = SEVERITY[p.severity];
        const Icon = s.icon;
        return (
          <li key={`${p.code}-${p.employeeId ?? i}`} className="flex items-start gap-2 px-3 py-1.5">
            <Icon aria-label={s.label} className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", s.className)} />
            <span className="flex-1 text-ink">{p.text}</span>
            {p.href && (
              <Link href={p.href} className="shrink-0 font-medium text-brand-strong hover:underline">
                Open
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The selected run as steps (template C). The rail shows where the run
 * stands; each step is a panel. Only the steps that apply to the run's state
 * take actions; the server checks every one again.
 */
export function PayrollRunWorkspace({ data, detail, onDone, onOpenSettings }: { data: PayrollRunsPageData; detail: RunDetail; onDone: (text: string | null) => void; onOpenSettings?: () => void }) {
  const { run, slips } = detail;
  const current = stepOf(run, run.varianceOpen);
  const [step, setStep] = useState<RunStep>(current === "lock" && run.status === "LOCKED" ? "review" : current);
  const [message, setMessage] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "submit" | "reject" | "lock" | "discard" | "approve" | "final_approve">(null);
  const [ack, setAck] = useState<VarianceItem | null>(null);
  const [activeSlipId, setActiveSlipId] = useState<string | null>(null);
  const dateText = useDateText();
  const done = (index: number) => RUN_STEPS.indexOf(current) > index || run.status === "LOCKED";

  const act = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>, text: string | null) => {
    setBusy(id);
    setMessage(null);
    const r = await fn();
    setBusy(null);
    if (!r.success) {
      setMessage(r.error ?? "Not done.");
      return false;
    }
    onDone(text);
    return true;
  };

  const check = async () => {
    setBusy("check");
    const r = await checkRunAction(run.id);
    setBusy(null);
    if (!r.success) setMessage(r.error);
    else setPreflight(r.data ?? null);
  };

  const exportBank = async () => {
    setBusy("export");
    const r = await generateBankExportCSVAction(run.id);
    setBusy(null);
    if (!r.success || !r.data) {
      setMessage(r.error ?? "Export failed.");
      return;
    }
    downloadTextFile(`bank-transfer-${run.label.replace(/\s+/g, "-").toLowerCase()}.csv`, r.data, "text/csv");
  };

  const slipColumns = useMemo<GridColumn<PayrollSlip>[]>(
    () => [
      { id: "name", header: "Employee", width: 200, value: (s) => s.employeeName, cell: (s) => <span className="font-medium text-ink">{s.employeeName} <span className="font-code text-3xs text-ink-faint">{s.employeeCode}</span></span> },
      { id: "department", header: "Department", width: 150, value: (s) => s.departmentName, defaultHidden: true },
      { id: "basic", header: "Basic + grade", type: "amount", width: 130, value: (s) => Number(s.basicSalary) + Number(s.gradeAmount) },
      { id: "ot", header: "Overtime", type: "amount", width: 110, value: (s) => Number(s.otAmount), defaultHidden: true },
      { id: "gross", header: "Gross", type: "amount", width: 130, value: (s) => Number(s.grossEarnings), total: "sum" },
      { id: "tds", header: "Income tax", type: "amount", width: 120, value: (s) => Number(s.tdsThisMonth), total: "sum" },
      { id: "ssf", header: "SSF / PF", type: "amount", width: 120, value: (s) => Number(s.ssfEmployee) + Number(s.pfEmployee), total: "sum" },
      { id: "deductions", header: "Deductions", type: "amount", width: 130, value: (s) => Number(s.totalDeductions), total: "sum" },
      { id: "net", header: "Net payable", type: "amount", width: 140, value: (s) => Number(s.netPayable), cell: (s) => <Amount value={s.netPayable} emphasis />, total: "sum" },
      { id: "bank", header: "Bank account", type: "code", width: 150, value: (s) => s.bankAccountNumber, defaultHidden: true },
    ],
    []
  );
  const flagged = useMemo(() => new Set((run.variance?.items ?? []).filter((i) => !i.acknowledgedAt).map((i) => i.employeeId)), [run.variance]);
  const activeSlip = slips.find((s) => s.id === activeSlipId) ?? null;

  return (
    <div className="p-3">
      {/* Step rail */}
      <ol className="mb-3 flex flex-wrap items-center gap-1 text-xs" aria-label="Run steps">
        {RUN_STEPS.filter((s) => s !== "setup" && s !== "calculate").map((s) => {
          const idx = RUN_STEPS.indexOf(s);
          const isDone = done(idx) && s !== current;
          const isCurrent = s === current && run.status !== "LOCKED";
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(s)}
                aria-current={step === s ? "step" : undefined}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium",
                  step === s ? "border-brand bg-brand-subtle text-ink" : "border-line text-ink-muted hover:bg-surface-sunken",
                  isCurrent && step !== s && "border-warning/40"
                )}
              >
                {isDone || run.status === "LOCKED" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-full border text-3xs", isCurrent ? "border-warning text-warning" : "border-line-strong text-ink-faint")}>{idx}</span>}
                {RUN_STEP_LABEL[s]}
                {s === "variance" && run.varianceOpen > 0 && <span className="rounded-full bg-warning-subtle px-1.5 text-3xs font-semibold text-warning">{run.varianceOpen}</span>}
              </button>
            </li>
          );
        })}
        <li className="ml-auto flex items-center gap-2 text-2xs text-ink-muted">
          <StatusChip status={run.status === "UNDER_REVIEW" ? "review" : run.status.toLowerCase()} label={run.statusText} />
          <span>
            {run.employeeCount} employees · net <Amount value={run.totalNetPayable} emphasis />
          </span>
          <span>· {run.scopeText}</span>
        </li>
      </ol>

      {message && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      {run.openMonths.length > 0 && run.status !== "LOCKED" && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          Attendance for {run.label} was reopened for {run.openMonths.join(", ")}. Close it again (Attendance → Month close) and sync attendance before the run moves on.
        </p>
      )}

      {step === "preflight" && (
        <section className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <WindowButton onClick={check} disabled={!!busy}>
              {busy === "check" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check again
            </WindowButton>
            {run.can.edit && (
              <WindowButton onClick={() => act("sync", () => syncRunAttendanceAction(run.id), "Attendance read again for every payslip.")} disabled={!!busy}>
                {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync attendance
              </WindowButton>
            )}
            <span className="text-ink-muted">Closed attendance months, no leave or overtime waiting, every salary structure complete, the fiscal year&apos;s tax slabs.</span>
          </div>
          {preflight ? preflight.problems.length ? <ProblemList result={preflight} /> : <p className="font-medium text-success">Nothing stops this run.</p> : <p className="text-ink-muted">Pre-flight passed when the run was generated. Check again after changes elsewhere.</p>}
        </section>
      )}

      {step === "variance" && (
        <section className="text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-ink-muted">
              {run.variance?.baseLabel ? `Against ${run.variance.baseLabel} (locked), ±${run.variance.thresholdPct}%.` : "First run: nothing to compare with, only new, missing or odd pay is flagged."}
              {run.variance ? ` Worked out ${dateText(run.variance.computedAt)}.` : ""}
            </span>
            {run.can.edit && (
              <WindowButton onClick={() => act("variance", () => refreshVarianceAction(run.id), "Variance worked out again.")} disabled={!!busy}>
                {busy === "variance" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Work out again
              </WindowButton>
            )}
          </div>
          {!run.variance?.items.length ? (
            <p className="font-medium text-success">No employee needs a look: every figure is within the threshold.</p>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {run.variance.items.map((item) => (
                <li key={item.employeeId} className={cn("flex flex-wrap items-start gap-3 px-3 py-2", !item.acknowledgedAt && "border-l-2 border-l-warning")}>
                  <div className="min-w-48">
                    <p className="font-medium text-ink">
                      {item.employeeName} <span className="font-code text-3xs text-ink-faint">{item.employeeCode}</span>
                    </p>
                    <button type="button" className="cursor-pointer text-2xs text-brand-strong hover:underline" onClick={() => { setStep("review"); setActiveSlipId(item.slipId); }}>
                      Open payslip
                    </button>
                  </div>
                  <ul className="flex-1 space-y-0.5">
                    {item.flags.map((f) => (
                      <li key={f.code} className={cn(f.code === "negative_net" || f.code === "leaver_paid" || f.code === "bank_changed" ? "text-danger" : "text-ink")}>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                  <div className="w-60 text-2xs">
                    {item.acknowledgedAt ? (
                      <p className="text-success">
                        <Check className="mr-1 inline h-3 w-3" />
                        {item.acknowledgedByName ?? "Acknowledged"} · {dateText(item.acknowledgedAt)}
                        <span className="block text-ink-muted">“{item.note}”</span>
                      </p>
                    ) : run.can.edit && item.employeeId !== data.myEmployeeId ? (
                      <WindowButton onClick={() => setAck(item)}>
                        <Check className="h-3.5 w-3.5" /> Acknowledge
                      </WindowButton>
                    ) : (
                      <span className="text-warning">{item.employeeId === data.myEmployeeId ? "Your own payslip: someone else acknowledges it." : "Waiting for acknowledgement"}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === "review" && (
        <SplitView
          id="payroll-review"
          detailTitle={activeSlip ? `${activeSlip.employeeName} · ${run.label}` : undefined}
          onCloseDetail={() => setActiveSlipId(null)}
          detail={activeSlip ? <PayslipPane key={activeSlip.id} slip={activeSlip} run={run} data={data} onChanged={() => onDone(null)} /> : null}
          master={
            <DataGrid
              id="payroll-slips"
              label={`Payslips, ${run.label}`}
              columns={slipColumns}
              rows={slips}
              getRowId={(s) => s.id}
              activeRowId={activeSlipId}
              onActiveRowChange={(s) => setActiveSlipId(s.id)}
              onOpen={(s) => setActiveSlipId(s.id)}
              rowTone={(s) => (flagged.has(s.employeeId) ? "warning" : Number(s.netPayable) < 0 ? "danger" : undefined)}
              defaultSort={{ columnId: "name", direction: "asc" }}
              pageSize={50}
              exportModule={run.can.export ? "PAYROLL_GENERATE" : undefined}
              exportName={`payslips-${run.label}`}
              empty={{ title: "No payslips", description: "Every employee was removed from this run." }}
            />
          }
        />
      )}

      {step === "approval" && (
        <section className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {run.can.submit && (
              <WindowButton variant="primary" onClick={() => setPending("submit")} disabled={!!busy}>
                <ShieldCheck className="h-3.5 w-3.5" /> Submit for approval
              </WindowButton>
            )}
            {run.can.approve && (
              <WindowButton variant="primary" onClick={() => setPending("approve")} disabled={!!busy}>
                <Check className="h-3.5 w-3.5" /> Approve
              </WindowButton>
            )}
            {run.can.finalApprove && (
              <WindowButton variant="primary" onClick={() => setPending("final_approve")} disabled={!!busy}>
                <ShieldCheck className="h-3.5 w-3.5" /> Final approve
              </WindowButton>
            )}
            {run.can.reject && (
              <WindowButton variant="danger" onClick={() => setPending("reject")} disabled={!!busy}>
                <X className="h-3.5 w-3.5" /> Reject
              </WindowButton>
            )}
            {run.status === "DRAFT" && !run.can.submit && run.can.edit && <span className="text-warning">{run.varianceOpen ? `${run.varianceOpen} variance flag${run.varianceOpen === 1 ? "" : "s"} to acknowledge first.` : run.openMonths.length ? "Close the attendance month first." : ""}</span>}
            {run.status === "UNDER_REVIEW" && run.can.reason && !run.can.approve && <span className="text-ink-muted">{run.can.reason}</span>}
            {run.can.stuck && <span className="text-warning">{run.can.stuck}</span>}
            {onOpenSettings && (
              <button type="button" className="ml-auto cursor-pointer text-2xs text-brand-strong hover:underline" onClick={onOpenSettings}>
                Approval settings
              </button>
            )}
          </div>
          <p className="text-ink-muted">
            {data.policy.type === "multi_level" ? `Multi-level: ${data.policy.levels.length} approver${data.policy.levels.length === 1 ? "" : "s"} in order.` : "Simple: any pay-run approver."} The person who prepared the run never approves it; administrators can Final approve another person&apos;s run.
          </p>
          <PaneTimeline steps={approvalSteps(run.timeline.length ? run.timeline : [{ id: "prepared", level: 0, action: "submitted", actorId: run.generatedBy, actorName: run.preparedByName, onBehalfOfName: null, note: null, at: run.generatedAt }], { label: run.timeline.length ? ACTION_LABEL : { submitted: "Prepared" }, dateText, waiting: run.status === "UNDER_REVIEW" ? run.statusText.replace(/^Waiting for /, "") : run.status === "DRAFT" ? "submission" : null })} />
        </section>
      )}

      {step === "lock" && (
        <section className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {run.can.lock && (
              <WindowButton variant="primary" onClick={() => setPending("lock")} disabled={!!busy}>
                <Lock className="h-3.5 w-3.5" /> Lock run
              </WindowButton>
            )}
            {run.can.export && (
              <WindowButton onClick={exportBank} disabled={!!busy}>
                {busy === "export" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Bank transfer file
              </WindowButton>
            )}
            {run.status === "LOCKED" ? <span className="text-ink-muted">Locked {run.lockedAt ? dateText(run.lockedAt) : ""}. Payslips, attendance and loan instalments for {run.label} are sealed.</span> : run.status !== "APPROVED" ? <span className="text-ink-muted">Locking comes after approval.</span> : null}
          </div>
          <p className="text-ink-muted">Locking seals every payslip, locks the month&apos;s attendance and posts the loan instalments. Afterwards nothing in this month changes; corrections become arrears in a later run.</p>
        </section>
      )}

      {run.can.discard && step !== "review" && (
        <div className="mt-4 border-t border-line pt-3">
          <WindowButton variant="danger" onClick={() => setPending("discard")} disabled={!!busy}>
            <Trash2 className="h-3.5 w-3.5" /> Discard run
          </WindowButton>
        </div>
      )}

      {pending === "submit" && (
        <NoteWindow title={`Submit ${run.label} for approval?`} description="Approvers see the payslips, the variance review and your note. Payslips change only after a rejection." action="Submit" label="Note to the approvers" optional onClose={() => setPending(null)} onConfirm={async (note) => ((await act("submit", () => submitRunAction(run.id, note), `${run.label} submitted for approval.`)) ? (setPending(null), null) : "Not submitted.")} />
      )}
      {pending === "reject" && (
        <NoteWindow title={`Reject ${run.label}?`} description="The run goes back to draft; the preparer sees your reason, fixes the payslips and submits again." action="Reject" danger onClose={() => setPending(null)} onConfirm={async (note) => ((await act("reject", () => decideRunAction(run.id, "reject", note), `${run.label} rejected back to draft.`)) ? (setPending(null), null) : "Not rejected.")} />
      )}
      <Confirm
        open={pending === "approve" || pending === "final_approve"}
        title={pending === "final_approve" ? `Final approve ${run.label}?` : `Approve ${run.label}?`}
        message={`${run.employeeCount} payslips, net payable ${Number(run.totalNetPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}. ${data.policy.type === "multi_level" && pending === "approve" ? "The next level is asked after you." : "The run can then be locked and paid."}`}
        confirmLabel={pending === "final_approve" ? "Final approve" : "Approve"}
        onConfirm={async () => {
          await act(pending!, () => decideRunAction(run.id, pending === "final_approve" ? "final_approve" : "approve"), `${run.label} approved.`);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending === "lock"}
        title={`Lock ${run.label}?`}
        message="Payslips, the month's attendance and the loan instalments are sealed. This cannot be undone; later corrections are paid as arrears."
        confirmLabel="Lock run"
        requireText="LOCK"
        onConfirm={async () => {
          await act("lock", () => lockRunAction(run.id), `${run.label} locked. The bank transfer file is ready.`);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending === "discard"}
        title={`Discard ${run.label}?`}
        message="Every payslip of this run is deleted. The month can be generated again."
        confirmLabel="Discard"
        tone="danger"
        requireText="DISCARD"
        onConfirm={async () => {
          await act("discard", () => discardRunAction(run.id), `${run.label} discarded.`);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      {ack && (
        <NoteWindow
          title={`Acknowledge ${ack.employeeName}'s changes?`}
          description={ack.flags.map((f) => f.text).join(" · ")}
          action="Acknowledge"
          label="Why this is right"
          onClose={() => setAck(null)}
          onConfirm={async (note) => {
            const r = await acknowledgeVarianceAction(run.id, ack.employeeId, note);
            if (!r.success) return r.validationErrors?.note ?? r.error;
            setAck(null);
            onDone(r.data?.open ? `Acknowledged. ${r.data.open} left.` : "Every variance flag is acknowledged: the run can be submitted.");
            return null;
          }}
        />
      )}
    </div>
  );
}
