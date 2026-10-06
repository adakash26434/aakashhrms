"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Settings2, ShieldCheck, Undo2, X } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { inputClass } from "@/components/kit/property-form";
import { SplitView } from "@/components/kit/split-view";
import { PaneActions, PaneFigures, PaneSection, useShowAll } from "@/components/kit/pane";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { decideSalaryChangesAction } from "@/app/actions/salary-structure.actions";
import { availableActions, waitingFor, type ApprovalRequest } from "@/lib/engines/approval.engine";
import type { BatchRow, SalaryStructureData } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";
import { APPROVAL_ROUTE_LABEL, ApprovalTimeline, ApproverStanding, batchStatusText, describeChanges, money, salaryActor } from "./salary-structure-approval";

const KIND: Record<BatchRow["kind"], string> = { single: "One employee", bulk: "Bulk edit", import: "CSV import", hire: "Starting salary", policy: "Grade policy" };
const STATUS: Record<BatchRow["status"], string> = { pending: "pending", approved: "approved", rejected: "rejected", withdrawn: "cancelled" };

type Decision = "approve" | "final_approve" | "reject" | "withdraw";

const requestOf = (b: BatchRow): ApprovalRequest => ({ status: b.status, preparedById: b.preparedById, subjectEmployeeIds: b.employeeIds, flow: b.flow, currentLevel: b.currentLevel });

/**
 * Approvals tab (Zoho Payroll style): "Waiting for me" and all changes; each
 * change's approval timeline, what it changes and its effect on pay; Approve
 * the current level, Final approve (company administrators), Reject with a
 * reason, Withdraw your own; bulk approve / reject of selected rows. The
 * buttons come from the same approval engine the server applies.
 */
