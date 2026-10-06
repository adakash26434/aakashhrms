"use client";

import { useMemo, useState } from "react";
import { Ban, Check, Plus, ShieldCheck, Undo2, X } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { ReasonWindow } from "@/components/attendance/attendance-windows";
import { decideLeaveRequestsAction } from "@/app/actions/leave.actions";
import { fmt } from "@/lib/engines/leave.engine";
import type { LeavePageData, LeaveRequestView } from "@/lib/types/leave";
import { cn } from "@/lib/utils";
import { daysText, weekday } from "./leave-windows";

type Decision = "approve" | "final_approve" | "reject" | "withdraw" | "cancel";
const STATUS: Record<LeaveRequestView["status"], string> = { Pending: "pending", Approved: "approved", Rejected: "rejected", Cancelled: "cancelled" };
const ACTION_LABEL: Record<string, string> = { submitted: "Requested", approved: "Approved", final_approved: "Final approved", rejected: "Rejected", withdrawn: "Withdrawn / cancelled" };
const DONE_WORD: Record<Decision, string> = { approve: "approved", final_approve: "approved", reject: "rejected", withdraw: "withdrawn", cancel: "cancelled" };

/**
 * Leave requests: "Waiting for me" lists what this person can decide (as the
 * employee's supervisor, a leave approver, or a company administrator's Final
 * approve); never their own leave. The detail pane shows the days counted,
 * the pay split, the balance and the approval timeline.
 */
