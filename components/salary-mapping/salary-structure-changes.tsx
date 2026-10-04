"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, X } from "lucide-react";
import { Amount } from "@/components/kit/amount";
import { Confirm } from "@/components/kit/confirm";
import { useDateText } from "@/components/kit/date-cell";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { inputClass } from "@/components/kit/property-form";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton } from "@/components/kit/window";
import { YesNoField } from "@/components/kit/yes-no-field";
import { decideSalaryChangeAction, setSalaryApprovalAction } from "@/app/actions/salary-structure.actions";
import { canDecideBatch, canWithdrawBatch } from "@/lib/engines/salary-structure.engine";
import type { BatchRow, SalaryStructureData } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

const KIND: Record<BatchRow["kind"], string> = { single: "One employee", bulk: "Bulk edit", import: "CSV import", hire: "Starting salary", policy: "Grade policy" };
const STATUS: Record<BatchRow["status"], string> = { pending: "pending", approved: "approved", rejected: "rejected", withdrawn: "cancelled" };

/** Changes tab: every change batch; approve or reject others' changes, withdraw your own. */
export function SalaryStructureChanges({ data }: { data: SalaryStructureData }) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterValues>({ status: data.batches.some((b) => b.status === "pending") ? "pending" : "" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ batch: BatchRow; decision: "approved" | "rejected" | "withdrawn" } | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = data.currentUserId;
  const dateText = useDateText();

  const visible = useMemo(() => data.batches.filter((b) => !filters.status || b.status === filters.status), [data.batches, filters]);
  const active = data.batches.find((b) => b.id === activeId) ?? null;

  const decide = async () => {
    if (!pending) return;
    setBusy(true);
    const result = await decideSalaryChangeAction(pending.batch.id, pending.decision, note);
    setBusy(false);
    if (!result.success) {
      setFailure(result.error);
      setPending(null);
      return;
    }
    setFailure(null);
    setPending(null);
    setNote("");
    router.refresh();
  };

  const toggleApproval = async (on: boolean) => {
    const result = await setSalaryApprovalAction(on);
    if (!result.success) setFailure(result.error);
    else router.refresh();
  };

  const columns = useMemo<GridColumn<BatchRow>[]>(
    () => [
      { id: "created", header: "Made", type: "date", value: (b) => b.createdAt.slice(0, 10) },
      { id: "effective", header: "Effective from", type: "date", value: (b) => b.effectiveFrom },
      { id: "kind", header: "Kind", width: 120, value: (b) => KIND[b.kind] },
      { id: "reason", header: "Reason", width: 240, value: (b) => b.reason },
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
      { id: "status", header: "Status", width: 110, value: (b) => b.status, cell: (b) => <StatusChip status={STATUS[b.status]} label={b.status === "withdrawn" ? "Withdrawn" : undefined} /> },
    ],
    []
  );

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface-panel px-3 py-2 text-xs">
        <span className="font-medium text-ink">Salary changes need a second person&apos;s approval</span>
        <YesNoField name="approval" value={data.approvalRequired} onChange={toggleApproval} disabled={!data.permissions.approve} />
        <span className="text-2xs text-ink-muted">
          {data.approvalRequired
            ? "On: a change counts only after someone else with Approve accepts it."
            : "Off: changes count as soon as they are saved (still recorded in the history)."}
          {!data.permissions.approve && " Only users who can approve salary changes can switch this."}
        </span>
      </div>

      {failure && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {failure}
        </p>
      )}

      <FilterStrip
        id="salary-changes"
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
        ]}
      />
      <SplitView
        id="salary-changes"
        detailTitle={active ? `${KIND[active.kind]} · from ${dateText(active.effectiveFrom)}` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
                <p className="font-medium text-ink">{active.reason}</p>
                <p className="mt-1 text-ink-muted">
                  Prepared by {active.preparedBy} on {dateText(active.createdAt)}
                  {active.decidedBy && active.status !== "pending" && ` · ${active.status} by ${active.decidedBy}${active.decidedAt ? ` on ${dateText(active.decidedAt)}` : ""}`}
                </p>
                {active.decisionNote && <p className="mt-1 text-ink">“{active.decisionNote}”</p>}
              </div>
              <table className="w-full tabular-nums">
                <thead>
                  <tr className="border-b border-line text-left text-3xs uppercase tracking-wide text-ink-muted">
                    <th className="py-1">Employee</th>
                    <th className="py-1 text-right">Gross</th>
                    <th className="py-1 text-right">New</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.map((l) => {
                    const diff = l.after.totals.gross - (l.before?.totals.gross ?? 0);
                    return (
                      <tr key={l.employeeId} className="border-b border-line">
                        <td className="py-1">
                          {l.fullName} <span className="font-code text-3xs text-ink-faint">{l.employeeCode}</span>
                        </td>
                        <td className="py-1 text-right text-ink-muted">{l.before ? <Amount value={l.before.totals.gross} /> : "—"}</td>
                        <td className="py-1 text-right font-medium">
                          <Amount value={l.after.totals.gross} />
                          {diff !== 0 && <span className={cn("ml-1 text-3xs", diff > 0 ? "text-success" : "text-danger")}>{diff > 0 ? "+" : ""}{diff.toLocaleString("en-IN")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {active.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  {canDecideBatch(active, me, data.permissions.approve) && (
                    <>
                      <WindowButton variant="primary" onClick={() => setPending({ batch: active, decision: "approved" })}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </WindowButton>
                      <WindowButton variant="danger" onClick={() => setPending({ batch: active, decision: "rejected" })}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </WindowButton>
                    </>
                  )}
                  {canWithdrawBatch(active, me) && (
                    <WindowButton onClick={() => setPending({ batch: active, decision: "withdrawn" })}>
                      <Undo2 className="h-3.5 w-3.5" /> Withdraw
                    </WindowButton>
                  )}
                  {active.preparedById === me && <p className="w-full text-2xs text-ink-muted">You prepared this change, so someone else has to approve it.</p>}
                </div>
              )}
            </div>
          ) : null
        }
        master={
          <DataGrid
            id="salary-changes"
            label="Salary changes"
            columns={columns}
            rows={visible}
            getRowId={(b) => b.id}
            activeRowId={activeId}
            onActiveRowChange={(b) => setActiveId(b.id)}
            onOpen={(b) => setActiveId(b.id)}
            rowTone={(b) => (b.status === "pending" ? "warning" : undefined)}
            defaultSort={{ columnId: "created", direction: "desc" }}
            pageSize={50}
            empty={{ title: filters.status ? "Nothing here" : "No salary changes yet", description: "Changes appear here when someone revises salaries." }}
          />
        }
      />

      <Confirm
        open={pending?.decision === "approved"}
        title={`Approve ${pending?.batch.employeeCount} salary change${pending?.batch.employeeCount === 1 ? "" : "s"}?`}
        message={`They take effect from ${dateText(pending?.batch.effectiveFrom)}. Monthly gross changes by ${pending?.batch.monthlyChange.toLocaleString("en-IN")}.`}
        confirmLabel="Approve"
        requireText="APPROVE"
        onConfirm={decide}
        onCancel={() => setPending(null)}
      />
      <Confirm
        open={pending?.decision === "withdrawn"}
        title="Withdraw this change?"
        message="It will not take effect. You can prepare it again later."
        confirmLabel="Withdraw"
        onConfirm={decide}
        onCancel={() => setPending(null)}
      />
      {pending?.decision === "rejected" && (
        <Window
          open
          onClose={busy ? () => {} : () => setPending(null)}
          size="sm"
          title="Reject this change?"
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
