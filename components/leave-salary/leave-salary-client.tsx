"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Check, FileText, Pencil, Plus, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { approveLeaveSalaryAction, deleteLeaveSalaryAction } from "@/app/actions/leave-salary.actions";
import { payMonthLabel } from "@/lib/engines/leave-salary.engine";
import type { LeaveSalaryDue, LeaveSalaryPage, LeaveSalaryRow } from "@/lib/types/leave-salary";
import { CancelWindow, EncashmentWindow, PrepareDueWindow } from "./leave-salary-windows";

// Leave salary (4.9): leave paid out in money — the days over the limit when a leave year opened,
// and encashments from the balance in force — prepared here, approved by someone else and paid on
// the pay run (LEAVE_ENCASH, taxed through the payslip). The server decides who may act (never on
// one's own record, never the person who prepared it).

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Waiting for approval" },
  { value: "APPROVED", label: "Approved, to be paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];
const SOURCE_OPTIONS = [
  { value: "year_end", label: "Over the limit at year end" },
  { value: "balance", label: "From the balance" },
  { value: "before", label: "Before this system" },
];
const days = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
const rs = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusChip(r: LeaveSalaryRow) {
  switch (r.status) {
    case "DRAFT":
      return <StatusChip status="pending" label="To approve" />;
    case "APPROVED":
      return <StatusChip status="approved" label="To be paid" />;
    case "PAID":
      return <StatusChip status="paid" label={r.paidWith ? `Paid · ${r.paidWith}` : "Paid by hand"} />;
    default:
      return <StatusChip status="cancelled" />;
  }
}

const sourceText = (r: LeaveSalaryRow) => (r.source === "year_end" ? `Year end${r.leaveYear ? ` · ${r.leaveYear.replace(/^FY\s*/, "")}` : ""}` : r.source === "balance" ? "Balance" : "Before this system");

type Open = { kind: "encash"; record: LeaveSalaryRow | null } | { kind: "due"; lines: LeaveSalaryDue[] } | { kind: "cancel"; record: LeaveSalaryRow } | null;

export function LeaveSalaryClient({ data, initialStatus }: { data: LeaveSalaryPage; initialStatus?: string }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const can = data.permissions;
  const waiting = data.rows.filter((r) => r.status === "DRAFT" && !r.own && !r.mine).length;
  const dueReady = data.due.filter((d) => !d.problem).length;
  const [tab, setTab] = useState<"records" | "due">(() => (!data.rows.length && data.due.length ? "due" : "records"));
  // A status from the link (the bell), otherwise what waits for this person first.
  const [filters, setFilters] = useState<FilterValues>((): FilterValues => (initialStatus ? { status: initialStatus } : waiting && can.approve ? { status: "DRAFT" } : {}));
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDue, setSelectedDue] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Open>(null);
  const [confirm, setConfirm] = useState<{ kind: "approve" | "delete"; record: LeaveSalaryRow } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (!filters.status || r.status === filters.status) &&
        (!filters.source || r.source === filters.source) &&
        (!q || r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q) || r.leaveTypeName.toLowerCase().includes(q))
    );
  }, [data.rows, filters, search]);
  const active = data.rows.find((r) => r.id === activeId) ?? null;
  const chosenDue = data.due.filter((d) => selectedDue.has(d.lineId));

  const done = (text: string) => {
    setOpen(null);
    setConfirm(null);
    setSelectedDue(new Set());
    setNotice(text);
    router.refresh();
  };

  const columns = useMemo<GridColumn<LeaveSalaryRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (r) => r.employeeCode, width: 95 },
      { id: "name", header: "Employee", value: (r) => r.employeeName, width: 180 },
      { id: "leave", header: "Leave", value: (r) => r.leaveTypeName, width: 160 },
      { id: "source", header: "From", value: sourceText, width: 150 },
      { id: "days", header: "Days", type: "number", value: (r) => r.days, width: 70, total: "sum" },
      { id: "rate", header: "Per day", type: "amount", value: (r) => r.perDayRate, defaultHidden: true },
      { id: "amount", header: "Amount", type: "amount", value: (r) => r.amount, total: "sum" },
      { id: "payWith", header: "Pay with", value: (r) => r.payMonthLabel, width: 120 },
      { id: "status", header: "Status", type: "status", value: (r) => r.status, cell: statusChip, width: 150 },
      { id: "prepared", header: "Prepared", type: "date", value: (r) => r.preparedAt.slice(0, 10), width: 110, defaultHidden: true },
      { id: "preparedBy", header: "Prepared by", value: (r) => r.preparedByName ?? "", width: 150, defaultHidden: true },
      { id: "approvedBy", header: "Approved by", value: (r) => r.approvedByName ?? "", width: 150, defaultHidden: true },
      { id: "note", header: "Note", value: (r) => r.cancelReason ? `Cancelled: ${r.cancelReason}` : r.note ?? "", width: 220, defaultHidden: true },
      { id: "tds", header: "TDS (before this system)", type: "amount", value: (r) => r.legacyTds, defaultHidden: true },
    ],
    []
  );
  const dueColumns = useMemo<GridColumn<LeaveSalaryDue>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (d) => d.employeeCode, width: 100 },
      { id: "name", header: "Employee", value: (d) => d.employeeName, width: 180 },
      { id: "leave", header: "Leave", value: (d) => d.leaveTypeName, width: 150 },
      { id: "year", header: "Leave year", value: (d) => d.leaveYear ?? "", width: 120 },
      { id: "days", header: "Days over the limit", type: "number", value: (d) => d.days, width: 150, total: "sum" },
      { id: "rate", header: "Per day now", type: "amount", value: (d) => d.perDayRate },
      { id: "amount", header: "Amount now", type: "amount", value: (d) => d.amount, total: "sum" },
      { id: "problem", header: "Why not now", value: (d) => d.problem ?? "", width: 240 },
    ],
    []
  );

  const selfReason = "Your own leave salary is decided by someone else";
  const refresh = { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh" as const, disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) };
  const approveBlock = !active ? "Choose a leave salary" : active.status !== "DRAFT" ? "Only one waiting for approval" : active.own ? selfReason : active.mine ? "You prepared it: someone else approves it" : null;
  const cancelBlock = !active ? "Choose a leave salary" : active.status !== "APPROVED" ? "Only an approved one not yet paid" : active.own ? selfReason : null;

  return (
    <div>
      <PageBar
        title="Leave salary"
        description={`${data.rows.length} record${data.rows.length === 1 ? "" : "s"}${waiting ? ` · ${waiting} waiting for approval` : ""}${dueReady ? ` · ${dueReady} due at year end` : ""} · paid with the pay run`}
        actions={
          tab === "records"
            ? [
                { id: "new", label: "New encashment", icon: Plus, group: "create", primary: true, hidden: !can.add || !data.types.length, onClick: () => setOpen({ kind: "encash", record: null }) },
                { id: "edit", label: "Edit", icon: Pencil, group: "selection", hidden: !can.edit, disabled: active?.status !== "DRAFT", disabledReason: "Only a draft is edited", onClick: () => active && setOpen({ kind: "encash", record: active }) },
                { id: "approve", label: "Approve", icon: Check, group: "selection", hidden: !can.approve, disabled: !!approveBlock, disabledReason: approveBlock ?? undefined, onClick: () => active && setConfirm({ kind: "approve", record: active }) },
                { id: "cancel", label: "Cancel", icon: Ban, group: "selection", hidden: !can.approve, disabled: !!cancelBlock, disabledReason: cancelBlock ?? undefined, onClick: () => active && setOpen({ kind: "cancel", record: active }) },
                { id: "delete", label: "Delete draft", icon: Trash2, group: "selection", hidden: !can.remove, disabled: active?.status !== "DRAFT", disabledReason: "Only a draft is deleted", onClick: () => active && setConfirm({ kind: "delete", record: active }) },
                refresh,
              ]
            : [
                {
                  id: "prepare",
                  label: chosenDue.length ? `Prepare ${chosenDue.length}` : "Prepare",
                  icon: FileText,
                  group: "selection",
                  primary: true,
                  hidden: !can.add,
                  disabled: !chosenDue.some((d) => !d.problem),
                  disabledReason: "Tick the days to prepare",
                  onClick: () => setOpen({ kind: "due", lines: chosenDue }),
                },
                refresh,
              ]
        }
      />

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <Guide
        id="leave-salary"
        title="How leave salary works"
        className="mb-3"
        steps={[
          { title: "Prepare", text: "Days over the limit when the leave year opened (Due at year end), or days encashed from the balance in force (New encashment). The amount is basic in force ÷ 30 a day, or the leave type's own rate — never below basic." },
          { title: "Approve", text: "Someone else approves: never the person who prepared it, never for one's own record. Days from the balance leave it now; cancelling an approved one gives them back." },
          { title: "Paid with the pay run", text: "The regular pay run of the chosen month (or the next one) pays it as Leave encashment; the payslip's tax projection withholds the TDS. Leaving employees are paid in the final settlement." },
        ]}
      />

      <Tabs
        items={[
          { id: "records", label: "Leave salary", icon: WalletCards, badge: waiting || undefined },
          { id: "due", label: "Due at year end", icon: CalendarClock, badge: dueReady || undefined },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "records" | "due")}
        label="Leave salary views"
      >
        {tab === "records" ? (
          <div className="space-y-3 pt-3">
            {!data.types.length && can.add && (
              <Notice tone="info">No leave is encashed from the balance: a leave type has to be paid out in money (Policies → Leave types), and rights such as sick leave never are.</Notice>
            )}
            <FilterStrip
              id="leave-salary"
              filters={[
                { id: "status", label: "Status", options: STATUS_OPTIONS, allLabel: "All statuses" },
                { id: "source", label: "From", options: SOURCE_OPTIONS, allLabel: "Year end and balance" },
              ]}
              values={filters}
              onChange={setFilters}
              search={{ value: search, onChange: setSearch, placeholder: "Name, code or leave" }}
            />
            <DataGrid
              id="leave-salary-records"
              label="Leave salary"
              columns={columns}
              rows={rows}
              getRowId={(r) => r.id}
              activeRowId={activeId}
              onActiveRowChange={(r) => setActiveId(r.id)}
              onOpen={(r) => (r.status === "DRAFT" && can.edit ? setOpen({ kind: "encash", record: r }) : undefined)}
              rowTone={(r) => (r.status === "DRAFT" && !r.own && !r.mine ? "warning" : undefined)}
              exportModule="LEAVE_SALARY"
              exportName="leave-salary"
              empty={{ title: "No leave salary", description: Object.values(filters).some(Boolean) || search ? "Nothing matches the filters." : "Prepare the days due at year end, or a new encashment from the balance." }}
            />
          </div>
        ) : (
          <div className="space-y-3 pt-3">
            <p className="text-xs text-ink-muted">
              Days over the limit (home leave 90, sick leave 45, a company type&apos;s own) that opening a leave year took off the balance to be paid out. Tick them and prepare: someone else approves, the pay run pays.
            </p>
            <DataGrid
              id="leave-salary-due"
              label="Due at year end"
              columns={dueColumns}
              rows={data.due}
              getRowId={(d) => d.lineId}
              selectable={can.add}
              selected={selectedDue}
              onSelectedChange={setSelectedDue}
              rowTone={(d) => (d.problem ? "warning" : undefined)}
              empty={{ title: "Nothing due", description: "Opening a leave year lists here the days over the limit to be paid out." }}
            />
          </div>
        )}
      </Tabs>

      {open?.kind === "encash" && <EncashmentWindow data={data} record={open.record} onClose={() => setOpen(null)} onSaved={done} />}
      {open?.kind === "due" && <PrepareDueWindow data={data} lines={open.lines} onClose={() => setOpen(null)} onDone={done} />}
      {open?.kind === "cancel" && <CancelWindow record={open.record} onClose={() => setOpen(null)} onDone={done} />}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "delete" ? "Delete this draft?" : "Approve this leave salary?"}
        tone={confirm?.kind === "delete" ? "danger" : "default"}
        message={
          confirm
            ? confirm.kind === "delete"
              ? `${confirm.record.employeeName}: ${confirm.record.leaveTypeName}, ${days(confirm.record.days)}, ${rs(confirm.record.amount)}.${confirm.record.source === "year_end" ? " The days stay due and can be prepared again." : ""}`
              : `${confirm.record.employeeName}: ${confirm.record.leaveTypeName}, ${days(confirm.record.days)} — ${rs(confirm.record.amount)}, paid with the ${confirm.record.payMonthLabel} pay run (or the next one).${confirm.record.source === "balance" ? " The days leave the balance now." : ""}`
            : ""
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete" : "Approve"}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === "delete") {
            const r = await deleteLeaveSalaryAction(confirm.record.id);
            if (!r.success) throw new Error(r.error);
            return done("Draft deleted.");
          }
          const r = await approveLeaveSalaryAction(confirm.record.id);
          if (!r.success) throw new Error(r.error);
          done(`Approved: the ${payMonthLabel(r.data.payMonth)} pay run pays it (or the next one).`);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