export function LeaveRequests({ data, inBranch, onNew, onDone }: { data: LeavePageData; inBranch: (branchId: string) => boolean; onNew: () => void; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const waiting = useMemo(() => data.requests.filter((r) => r.status === "Pending" && (r.can.approve || r.can.finalApprove)), [data.requests]);
  const own = useMemo(() => data.requests.filter((r) => r.employee.id === data.myEmployeeId), [data.requests, data.myEmployeeId]);
  const [view, setView] = useState<"waiting" | "all" | "own">(waiting.length ? "waiting" : "all");
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ ids: string[]; decision: Decision } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const base = view === "waiting" ? waiting : view === "own" ? own : data.requests;
  const q = search.trim().toLowerCase();
  const rows = base.filter(
    (r) =>
      inBranch(r.employee.branchId) &&
      (!filters.type || r.leaveTypeId === filters.type) &&
      (!filters.status || r.status === filters.status) &&
      (!q || r.employee.fullName.toLowerCase().includes(q) || r.employee.employeeCode.toLowerCase().includes(q))
  );
  const active = data.requests.find((r) => r.id === activeId) ?? null;
  const activeType = active ? data.types.find((t) => t.id === active.leaveTypeId) : undefined;
  const bulk = [...selected].filter((id) => waiting.some((r) => r.id === id && r.can.approve));
  const pendingType = pending?.ids.length === 1 ? data.types.find((t) => t.id === data.requests.find((r) => r.id === pending.ids[0])?.leaveTypeId) : undefined;

  const decide = async (note?: string): Promise<string | null> => {
    if (!pending) return null;
    const result = await decideLeaveRequestsAction(pending.ids, pending.decision, note);
    if (!result.success) {
      setPending(null);
      setMessage(result.error);
      return result.error;
    }
    setPending(null);
    setSelected(new Set());
    const { done, failed } = result.data;
    setMessage(failed.length ? `${failed.length} not changed: ${failed.map((f) => f.error).join(" · ")}` : null);
    onDone(`${done} leave request${done === 1 ? "" : "s"} ${DONE_WORD[pending.decision]}.`);
    return null;
  };

  const balanceOf = (r: LeaveRequestView) => data.balances.find((b) => b.employee.id === r.employee.id)?.cells.find((c) => c.leaveTypeId === r.leaveTypeId) ?? null;

  const columns = useMemo<GridColumn<LeaveRequestView>[]>(
    () => [
      { id: "name", header: "Employee", width: 170, sticky: true, value: (r) => r.employee.fullName, cell: (r) => <span className="font-medium text-ink">{r.employee.fullName} <span className="font-code text-3xs text-ink-faint">{r.employee.employeeCode}</span></span> },
      { id: "type", header: "Leave type", width: 140, value: (r) => r.leaveTypeName },
      {
        id: "from",
        header: "Dates",
        width: 230,
        value: (r) => r.from,
        cell: (r) => (
          <span className="tabular-nums">
            {dateText(r.from)}
            {r.to !== r.from && <span className="text-ink-muted"> – {dateText(r.to)}</span>}
          </span>
        ),
      },
      {
        id: "days",
        header: "Days",
        type: "number",
        width: 120,
        value: (r) => r.days,
        cell: (r) => (
          <span className="tabular-nums">
            {fmt(r.days)}
            {r.half && <span className="text-2xs text-ink-muted"> ({r.half === "first" ? "1st" : "2nd"} half)</span>}
            {r.unpaidDays > 0 && <span className="text-2xs text-danger"> · {fmt(r.unpaidDays)} unpaid</span>}
          </span>
        ),
      },
      { id: "reason", header: "Reason", width: 190, value: (r) => r.reason, cell: (r) => <span className="block truncate" title={r.reason}>{r.reason}</span> },
      { id: "by", header: "Raised by", width: 150, value: (r) => r.preparedBy, defaultHidden: true },
      { id: "dept", header: "Department", width: 150, value: (r) => r.employee.departmentName, defaultHidden: true },
      { id: "status", header: "Status", width: 110, value: (r) => r.status, cell: (r) => <StatusChip status={STATUS[r.status]} label={r.status === "Pending" ? "Waiting" : undefined} /> },
    ],
    [dateText]
  );

  const views = [
    ["waiting", `Waiting for me (${waiting.length})`],
    ["all", "All"],
    ...(data.myEmployeeId ? ([["own", "My leave"]] as const) : []),
  ] as const;

  return (
    <div className="p-3">
      <Guide
        id="leave-requests"
        className="mb-3"
        title="How leave requests work"
        steps={[
          { title: "Ask", text: "Employees apply in self-service, or HR uses New request at the top." },
          { title: "Approve", text: "The supervisor or a leave approver decides it under Waiting for me. Nobody approves their own leave." },
          { title: "Taken", text: "Approved days come off the balance and show as leave in attendance and payroll." },
          { title: "Plans change", text: "Withdraw a waiting request, or cancel approved leave to give the days back (not in a closed month)." },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which requests" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {views.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("cursor-pointer rounded px-3 py-1 font-medium", view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}>
              {label}
            </button>
          ))}
        </div>
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
      <FilterStrip
        id="leave-requests"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[
          { id: "type", label: "Leave type", allLabel: "All leave types", options: data.types.map((t) => ({ value: t.id, label: t.name })) },
          {
            id: "status",
            label: "Status",
            allLabel: "Any status",
            options: [
              { value: "Pending", label: "Waiting" },
              { value: "Approved", label: "Approved" },
              { value: "Rejected", label: "Rejected" },
              { value: "Cancelled", label: "Cancelled" },
            ],
          },
        ]}
      />
      {message && (
        <Notice tone="danger" className="mb-3" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}
      <SplitView
        id="leave-requests"
        detailTitle={active ? `${active.employee.fullName} · ${active.leaveTypeName}` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">
                    {dateText(active.from)}
                    {active.to !== active.from && ` – ${dateText(active.to)}`} · {daysText(active.days)}
                    {active.half && ` (${active.half === "first" ? "first" : "second"} half)`}
                  </p>
                  <StatusChip status={STATUS[active.status]} label={active.status === "Pending" ? "Waiting" : undefined} />
                </div>
                {active.unpaidDays > 0 && (
                  <p className="mt-0.5 text-ink-muted">
                    {fmt(active.paidDays)} paid, <span className="text-danger">{fmt(active.unpaidDays)} unpaid</span>
                  </p>
                )}
                <p className="mt-1 text-ink">“{active.reason}”</p>
                {active.certificateNote && <p className="mt-1 text-2xs text-ink-muted">Certificate: {active.certificateNote}</p>}
                {active.ssfClaim && <p className="mt-1 text-2xs text-ink-muted">SSF claim: the SSF pays the unpaid days (Labour Act §47).</p>}
                {active.detail && (
                  <ul className="mt-2 flex flex-wrap gap-1" aria-label="Days counted">
                    {active.detail.map((d) => (
                      <li key={d.date} className={cn("rounded px-1.5 py-0.5 text-2xs", d.pay === "none" ? "bg-danger-subtle text-danger" : "bg-info-subtle text-info")}>
                        {weekday(d.date)} {dateText(d.date)}
                        {d.part < 1 ? " ½" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {(() => {
                  const b = balanceOf(active);
                  return b ? (
                    <p className="mt-2 text-2xs text-ink-muted">
                      Balance now {fmt(b.balance)}
                      {b.waiting ? ` · ${fmt(b.waiting)} in waiting requests` : ""}
                    </p>
                  ) : null;
                })()}
                <p className="mt-2 text-2xs text-ink-muted">
                  {activeType?.isRight
                    ? `${active.leaveTypeName} is a right (Labour Act §51): refuse it only when a condition is not met, e.g. no medical certificate.`
                    : `${active.leaveTypeName} is not a right (Labour Act §51): it may be refused or moved for a work reason, which is recorded.`}
                </p>
              </div>
              {(active.status === "Pending" || active.can.cancel) && (
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
                    {active.can.cancel && (
                      <WindowButton variant="danger" onClick={() => setPending({ ids: [active.id], decision: "cancel" })}>
                        <Ban className="h-3.5 w-3.5" /> Cancel leave
                      </WindowButton>
                    )}
                  </div>
                  {active.status === "Pending" && active.can.reason && !active.can.approve && <p className="text-2xs text-ink-muted">{active.can.reason}</p>}
                </div>
              )}
              <section aria-label="Approval timeline" className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Approval</h3>
                <ol className="space-y-1.5">
                  {active.timeline.length === 0 && (
                    <li>
                      <span className="font-medium text-ink">Requested</span> <span className="text-ink-muted">· {active.preparedBy} · {dateText(active.appliedDate)}</span>
                    </li>
                  )}
                  {active.timeline.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium text-ink">{ACTION_LABEL[t.action] ?? t.action}</span> <span className="text-ink-muted">· {t.actorName} · {dateText(t.at)}</span>
                      {t.note && <span className="block text-2xs text-ink-muted">“{t.note}”</span>}
                    </li>
                  ))}
                  {active.timeline.length === 0 && active.decidedBy && (
                    <li>
                      <span className="font-medium text-ink">{active.status}</span> <span className="text-ink-muted">· {active.decidedBy}{active.decidedAt ? ` · ${dateText(active.decidedAt)}` : ""}</span>
                      {active.decisionNote && <span className="block text-2xs text-ink-muted">“{active.decisionNote}”</span>}
                    </li>
                  )}
                  {active.status === "Pending" && <li className="text-ink-muted">Waiting for the supervisor or a leave approver</li>}
                </ol>
              </section>
            </div>
          ) : null
        }
        master={
          <DataGrid
            id="leave-requests"
            label="Leave requests"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            selectable={view === "waiting"}
            selected={selected}
            onSelectedChange={setSelected}
            activeRowId={activeId}
            onActiveRowChange={(r) => setActiveId(r.id)}
            onOpen={(r) => setActiveId(r.id)}
            defaultSort={{ columnId: "from", direction: "desc" }}
            pageSize={50}
            empty={
              view === "waiting"
                ? { title: "Nothing waiting for you", description: "Leave requests you can approve appear here." }
                : {
                    title: "No leave requests",
                    description: "Requests from the last three months and all waiting ones appear here, from HR or self-service.",
                    action: data.permissions.add ? (
                      <WindowButton onClick={onNew}>
                        <Plus className="h-3.5 w-3.5" /> New request
                      </WindowButton>
                    ) : undefined,
                  }
            }
          />
        }
      />
      <Confirm
        open={pending?.decision === "approve" || pending?.decision === "final_approve"}
        title={pending?.decision === "final_approve" ? "Final approve this leave?" : `Approve ${pending?.ids.length === 1 ? "this leave" : `${pending?.ids.length} leave requests`}?`}
        message="The balance and closed attendance months are checked again; the days come off the balance and show as leave in attendance."
        confirmLabel={pending?.decision === "final_approve" ? "Final approve" : "Approve"}
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.decision === "withdraw"}
        title="Withdraw this leave request?"
        message="It will not be decided or taken."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          await decide();
        }}
        onCancel={() => setPending(null)}
      />
      {pending?.decision === "reject" && (
        <ReasonWindow
          title={pending.ids.length === 1 ? "Reject this leave?" : `Reject ${pending.ids.length} leave requests?`}
          description={
            pendingType?.isRight
              ? "This leave is a right (Labour Act §51): say which condition is not met. The employee sees your reason."
              : "Give the work reason for refusing (Labour Act §51). The employee sees your reason."
          }
          action="Reject"
          danger
          onClose={() => setPending(null)}
          onConfirm={(reason) => decide(reason)}
        />
      )}
      {pending?.decision === "cancel" && (
        <ReasonWindow
          title="Cancel this approved leave?"
          description="The days go back to the balance and attendance counts them again. Not possible in a closed attendance month."
          action="Cancel leave"
          danger
          onClose={() => setPending(null)}
          onConfirm={(reason) => decide(reason)}
        />
      )}
    </div>
  );
}