export function SalaryStructureApprovals({ data, onSettings }: { data: SalaryStructureData; onSettings: () => void }) {
  const router = useRouter();
  const dateText = useDateText();
  const actor = salaryActor(data);
  const ctx = useMemo(() => ({ approvers: data.approvers, today: data.today }), [data.approvers, data.today]);
  const mineIds = useMemo(() => new Set(data.batches.filter((b) => b.status === "pending" && waitingFor(requestOf(b), actor, ctx)).map((b) => b.id)), [data.batches, actor, ctx]);
  const [view, setView] = useState<"mine" | "all">(mineIds.size ? "mine" : "all");
  const [filters, setFilters] = useState<FilterValues>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ ids: string[]; decision: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string; list?: string[] } | null>(null);

  const visible = useMemo(
    () =>
      data.batches.filter((b) =>
        view === "mine" ? mineIds.has(b.id) : (!filters.status || b.status === filters.status) && (!filters.route || b.approvalRoute === filters.route)
      ),
    [data.batches, view, mineIds, filters]
  );
  const active = data.batches.find((b) => b.id === activeId) ?? null;
  const canBulk = [...selected].filter((id) => mineIds.has(id) || data.me.isAdministrator);

  const decide = async () => {
    if (!pending) return;
    setBusy(true);
    const result = await decideSalaryChangesAction(pending.ids, pending.decision, note);
    setBusy(false);
    setPending(null);
    setNote("");
    if (!result.success) {
      setMessage({ tone: "danger", text: result.error });
      return;
    }
    const { done, failed } = result.data;
    const verb = pending.decision === "reject" ? "rejected" : pending.decision === "withdraw" ? "withdrawn" : "approved";
    setMessage({
      tone: failed.length ? "danger" : "success",
      text: `${done} change${done === 1 ? "" : "s"} ${verb}.${failed.length ? ` ${failed.length} not changed:` : ""}`,
      list: failed.map((f) => `${data.batches.find((b) => b.id === f.id)?.reason ?? "Change"}: ${f.error}`),
    });
    setSelected(new Set());
    router.refresh();
  };

  const columns = useMemo<GridColumn<BatchRow>[]>(
    () => [
      { id: "created", header: "Made", type: "date", value: (b) => b.createdAt.slice(0, 10) },
      { id: "effective", header: "Effective from", type: "date", value: (b) => b.effectiveFrom },
      { id: "kind", header: "Kind", width: 120, value: (b) => KIND[b.kind] },
      { id: "reason", header: "Reason", width: 220, value: (b) => b.reason },
      { id: "employees", header: "Employees", type: "number", width: 96, value: (b) => b.employeeCount },
      {
        id: "change",
        header: "Monthly change",
        type: "amount",
        width: 130,
        value: (b) => b.monthlyChange,
        cell: (b) => <span className={cn("tabular-nums", b.monthlyChange > 0 ? "text-success" : b.monthlyChange < 0 ? "text-danger" : "")}>{b.monthlyChange > 0 ? "+" : ""}<Amount value={b.monthlyChange} /></span>,
      },
      { id: "by", header: "Prepared by", width: 150, value: (b) => b.preparedBy },
      {
        id: "status",
        header: "Status",
        width: 230,
        value: (b) => batchStatusText(b, data),
        cell: (b) =>
          b.status === "pending" ? (
            <span className="flex items-center gap-1.5">
              <StatusChip status="pending" label="Waiting" />
              <span className="truncate text-2xs text-ink-muted">{batchStatusText(b, data).replace(/^Waiting for /, "")}</span>
            </span>
          ) : (
            <StatusChip status={STATUS[b.status]} label={b.status === "withdrawn" ? "Withdrawn" : undefined} />
          ),
      },
      {
        id: "route",
        header: "Approved how",
        width: 200,
        value: (b) => (b.approvalRoute ? APPROVAL_ROUTE_LABEL[b.approvalRoute] : ""),
        cell: (b) => (b.approvalRoute ? <span className={cn("text-2xs", b.approvalRoute === "final_approve" ? "font-medium text-warning" : "text-ink-muted")}>{APPROVAL_ROUTE_LABEL[b.approvalRoute]}</span> : <span className="text-ink-faint">—</span>),
      },
    ],
    [data]
  );

  const can = active ? availableActions(requestOf(active), actor, ctx) : null;

  return (
    <div className="p-3 @container">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-surface-panel px-3 py-2.5">
        <ApproverStanding data={data} />
        {data.me.isAdministrator && (
          <WindowButton onClick={onSettings}>
            <Settings2 className="h-3.5 w-3.5" /> Approval settings
          </WindowButton>
        )}
      </div>

      {message && (
        <div role={message.tone === "danger" ? "alert" : "status"} className={cn("mb-3 rounded-md border px-3 py-2 text-xs", message.tone === "danger" ? "border-danger/30 bg-danger-subtle text-danger" : "border-success/30 bg-success-subtle text-ink")}>
          <p>{message.text}</p>
          {message.list && message.list.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-2xs">
              {message.list.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which changes" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {(
            [
              ["mine", `Waiting for me (${mineIds.size})`],
              ["all", "All changes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn("cursor-pointer rounded px-3 py-1 font-medium", view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}
            >
              {label}
            </button>
          ))}
        </div>
        {canBulk.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted">{canBulk.length} selected</span>
            <WindowButton variant="primary" onClick={() => setPending({ ids: canBulk, decision: "approve" })}>
              <Check className="h-3.5 w-3.5" /> Approve selected
            </WindowButton>
            <WindowButton variant="danger" onClick={() => setPending({ ids: canBulk, decision: "reject" })}>
              <X className="h-3.5 w-3.5" /> Reject selected
            </WindowButton>
          </span>
        )}
      </div>

      {view === "all" && (
        <FilterStrip
          id="salary-approvals"
          className="mb-3"
          values={filters}
          onChange={setFilters}
          filters={[
            {
              id: "status",
              label: "Status",
              allLabel: "All statuses",
              options: [
                { value: "pending", label: "Waiting for approval" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "withdrawn", label: "Withdrawn" },
              ],
            },
            {
              id: "route",
              label: "Approved how",
              allLabel: "Any approval",
              options: (Object.keys(APPROVAL_ROUTE_LABEL) as (keyof typeof APPROVAL_ROUTE_LABEL)[]).map((r) => ({ value: r, label: APPROVAL_ROUTE_LABEL[r] })),
            },
          ]}
        />
      )}

      <SplitView
        id="salary-approvals"
        detailTitle={active ? `${KIND[active.kind]} · from ${dateText(active.effectiveFrom)}` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active && can ? (
            <div className="text-xs">
              {active.status === "pending" && (
                <PaneActions hint={can.reason || undefined} hintTone={can.stuck ? "warning" : "muted"}>
                  {can.approve && (
                    <WindowButton variant="primary" onClick={() => setPending({ ids: [active.id], decision: "approve" })}>
                      <Check className="h-3.5 w-3.5" />
                      {can.approve.onBehalfOf ? `Approve for ${data.approvers.find((x) => x.userId === can.approve!.onBehalfOf)?.name ?? "approver"}` : can.approve.level ? `Approve Level ${can.approve.level}` : "Approve"}
                    </WindowButton>
                  )}
                  {can.finalApprove && (active.flow.type === "multi_level" || !can.approve) && (
                    <WindowButton variant={can.approve ? "default" : "primary"} onClick={() => setPending({ ids: [active.id], decision: "final_approve" })} title="Approve it now, skipping any remaining levels (recorded)">
                      <ShieldCheck className="h-3.5 w-3.5" /> Final approve
                    </WindowButton>
                  )}
                  {can.reject && (
                    <WindowButton variant="danger" onClick={() => setPending({ ids: [active.id], decision: "reject" })}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </WindowButton>
                  )}
                  {can.withdraw && (
                    <WindowButton onClick={() => setPending({ ids: [active.id], decision: "withdraw" })}>
                      <Undo2 className="h-3.5 w-3.5" /> Withdraw
                    </WindowButton>
                  )}
                </PaneActions>
              )}

              <PaneSection>
                <p className="font-medium text-ink">{active.reason}</p>
                <p className="mt-1 text-ink-muted">
                  {batchStatusText(active, data)}
                  {active.approvalRoute && ` · ${APPROVAL_ROUTE_LABEL[active.approvalRoute]}`}
                </p>
              </PaneSection>

              <PaneSection title="Effect a month">
                <BatchEffect batch={active} />
              </PaneSection>

              <PaneSection title="Employees" count={active.lines.length}>
                <BatchLines batch={active} data={data} />
              </PaneSection>

              <PaneSection title="Approval">
                <ApprovalTimeline batch={active} data={data} />
              </PaneSection>
            </div>
          ) : null
        }
        master={
          <DataGrid
            id="salary-approvals"
            label="Salary approvals"
            columns={columns}
            rows={visible}
            getRowId={(b) => b.id}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            activeRowId={activeId}
            onActiveRowChange={(b) => setActiveId(b.id)}
            onOpen={(b) => setActiveId(b.id)}
            rowTone={(b) => (mineIds.has(b.id) ? "warning" : undefined)}
            defaultSort={{ columnId: "created", direction: "desc" }}
            pageSize={50}
            empty={view === "mine" ? { title: "Nothing waiting for you", description: "Changes you can approve appear here." } : { title: "No salary changes yet", description: "Changes appear here when someone revises salaries." }}
          />
        }
      />

      <Confirm
        open={pending?.decision === "approve" || pending?.decision === "final_approve"}
        title={pending?.decision === "final_approve" ? "Final approve this change?" : `Approve ${pending?.ids.length === 1 ? "this change" : `${pending?.ids.length} changes`}?`}
        message={
          pending?.decision === "final_approve"
            ? "It counts now and any remaining levels are skipped. This is recorded as your Final approval."
            : "Each change moves to its next level, or counts once its last level approves. Changes you cannot approve are left as they are."
        }
        confirmLabel={pending?.decision === "final_approve" ? "Final approve" : "Approve"}
        requireText="APPROVE"
        onConfirm={decide}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.decision === "withdraw"}
        title="Withdraw this change?"
        message="It will not take effect. You can prepare it again later."
        confirmLabel="Withdraw"
        onConfirm={decide}
        onCancel={() => setPending(null)}
      />
      {pending?.decision === "reject" && (
        <Window
          open
          onClose={busy ? () => {} : () => setPending(null)}
          size="sm"
          title={pending.ids.length === 1 ? "Reject this change?" : `Reject ${pending.ids.length} changes?`}
          description="The person who prepared it sees your reason."
          footer={
            <>
              <WindowButton onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </WindowButton>
              <WindowButton variant="danger" onClick={decide} disabled={busy || note.trim().length < 3}>
                Reject
              </WindowButton>
            </>
          }
        >
          <label className="block text-xs font-medium text-ink-label">
            Reason
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={cn(inputClass, "mt-1 max-w-none")} placeholder="e.g. Increment is above budget" />
          </label>
        </Window>
      )}
    </div>
  );
}

