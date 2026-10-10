"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, FileText, Gavel, Pencil, Plus, RefreshCw, Send, Tags } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { moveReimbursementClaimAction } from "@/app/actions/reimbursement.actions";
import { nprText } from "@/lib/engines/reimbursement.engine";
import type { ReimbursementClaimRow, ReimbursementPage, ReimbursementTypeRow } from "@/lib/types/reimbursement";
import { ClaimWindow, DecisionWindow, TypeWindow } from "./reimbursement-windows";

// Reimbursements (4.8 / F16): claims of employees in the viewer's scope — waiting ones first — and
// the types. Approved claims are paid by the next pay run (REIMBURSE / REIMBURSE_TAX lines) or
// marked paid by hand. The server decides who may act (never on one's own claim, S21).

const STATUS_OPTIONS = [
  { value: "submitted", label: "Waiting for approval" },
  { value: "approved", label: "Approved, to be paid" },
  { value: "settled", label: "Paid" },
  { value: "draft", label: "Draft / returned" },
  { value: "rejected", label: "Rejected" },
];

type Window = { kind: "claim"; claim: ReimbursementClaimRow | null } | { kind: "decide"; claim: ReimbursementClaimRow } | { kind: "type"; type: ReimbursementTypeRow | null } | null;

export function ReimbursementClient({ data }: { data: ReimbursementPage }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const can = data.permissions;
  const waiting = data.claims.filter((c) => c.status === "submitted" && !c.own).length;
  const [tab, setTab] = useState<"claims" | "types">("claims");
  // Waiting claims first, for someone who can decide them.
  const [filters, setFilters] = useState<FilterValues>(() => {
    const start: FilterValues = {};
    if (waiting && can.approve) start.status = "submitted";
    return start;
  });
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [open, setOpen] = useState<Window>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ claim: ReimbursementClaimRow; to: "submitted" | "settled" } | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.claims.filter(
      (c) =>
        (!filters.status || c.status === filters.status) &&
        (!filters.type || c.typeId === filters.type) &&
        (!q || c.employeeName.toLowerCase().includes(q) || c.employeeCode.toLowerCase().includes(q) || (c.receiptNo ?? "").toLowerCase().includes(q))
    );
  }, [data.claims, filters, search]);
  const active = data.claims.find((c) => c.id === activeId) ?? null;
  const activeType = data.types.find((t) => t.id === activeTypeId) ?? null;

  const done = (text: string) => {
    setOpen(null);
    setConfirm(null);
    setNotice(text);
    router.refresh();
  };

  const columns = useMemo<GridColumn<ReimbursementClaimRow>[]>(
    () => [
      { id: "date", header: "Bill date", type: "date", value: (c) => c.expenseDate },
      { id: "code", header: "Code", type: "code", value: (c) => c.employeeCode, width: 100 },
      { id: "name", header: "Employee", value: (c) => c.employeeName, width: 180 },
      { id: "type", header: "For", value: (c) => c.typeName, width: 150 },
      { id: "amount", header: "Amount", type: "amount", value: (c) => c.amount, total: "sum" },
      { id: "taxable", header: "Taxable", value: (c) => (c.taxable ? "Yes" : "No"), width: 80, defaultHidden: true },
      { id: "receipt", header: "Bill no.", value: (c) => c.receiptNo ?? "", width: 110 },
      { id: "what", header: "What for", value: (c) => c.description, width: 220, defaultHidden: true },
      { id: "status", header: "Status", type: "status", value: (c) => c.status, cell: (c) => <StatusChip status={c.status} label={c.status === "settled" ? (c.paidByPayroll ? "Paid (payroll)" : "Paid by hand") : undefined} /> },
      { id: "decided", header: "Decided by", value: (c) => c.decidedByName ?? "", width: 140, defaultHidden: true },
      { id: "note", header: "Decision note", value: (c) => c.decisionNote ?? "", width: 200, defaultHidden: true },
    ],
    []
  );
  const typeColumns = useMemo<GridColumn<ReimbursementTypeRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (t) => t.code, width: 120 },
      { id: "name", header: "Name", value: (t) => t.name, width: 180 },
      { id: "np", header: "नेपाली", value: (t) => t.nameNp ?? "", width: 150 },
      { id: "taxable", header: "Taxable", value: (t) => (t.taxable ? "Yes" : "No"), width: 90 },
      { id: "claimCap", header: "Most per claim", type: "amount", value: (t) => t.perClaimCap },
      { id: "yearCap", header: "Most per year", type: "amount", value: (t) => t.yearlyCap },
      { id: "receipt", header: "Bill no.", value: (t) => (t.receiptRequired ? "Needed" : "Optional"), width: 100 },
      { id: "active", header: "Status", type: "status", value: (t) => (t.isActive ? "active" : "inactive") },
    ],
    []
  );

  const selfReason = "Your own claim is decided by someone else";
  return (
    <div>
      <PageBar
        title="Reimbursements"
        description={`${data.claims.length} claim${data.claims.length === 1 ? "" : "s"}${waiting ? ` · ${waiting} waiting for approval` : ""} · approved claims are paid with the next pay run`}
        actions={
          tab === "claims"
            ? [
                { id: "new", label: "New claim", icon: Plus, group: "create", primary: true, hidden: !can.add || !data.types.some((t) => t.isActive), onClick: () => setOpen({ kind: "claim", claim: null }) },
                {
                  id: "edit",
                  label: "Edit",
                  icon: Pencil,
                  group: "selection",
                  hidden: !can.manage,
                  disabled: active?.status !== "draft",
                  disabledReason: "Only a draft is edited",
                  onClick: () => active && setOpen({ kind: "claim", claim: active }),
                },
                {
                  id: "submit",
                  label: "Submit",
                  icon: Send,
                  group: "selection",
                  hidden: !can.add,
                  disabled: active?.status !== "draft",
                  disabledReason: "Choose a draft",
                  onClick: () => active && setConfirm({ claim: active, to: "submitted" }),
                },
                {
                  id: "decide",
                  label: "Decide",
                  icon: Gavel,
                  group: "selection",
                  hidden: !can.approve,
                  disabled: active?.status !== "submitted" || active.own,
                  disabledReason: active?.own ? selfReason : "Choose a claim waiting for approval",
                  onClick: () => active && setOpen({ kind: "decide", claim: active }),
                },
                {
                  id: "paid",
                  label: "Mark paid",
                  icon: Banknote,
                  group: "selection",
                  hidden: !can.settle,
                  disabled: active?.status !== "approved" || active.own,
                  disabledReason: active?.own ? selfReason : "Choose an approved claim (the pay run pays them by itself)",
                  onClick: () => active && setConfirm({ claim: active, to: "settled" }),
                },
                { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
              ]
            : [
                { id: "newType", label: "New type", icon: Plus, group: "create", primary: true, hidden: !can.manage, onClick: () => setOpen({ kind: "type", type: null }) },
                { id: "editType", label: "Edit", icon: Pencil, group: "selection", hidden: !can.manage, disabled: !activeType, disabledReason: "Choose a type", onClick: () => activeType && setOpen({ kind: "type", type: activeType }) },
                { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
              ]
        }
      />

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <Tabs
        items={[
          { id: "claims", label: "Claims", icon: FileText, badge: waiting || undefined },
          { id: "types", label: "Types", icon: Tags, badge: data.types.length || undefined },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "claims" | "types")}
        label="Reimbursement views"
      >
        {tab === "claims" ? (
          <div className="space-y-3 pt-3">
            {!data.types.some((t) => t.isActive) && (
              <Notice tone="info">
                No reimbursement types yet. {can.manage ? "Add the kinds of bills the company pays back under Types (e.g. medical, mobile, fuel)." : "Someone with Reimbursements → Edit adds them."}
              </Notice>
            )}
            <FilterStrip
              id="reimbursements"
              filters={[
                { id: "status", label: "Status", options: STATUS_OPTIONS, allLabel: "All statuses" },
                { id: "type", label: "For", options: data.types.map((t) => ({ value: t.id, label: t.name })), allLabel: "All types" },
              ]}
              values={filters}
              onChange={setFilters}
              search={{ value: search, onChange: setSearch, placeholder: "Name, code or bill no." }}
            />
            <DataGrid
              id="reimbursement-claims"
              label="Reimbursement claims"
              columns={columns}
              rows={rows}
              getRowId={(c) => c.id}
              activeRowId={activeId}
              onActiveRowChange={(c) => setActiveId(c.id)}
              onOpen={(c) => (c.status === "submitted" && can.approve && !c.own ? setOpen({ kind: "decide", claim: c }) : c.status === "draft" && can.manage ? setOpen({ kind: "claim", claim: c }) : undefined)}
              rowTone={(c) => (c.status === "submitted" ? "warning" : c.status === "rejected" ? "danger" : undefined)}
              exportModule="REIMBURSEMENTS"
              exportName="reimbursements"
              empty={{ title: "No claims", description: Object.values(filters).some(Boolean) || search ? "Nothing matches the filters." : "Claims recorded here or in self-service show up here." }}
            />
          </div>
        ) : (
          <div className="pt-3">
            <DataGrid
              id="reimbursement-types"
              label="Reimbursement types"
              columns={typeColumns}
              rows={data.types}
              getRowId={(t) => t.id}
              activeRowId={activeTypeId}
              onActiveRowChange={(t) => setActiveTypeId(t.id)}
              onOpen={(t) => can.manage && setOpen({ kind: "type", type: t })}
              empty={{ title: "No types", description: "Add the kinds of bills the company pays back (e.g. medical, mobile, fuel)." }}
            />
          </div>
        )}
      </Tabs>

      {open?.kind === "claim" && <ClaimWindow data={data} claim={open.claim} onClose={() => setOpen(null)} onSaved={done} />}
      {open?.kind === "decide" && <DecisionWindow claim={open.claim} onClose={() => setOpen(null)} onDone={done} />}
      {open?.kind === "type" && <TypeWindow type={open.type} onClose={() => setOpen(null)} onSaved={done} />}
      <Confirm
        open={!!confirm}
        title={confirm?.to === "settled" ? "Mark this claim paid by hand?" : "Submit this claim for approval?"}
        message={
          confirm
            ? confirm.to === "settled"
              ? `${confirm.claim.employeeName}: ${nprText(confirm.claim.amount)} for ${confirm.claim.typeName}. Only when it was paid outside payroll (cash or bank); the pay run won't pay it again.`
              : `${confirm.claim.employeeName}: ${nprText(confirm.claim.amount)} for ${confirm.claim.typeName}.`
            : ""
        }
        confirmLabel={confirm?.to === "settled" ? "Mark paid" : "Submit"}
        onConfirm={async () => {
          if (!confirm) return;
          const r = await moveReimbursementClaimAction(confirm.claim.id, confirm.to, "");
          if (!r.success) throw new Error(("validationErrors" in r && r.validationErrors && Object.values(r.validationErrors).find(Boolean)) || r.error);
          done(confirm.to === "settled" ? "Marked paid." : "Submitted for approval.");
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
