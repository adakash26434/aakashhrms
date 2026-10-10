"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { DateCell } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Notice } from "@/components/kit/notice";
import { inputClass } from "@/components/kit/property-form";
import { Window, WindowButton } from "@/components/kit/window";
import { decideEmployeeDetailChangeAction } from "@/app/actions/employee-detail.actions";
import { inSentence } from "@/lib/engines/employee-detail.engine";
import type { DetailChangesPage, DetailChangeView, DetailDecisionResult } from "@/lib/types/employee-detail";
import type { ApprovalTimelineEntry } from "@/lib/types/approval";
import { cn } from "@/lib/utils";
import { DetailLinesTable, DetailStatusChip } from "./employee-detail-bits";

// Detail changes (4.8 / F13): changes to bank accounts, PAN and tax status for employees in the
// viewer's scope — waiting ones first — and the window to approve, reject or withdraw one. The
// server decides who may act (never the employee's own record, never one's own change).

const STEP_LABEL: Record<ApprovalTimelineEntry["action"], string> = {
  submitted: "Made the change",
  approved: "Approved",
  final_approved: "Approved as company administrator",
  rejected: "Rejected",
  withdrawn: "Withdrew it",
  skipped: "Skipped",
  not_required: "Applied (approvals off)",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Waiting for approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function DetailChangesClient({ data, initialId }: { data: DetailChangesPage; initialId: string | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const waiting = data.rows.filter((r) => r.status === "pending").length;
  // Waiting changes first: the list opens on them when there are any.
  const [filters, setFilters] = useState<FilterValues>(() => {
    const start: FilterValues = {};
    if (waiting) start.status = "pending";
    return start;
  });
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialId && data.rows.some((r) => r.id === initialId) ? initialId : null);
  const [done, setDone] = useState<DetailDecisionResult | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => (!filters.status || r.status === filters.status) && (!q || r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)));
  }, [data.rows, filters, search]);
  const open = data.rows.find((r) => r.id === openId) ?? null;
  const active = rows.find((r) => r.id === activeId) ?? null;
  const mine = data.rows.filter((r) => r.waitingForMe).length;

  const columns: GridColumn<DetailChangeView>[] = [
    {
      id: "employee",
      header: "Employee",
      sticky: true,
      value: (r) => r.employeeName,
      cell: (r) => (
        <span>
          {r.employeeName} <span className="text-ink-faint">· {r.employeeCode}</span>
        </span>
      ),
    },
    { id: "change", header: "Change", value: (r) => r.summary, width: 200 },
    { id: "status", header: "Status", value: (r) => r.status, width: 190, cell: (r) => <DetailStatusChip status={r.status} route={r.route} /> },
    { id: "by", header: "Made by", value: (r) => r.preparedBy, width: 150 },
    { id: "on", header: "Made on", value: (r) => r.preparedAt, type: "date", width: 115, cell: (r) => <DateCell value={r.preparedAt} /> },
    { id: "decidedBy", header: "Decided by", value: (r) => r.decidedBy ?? "", width: 150, defaultHidden: true },
    { id: "decidedOn", header: "Decided on", value: (r) => r.decidedAt ?? "", type: "date", width: 115, defaultHidden: true, cell: (r) => <DateCell value={r.decidedAt} /> },
    { id: "reason", header: "Reason", value: (r) => r.reason, width: 260, defaultHidden: true },
  ];

  return (
    <div>
      <PageBar
        title="Detail changes"
        description="Bank account, PAN and tax status changes. A second person approves them before payroll uses them."
        actions={[
          { id: "open", label: "Open", icon: ExternalLink, group: "selection", primary: true, disabled: !active, disabledReason: "Select a change first", onClick: () => active && setOpenId(active.id) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      {done && (
        <Notice tone={done.runsInReview.length ? "warning" : "success"} className="mb-3" onDismiss={() => setDone(null)}>
          {decisionText(done)}
        </Notice>
      )}
      {data.approval === "off" && (
        <Notice tone="info" className="mb-3">
          Approvals for employee details are off (Payroll controls): changes apply when they are saved and are listed here. A change to someone&apos;s own record still waits for another person.
        </Notice>
      )}
      {mine > 0 && !done && (
        <Notice tone="info" className="mb-3">
          {mine} change{mine === 1 ? " is" : "s are"} waiting for your approval.
        </Notice>
      )}

      <FilterStrip
        id="employee-detail-changes"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Employee name or code" }}
        filters={[{ id: "status", label: "Status", allLabel: "All statuses", options: STATUS_OPTIONS }]}
      />

      <DataGrid
        id="employee-detail-changes"
        label="Detail changes"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        activeRowId={activeId}
        onActiveRowChange={(r) => setActiveId(r.id)}
        onOpen={(r) => setOpenId(r.id)}
        rowTone={(r) => (r.waitingForMe ? "info" : r.status === "rejected" ? "danger" : undefined)}
        defaultSort={{ columnId: "on", direction: "desc" }}
        empty={
          filters.status === "pending"
            ? { title: "Nothing waiting", description: "No change to bank, PAN or tax status is waiting for approval." }
            : { title: "No changes yet", description: "Changes to bank accounts, PAN and tax status made on employee records appear here." }
        }
      />

      {open && (
        <DetailDecisionWindow
          key={open.id}
          change={open}
          onClose={() => setOpenId(null)}
          onDone={(result) => {
            setOpenId(null);
            setDone(result);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** What a decision did, in words (and what still pays the old account). */
export function decisionText(r: DetailDecisionResult): string {
  const what = inSentence(r.summary);
  if (r.status === "rejected") return `The ${what} change for ${r.employeeName} was rejected. The record keeps its current details.`;
  if (r.status === "withdrawn") return `The ${what} change for ${r.employeeName} was withdrawn.`;
  const slips = r.draftSlips ? ` ${r.draftSlips} draft payslip${r.draftSlips === 1 ? "" : "s"} now use the new bank account.` : "";
  const runs = r.runsInReview.length ? ` ${r.runsInReview.join(", ")} still pay${r.runsInReview.length === 1 ? "s" : ""} the old account: send ${r.runsInReview.length === 1 ? "it" : "them"} back to draft to take the new one (the variance review flags it).` : "";
  return `The ${what} change for ${r.employeeName} is approved and now on the record.${slips}${runs}`;
}

/** One change: what changes, why, its timeline, and the decision this viewer may take. */
export function DetailDecisionWindow({ change, onClose, onDone }: { change: DetailChangeView; onClose: () => void; onDone: (result: DetailDecisionResult) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | "withdraw" | null>(null);
  const pending = change.status === "pending";
  const decides = pending && (change.can.approve || change.can.reject);

  const act = async (decision: "approve" | "reject" | "withdraw") => {
    if (busy) return;
    if (decision === "reject" && note.trim().length < 3) {
      setError("Say why the change is rejected (the person who made it reads it).");
      return;
    }
    setBusy(decision);
    const result = await decideEmployeeDetailChangeAction(change.id, decision, note);
    setBusy(null);
    if (result.success) onDone(result.data);
    else setError(result.error);
  };

  return (
    <Window
      open
      onClose={busy ? () => {} : onClose}
      title={`${change.employeeName} · ${change.summary}`}
      description={`${change.employeeCode} · made by ${change.preparedBy}`}
      size="md"
      dirty={!!note.trim() && pending}
      footer={
        <>
          <WindowButton onClick={onClose} disabled={!!busy}>
            Close
          </WindowButton>
          {pending && change.can.withdraw && (
            <WindowButton onClick={() => act("withdraw")} disabled={!!busy}>
              {busy === "withdraw" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Withdraw
            </WindowButton>
          )}
          {pending && change.can.reject && (
            <WindowButton variant="danger" onClick={() => act("reject")} disabled={!!busy}>
              {busy === "reject" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Reject
            </WindowButton>
          )}
          {pending && change.can.approve && (
            <WindowButton variant="primary" onClick={() => act("approve")} disabled={!!busy}>
              {busy === "approve" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Approve
            </WindowButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <DetailStatusChip status={change.status} route={change.route} />
          <Link href={`/workforce/employees/${change.employeeId}`} className="underline underline-offset-2 hover:text-ink">
            Open the employee
          </Link>
        </div>
        <DetailLinesTable lines={change.lines} />
        <div className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs">
          <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Reason</p>
          <p className="mt-0.5 text-ink">{change.reason}</p>
        </div>
        {pending && change.can.reason && !change.can.approve && (
          <Notice tone="info">{change.can.reason}</Notice>
        )}
        {decides && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">
              Note <span className="font-normal text-ink-faint">— needed to reject</span>
            </span>
            <textarea className={cn(inputClass, "h-auto min-h-14 max-w-none py-2")} maxLength={500} value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} placeholder="e.g. Checked against the bank's letter" />
          </label>
        )}
        {pending && change.can.approve && (
          <p className="text-2xs text-ink-muted">
            Approving puts the new details on the record at once and on the employee&apos;s draft payslips. Check the account number against the employee&apos;s letter or the bank&apos;s confirmation first.
          </p>
        )}
        <section aria-label="Timeline">
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Timeline</p>
          <ol className="space-y-1.5 text-xs">
            {change.timeline.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
                <DateCell value={t.at} className="text-ink-faint" />
                <span className="font-medium text-ink">{STEP_LABEL[t.action] ?? t.action}</span>
                <span className="text-ink-muted">· {t.actorName}</span>
                {t.note && t.action !== "submitted" && <span className="w-full pl-0 text-ink-muted sm:w-auto">“{t.note}”</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Window>
  );
}
