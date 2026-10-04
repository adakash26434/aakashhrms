"use client";

import { useMemo, useState } from "react";
import { Check, Plus, ShieldCheck, Undo2, X } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { decideAttendanceAdjustmentsAction } from "@/app/actions/attendance.actions";
import { localClock } from "@/lib/engines/attendance-day.engine";
import { ADJUSTMENT_KIND_LABEL, type AdjustmentView, type AttendancePageData } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";
import { ReasonWindow } from "./attendance-windows";

type Decision = "approve" | "final_approve" | "reject" | "withdraw";
const STATUS: Record<AdjustmentView["status"], string> = { pending: "pending", approved: "approved", rejected: "rejected", withdrawn: "cancelled" };
const ACTION_LABEL: Record<string, string> = { submitted: "Raised", approved: "Approved", final_approved: "Final approved", rejected: "Rejected", withdrawn: "Withdrawn" };

/**
 * Adjustments (regularization): missed / wrong check-ins, field work, mark
 * present. "Waiting for me" lists what this person can decide (as the
 * employee's supervisor, an attendance approver, or a company administrator's
 * Final approve); never their own attendance. Approving adds the punches.
 */
export function AttendanceAdjustments({ data, onNew, onDone }: { data: AttendancePageData; onNew: () => void; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const mine = useMemo(() => data.adjustments.filter((a) => a.status === "pending" && (a.can.approve || a.can.finalApprove)), [data.adjustments]);
  const [view, setView] = useState<"mine" | "all">(mine.length ? "mine" : "all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ ids: string[]; decision: Decision } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rows = view === "mine" ? mine : data.adjustments;
  const active = data.adjustments.find((a) => a.id === activeId) ?? null;
  const bulk = [...selected].filter((id) => mine.some((a) => a.id === id));

  const decide = async (note?: string): Promise<string | null> => {
    if (!pending) return null;
    const result = await decideAttendanceAdjustmentsAction(pending.ids, pending.decision, note);
    if (!result.success) {
      setPending(null);
      setMessage(result.error);
      return result.error;
    }
    setPending(null);
    setSelected(new Set());
    const { done, failed } = result.data;
    if (failed.length) setMessage(`${failed.length} not changed: ${failed.map((f) => f.error).join(" · ")}`);
    onDone(`${done} adjustment${done === 1 ? "" : "s"} ${pending.decision === "reject" ? "rejected" : pending.decision === "withdraw" ? "withdrawn" : "approved"}.`);
    return null;
  };

  const columns = useMemo<GridColumn<AdjustmentView>[]>(
    () => [
      { id: "date", header: "Day", type: "date", value: (a) => a.date },
      { id: "name", header: "Employee", width: 180, value: (a) => a.employeeName, cell: (a) => <span className="font-medium text-ink">{a.employeeName} <span className="font-code text-3xs text-ink-faint">{a.employeeCode}</span></span> },
      { id: "kind", header: "Correction", width: 170, value: (a) => ADJUSTMENT_KIND_LABEL[a.kind] },
      { id: "times", header: "Times asked", width: 120, value: (a) => `${localClock(a.requestedIn)}–${localClock(a.requestedOut)}`, cell: (a) => <span className="tabular-nums">{[localClock(a.requestedIn), localClock(a.requestedOut)].filter(Boolean).join(" – ") || "—"}</span> },
      { id: "reason", header: "Reason", width: 240, value: (a) => a.reason },
      { id: "by", header: "Raised by", width: 150, value: (a) => a.preparedBy },
      { id: "status", header: "Status", width: 110, value: (a) => a.status, cell: (a) => <StatusChip status={STATUS[a.status]} label={a.status === "pending" ? "Waiting" : a.status === "withdrawn" ? "Withdrawn" : undefined} /> },
    ],
    []
  );

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which adjustments" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {(
            [
              ["mine", `Waiting for me (${mine.length})`],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("cursor-pointer rounded px-3 py-1 font-medium", view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}>
              {label}
            </button>
          ))}
        </div>
        {data.permissions.add && (
          <WindowButton onClick={onNew}>
            <Plus className="h-3.5 w-3.5" /> New adjustment
          </WindowButton>
        )}
        {bulk.length > 0 && (
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-ink-muted">{bulk.length} selected</span>
            <WindowButton variant="primary" onClick={() => setPending({ ids: bulk, decision: "approve" })}>
              <Check className="h-3.5 w-3.5" /> Approve selected
            </WindowButton>
            <WindowButton variant="danger" onClick={() => setPending({ ids: bulk, decision: "reject" })}>
              <X className="h-3.5 w-3.5" /> Reject selected
            </WindowButton>
          </span>
        )}
      </div>
      <p className="mb-2 text-2xs text-ink-muted">Approved by the employee&apos;s supervisor or someone with Attendance → Approve; company administrators can Final approve. Nobody approves their own attendance.</p>
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      <SplitView
        id="attendance-adjustments"
        detailTitle={active ? `${active.employeeName} · ${dateText(active.date)}` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <p className="font-medium text-ink">{ADJUSTMENT_KIND_LABEL[active.kind]}</p>
                <p className="mt-0.5 text-ink-muted">
                  {[localClock(active.requestedIn) && `In ${localClock(active.requestedIn)}`, localClock(active.requestedOut) && `Out ${localClock(active.requestedOut)}`].filter(Boolean).join(" · ") || "No times"}
                </p>
                <p className="mt-1 text-ink">“{active.reason}”</p>
              </div>
              {active.status === "pending" && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    {active.can.approve && (
                      <WindowButton variant="primary" onClick={() => setPending({ ids: [active.id], decision: "approve" })}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </WindowButton>
                    )}
                    {active.can.finalApprove && (
                      <WindowButton variant="primary" onClick={() => setPending({ ids: [active.id], decision: "final_approve" })}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Final approve
                      </WindowButton>
                    )}
                    {active.can.reject && (
                      <WindowButton variant="danger" onClick={() => setPending({ ids: [active.id], decision: "reject" })}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </WindowButton>
                    )}
                    {active.can.withdraw && (
                      <WindowButton onClick={() => setPending({ ids: [active.id], decision: "withdraw" })}>
                        <Undo2 className="h-3.5 w-3.5" /> Withdraw
                      </WindowButton>
                    )}
                  </div>
                  {active.can.reason && !active.can.approve && <p className="text-2xs text-ink-muted">{active.can.reason}</p>}
                </div>
              )}
              <section aria-label="Approval timeline" className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Approval</h3>
                <ol className="space-y-1.5">
                  {active.timeline.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium text-ink">{ACTION_LABEL[t.action] ?? t.action}</span> <span className="text-ink-muted">· {t.actorName} · {dateText(t.at)}</span>
                      {t.note && <span className="block text-2xs text-ink-muted">“{t.note}”</span>}
                    </li>
                  ))}
                  {active.status === "pending" && <li className="text-ink-muted">Waiting for the supervisor or an attendance approver</li>}
                </ol>
              </section>
            </div>
          ) : null
        }
        master={
          <DataGrid
            id="attendance-adjustments"
            label="Attendance adjustments"
            columns={columns}
            rows={rows}
            getRowId={(a) => a.id}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            activeRowId={activeId}
            onActiveRowChange={(a) => setActiveId(a.id)}
            onOpen={(a) => setActiveId(a.id)}
            defaultSort={{ columnId: "date", direction: "desc" }}
            pageSize={50}
            empty={view === "mine" ? { title: "Nothing waiting for you", description: "Adjustments you can approve appear here." } : { title: "No adjustments", description: "Missed or wrong check-ins corrected here appear in this list." }}
          />
        }
      />
      <Confirm
        open={pending?.decision === "approve" || pending?.decision === "final_approve"}
        title={pending?.decision === "final_approve" ? "Final approve this adjustment?" : `Approve ${pending?.ids.length === 1 ? "this adjustment" : `${pending?.ids.length} adjustments`}?`}
        message="Its check-in / check-out (or the day setting) is added and the day is worked out again."
        confirmLabel={pending?.decision === "final_approve" ? "Final approve" : "Approve"}
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.decision === "withdraw"}
        title="Withdraw this adjustment?"
        message="It will not be applied."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      {pending?.decision === "reject" && (
        <ReasonWindow
          title={pending.ids.length === 1 ? "Reject this adjustment?" : `Reject ${pending.ids.length} adjustments?`}
          description="The person who raised it sees your reason."
          action="Reject"
          danger
          onClose={() => setPending(null)}
          onConfirm={(reason) => decide(reason)}
        />
      )}
    </div>
  );
}