/** What a batch does to monthly pay: gross, net before tax and employer cost (SSF / PF included). */
function BatchEffect({ batch }: { batch: BatchRow }) {
  const sum = (pick: (t: BatchRow["lines"][number]["after"]["totals"]) => number) => batch.lines.reduce((n, l) => n + pick(l.after.totals) - (l.before ? pick(l.before.totals) : 0), 0);
  const items = [
    { label: "Gross", value: sum((t) => t.gross) },
    { label: "Net before tax", value: sum((t) => t.netBeforeTax) },
    { label: "Employer cost", value: sum((t) => t.employerCost) },
  ];
  return (
    <PaneFigures
      items={items.map((i) => ({
        label: i.label,
        value: `${i.value > 0 ? "+" : ""}${money(i.value)}`,
        tone: i.value > 0 ? ("success" as const) : i.value < 0 ? ("danger" as const) : ("default" as const),
      }))}
    />
  );
}

/** Each employee in the change: gross before and after, and what changed (the first ten, then "Show all"). */
function BatchLines({ batch, data }: { batch: BatchRow; data: SalaryStructureData }) {
  const { shown, toggle } = useShowAll(batch.lines, 10);
  return (
    <>
      <table className="w-full tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-3xs uppercase tracking-wide text-ink-muted">
            <th className="py-1">Employee</th>
            <th className="py-1 text-right">Gross</th>
            <th className="py-1 text-right">New</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((l) => {
            const diff = l.after.totals.gross - (l.before?.totals.gross ?? 0);
            return (
              <tr key={l.employeeId} className="border-b border-line align-top last:border-0">
                <td className="py-1">
                  {l.fullName} <span className="font-code text-3xs text-ink-faint">{l.employeeCode}</span>
                  {l.employeeId === data.me.employeeId && <span className="ml-1 text-3xs font-semibold text-warning">you</span>}
                  {(l.before ? describeChanges(l.before.lines, l.after.lines, data.heads) : ["New structure"]).map((p) => (
                    <span key={p} className="block text-3xs text-ink-muted">
                      {p}
                    </span>
                  ))}
                </td>
                <td className="py-1 text-right text-ink-muted">{l.before ? <Amount value={l.before.totals.gross} /> : "—"}</td>
                <td className="py-1 text-right font-medium">
                  <Amount value={l.after.totals.gross} />
                  {diff !== 0 && (
                    <span className={cn("ml-1 text-3xs", diff > 0 ? "text-success" : "text-danger")}>
                      {diff > 0 ? "+" : ""}
                      {money(diff)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {toggle}
    </>
  );
}
