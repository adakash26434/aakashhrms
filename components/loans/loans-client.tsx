"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Banknote, FileUp, FolderOpen, HandCoins, Inbox, Landmark, Pencil, Plus, RefreshCw, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { ApprovalPolicyWindow } from "@/components/kit/approval-policy-window";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs } from "@/components/kit/tabs";
import { deleteLoanTypeAction, removeOpeningLoanAction, saveLoanApprovalSettingsAction } from "@/app/actions/loan.actions";
import { KIND_LABEL } from "@/lib/engines/loan.engine";
import { payMonthLabel } from "@/lib/utils/pay-month";
import type { LoanRequestRow, LoanRow, LoansPage, LoanTypeRow } from "@/lib/types/loan";
import { DecisionWindow, DisburseWindow, LoanDetailWindow, LoanOpeningImportWindow, LoanStatus, LoanTypeWindow, RepaymentWindow, RequestStatus, RequestWindow, WriteOffWindow, rs } from "./loan-windows";

// Loans and salary advances (4.10): the register of running and closed loans, the requests (asked
// by HR or by employees in self-service, approved by someone else, then disbursed) and the loan
// types. Payroll recovers loans through the payslips; the server decides who may act on what
// (scope, never one's own loan, the approval engine) — the buttons only follow what it says.

type Tab = "loans" | "requests" | "types";

const LOAN_STATUS = [
  { value: "ACTIVE", label: "Running" },
  { value: "CLOSED", label: "Closed" },
];
const REQUEST_STATUS = [
  { value: "mine", label: "Waiting for me" },
  { value: "pending", label: "Waiting for approval" },
  { value: "approved", label: "To disburse" },
  { value: "disbursed", label: "Disbursed" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];
const SOURCE = [
  { value: "disbursed", label: "Given here" },
  { value: "opening", label: "Carried from before" },
];

type Open =
  | { kind: "request" }
  | { kind: "decide"; request: LoanRequestRow }
  | { kind: "disburse"; request: LoanRequestRow }
  | { kind: "repay"; loan: LoanRow }
  | { kind: "writeOff"; loan: LoanRow }
  | { kind: "detail"; loanId: string }
  | { kind: "type"; type: LoanTypeRow | null }
  | { kind: "import" }
  | { kind: "settings" }
  | null;

/** Search by name, code or loan type. */
const matches = (r: { employeeName: string; employeeCode: string; typeName: string }, needle: string) =>
  !needle || r.employeeName.toLowerCase().includes(needle) || r.employeeCode.toLowerCase().includes(needle) || r.typeName.toLowerCase().includes(needle);

const limitText = (t: LoanTypeRow) =>
  [t.maxAmount > 0 ? rs(t.maxAmount) : null, t.maxSalaryMonths > 0 ? `${t.maxSalaryMonths} × salary` : null].filter(Boolean).join(" or ") || "No limit";

export function LoansClient({ data, initialTab, initialStatus }: { data: LoansPage; initialTab?: Tab; initialStatus?: string }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const can = data.permissions;
  const toActOn = data.totals.waitingForMe + (can.add ? data.totals.toDisburse : 0);
  const [tab, setTab] = useState<Tab>(() => initialTab ?? (toActOn ? "requests" : "loans"));
  const [loanFilters, setLoanFilters] = useState<FilterValues>((): FilterValues => ({ status: "ACTIVE" }));
  const [requestFilters, setRequestFilters] = useState<FilterValues>((): FilterValues => (initialStatus ? { status: initialStatus } : data.totals.waitingForMe ? { status: "mine" } : {}));
  const [search, setSearch] = useState("");
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [confirm, setConfirm] = useState<{ kind: "removeOpening"; loan: LoanRow } | { kind: "deleteType"; type: LoanTypeRow } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = (text: string) => {
    setOpen(null);
    setConfirm(null);
    setNotice(text);
    router.refresh();
  };

  const q = search.trim().toLowerCase();
  const loans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.loans.filter(
      (l) =>
        (!loanFilters.status || l.status === loanFilters.status) &&
        (!loanFilters.type || l.typeId === loanFilters.type) &&
        (!loanFilters.source || l.source === loanFilters.source) &&
        matches(l, needle)
    );
  }, [data.loans, loanFilters, search]);
  const requests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.requests.filter(
      (r) => (!requestFilters.status || (requestFilters.status === "mine" ? r.waitingForMe : r.status === requestFilters.status)) && (!requestFilters.type || r.typeId === requestFilters.type) && matches(r, needle)
    );
  }, [data.requests, requestFilters, search]);

  const activeLoan = data.loans.find((l) => l.id === activeLoanId) ?? null;
  const activeRequest = data.requests.find((r) => r.id === activeRequestId) ?? null;
  const activeType = data.types.find((t) => t.id === activeTypeId) ?? null;
  const offered = data.types.filter((t) => t.isActive);
  const typeOptions = data.types.map((t) => ({ value: t.id, label: t.name }));

  const loanColumns = useMemo<GridColumn<LoanRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (l) => l.employeeCode, width: 90 },
      { id: "name", header: "Employee", value: (l) => l.employeeName, width: 160 },
      { id: "type", header: "Type", value: (l) => l.typeName, width: 150 },
      { id: "given", header: "Given", type: "date", value: (l) => l.givenDate },
      { id: "amount", header: "Amount", type: "amount", value: (l) => l.amount, total: "sum", width: 120 },
      { id: "installment", header: "Each month", type: "amount", value: (l) => (l.status === "ACTIVE" ? l.installment : null), width: 115 },
      { id: "returned", header: "Paid back", type: "amount", value: (l) => l.returned, total: "sum", defaultHidden: true },
      { id: "remaining", header: "Balance", type: "amount", value: (l) => l.remaining, total: "sum", width: 120 },
      { id: "pct", header: "Repaid %", type: "number", value: (l) => l.repaidPct, width: 85, defaultHidden: true },
      { id: "left", header: "Left", type: "number", value: (l) => (l.status === "ACTIVE" ? l.installmentsLeft : null), width: 65 },
      { id: "status", header: "Status", type: "status", value: (l) => l.status, cell: (l) => <LoanStatus l={l} />, width: 130 },
      { id: "from", header: "Deducted from", value: (l) => (l.firstDeductionMonth ? payMonthLabel(l.firstDeductionMonth) : ""), width: 125, defaultHidden: true },
      { id: "source", header: "Came from", value: (l) => (l.source === "opening" ? "Before this system" : "Given here"), width: 140, defaultHidden: true },
      { id: "rate", header: "Interest %", type: "number", value: (l) => l.interestRate, defaultHidden: true },
      { id: "total", header: "Total to repay", type: "amount", value: (l) => l.totalPayable, defaultHidden: true },
      { id: "pending", header: "On unlocked payslips", type: "amount", value: (l) => l.reserved || null, defaultHidden: true },
    ],
    []
  );
  const requestColumns = useMemo<GridColumn<LoanRequestRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", value: (r) => r.employeeCode, width: 90 },
      { id: "name", header: "Employee", value: (r) => r.employeeName, width: 160 },
      { id: "type", header: "Type", value: (r) => r.typeName, width: 160 },
      { id: "amount", header: "Amount", type: "amount", value: (r) => r.amount, total: "sum", width: 120 },
      { id: "months", header: "Months", type: "number", value: (r) => r.installments, width: 75 },
      { id: "installment", header: "Each month", type: "amount", value: (r) => Number(r.terms.installment), width: 115 },
      { id: "asked", header: "Asked", type: "date", value: (r) => r.requestedAt.slice(0, 10) },
      { id: "status", header: "Status", type: "status", value: (r) => r.status, cell: (r) => <RequestStatus r={r} />, width: 210 },
      { id: "from", header: "From", value: (r) => (r.source === "self_service" ? "Self-service" : `Office · ${r.preparedByName ?? ""}`), width: 160, defaultHidden: true },
      { id: "reason", header: "What for", value: (r) => r.reason, width: 220, defaultHidden: true },
    ],
    []
  );
  const typeColumns = useMemo<GridColumn<LoanTypeRow>[]>(
    () => [
      { id: "name", header: "Name", value: (t) => t.name, width: 180 },
      { id: "kind", header: "Kind", value: (t) => KIND_LABEL[t.kind], width: 130 },
      { id: "limit", header: "Limit", value: limitText, width: 190 },
      { id: "months", header: "Months, at most", type: "number", value: (t) => t.maxInstallments, width: 120 },
      { id: "rate", header: "Interest %", type: "number", value: (t) => t.interestRate, width: 95 },
      { id: "after", header: "After months", type: "number", value: (t) => t.eligibleAfterMonths || null, width: 105 },
      { id: "ess", header: "Self-service", value: (t) => (t.selfService ? "Yes" : "No"), width: 105 },
      { id: "active", header: "Offered", type: "status", value: (t) => (t.isActive ? "active" : "inactive"), cell: (t) => <StatusChip status={t.isActive ? "active" : "inactive"} label={t.isActive ? "Offered" : "Off"} />, width: 100 },
      { id: "use", header: "Loans & requests", type: "number", value: (t) => t.inUse, width: 130 },
    ],
    []
  );

  const refresh = { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh" as const, disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) };
  const newRequest = { id: "new", label: "New request", icon: Plus, group: "create" as const, primary: true, hidden: !can.add, disabled: !offered.length, disabledReason: "Add a loan type first", onClick: () => setOpen({ kind: "request" }) };
  const own = "Your own loan is handled by someone else";
  const repayBlock = !activeLoan ? "Choose a loan" : activeLoan.status !== "ACTIVE" ? "Only a running loan" : activeLoan.own ? own : activeLoan.heldBySettlement ? "The final settlement recovers it" : null;
  const writeOffBlock = repayBlock ?? (activeLoan && activeLoan.reserved > 0 ? `On the ${activeLoan.reservedIn.join(", ")} payslip, not yet locked` : null);
  const removeBlock = !activeLoan ? "Choose a loan" : !activeLoan.removable ? "Only a carried loan nothing has touched yet" : activeLoan.own ? own : null;
  const openBlock = !activeRequest ? "Choose a request" : null;
  const disburseBlock = !activeRequest ? "Choose a request" : activeRequest.can.disburseReason;

  const actions =
    tab === "loans"
      ? [
          newRequest,
          { id: "detail", label: "Details", icon: FolderOpen, group: "selection" as const, disabled: !activeLoan, disabledReason: "Choose a loan", onClick: () => activeLoan && setOpen({ kind: "detail", loanId: activeLoan.id }) },
          { id: "repay", label: "Repayment", icon: HandCoins, group: "selection" as const, hidden: !can.edit, disabled: !!repayBlock, disabledReason: repayBlock ?? undefined, onClick: () => activeLoan && setOpen({ kind: "repay", loan: activeLoan }) },
          { id: "writeOff", label: "Write off", icon: Ban, group: "selection" as const, hidden: !can.approve, disabled: !!writeOffBlock, disabledReason: writeOffBlock ?? undefined, onClick: () => activeLoan && setOpen({ kind: "writeOff", loan: activeLoan }) },
          { id: "remove", label: "Remove", icon: Trash2, group: "selection" as const, hidden: !can.remove, disabled: !!removeBlock, disabledReason: removeBlock ?? undefined, onClick: () => activeLoan && setConfirm({ kind: "removeOpening", loan: activeLoan }) },
          { id: "import", label: "Opening balances", icon: FileUp, group: "output" as const, hidden: !can.add, onClick: () => setOpen({ kind: "import" }) },
          refresh,
        ]
      : tab === "requests"
        ? [
            newRequest,
            { id: "open", label: "Open", icon: FolderOpen, group: "selection" as const, disabled: !!openBlock, disabledReason: openBlock ?? undefined, onClick: () => activeRequest && setOpen({ kind: "decide", request: activeRequest }) },
            { id: "disburse", label: "Disburse", icon: Banknote, group: "selection" as const, hidden: !can.add, disabled: !!disburseBlock, disabledReason: disburseBlock ?? undefined, onClick: () => activeRequest && setOpen({ kind: "disburse", request: activeRequest }) },
            { id: "settings", label: "Approval settings", icon: ShieldCheck, group: "output" as const, hidden: !can.settings, onClick: () => setOpen({ kind: "settings" }) },
            refresh,
          ]
        : [
            { id: "newType", label: "New loan type", icon: Plus, group: "create" as const, primary: true, hidden: !can.types, onClick: () => setOpen({ kind: "type", type: null }) },
            { id: "editType", label: "Edit", icon: Pencil, group: "selection" as const, hidden: !can.types, disabled: !activeType, disabledReason: "Choose a loan type", onClick: () => activeType && setOpen({ kind: "type", type: activeType }) },
            {
              id: "deleteType",
              label: "Delete",
              icon: Trash2,
              group: "selection" as const,
              hidden: !can.types || !can.remove,
              disabled: !activeType || activeType.inUse > 0,
              disabledReason: !activeType ? "Choose a loan type" : "It has loans or requests: switch it off instead",
              onClick: () => activeType && setConfirm({ kind: "deleteType", type: activeType }),
            },
            refresh,
          ];

  const pendingCount = data.requests.filter((r) => r.status === "pending").length;
  const description = `${data.totals.running} running · ${rs(data.totals.outstanding)} to recover · ${rs(data.totals.monthly)} a month${data.totals.waitingForMe ? ` · ${data.totals.waitingForMe} waiting for you` : ""}`;

  return (
    <div>
      <PageBar title="Loans & advances" description={description} actions={actions} />

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <Guide
        id="loans"
        title="How loans and advances work"
        className="mb-3"
        steps={[
          { title: "Ask", text: "HR asks for an employee, or employees ask in self-service for the types that allow it. Each type sets the limit (an amount, or months of basic + grade), the months to repay and any flat interest." },
          { title: "Approve, then disburse", text: "Someone else approves — never the person who asked, never for one's own loan. Disbursing records how it was paid out and the month payroll starts deducting." },
          { title: "Recovered by payroll", text: "Each regular payslip deducts the installment (cut, never below zero net pay); locking the run posts it to the loan. Cash repayments, the final settlement or a write-off close what is left." },
        ]}
      />

      <Tabs
        items={[
          { id: "loans", label: "Loans", icon: Landmark },
          { id: "requests", label: "Requests", icon: Inbox, badge: toActOn || undefined },
          { id: "types", label: "Loan types", icon: Settings2 },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        label="Loan views"
      >
        <div className="space-y-3 pt-3">
          {tab === "loans" && (
            <>
              <FilterStrip
                id="loans"
                filters={[
                  { id: "status", label: "Status", options: LOAN_STATUS, allLabel: "Running and closed" },
                  { id: "type", label: "Type", options: typeOptions, allLabel: "All types" },
                  { id: "source", label: "Came from", options: SOURCE, allLabel: "All" },
                ]}
                values={loanFilters}
                onChange={setLoanFilters}
                search={{ value: search, onChange: setSearch, placeholder: "Name, code or type" }}
              />
              <DataGrid
                id="loans-register"
                label="Loans"
                columns={loanColumns}
                rows={loans}
                getRowId={(l) => l.id}
                activeRowId={activeLoanId}
                onActiveRowChange={(l) => setActiveLoanId(l.id)}
                onOpen={(l) => setOpen({ kind: "detail", loanId: l.id })}
                rowTone={(l) => (l.heldBySettlement ? "info" : undefined)}
                exportModule="LOANS"
                exportName="loans"
                empty={{ title: "No loans", description: Object.values(loanFilters).some(Boolean) || q ? "Nothing matches the filters." : "Disbursed requests and loans carried from the old system appear here." }}
              />
            </>
          )}
          {tab === "requests" && (
            <>
              {data.me.otherApprovers === 0 && can.approve && <Notice tone="warning">Nobody else can approve loans yet: give a second user Loans → Approve (nobody approves a request they asked for).</Notice>}
              <FilterStrip
                id="loan-requests"
                filters={[
                  { id: "status", label: "Status", options: REQUEST_STATUS, allLabel: "All statuses" },
                  { id: "type", label: "Type", options: typeOptions, allLabel: "All types" },
                ]}
                values={requestFilters}
                onChange={setRequestFilters}
                search={{ value: search, onChange: setSearch, placeholder: "Name, code or type" }}
              />
              <DataGrid
                id="loan-requests"
                label="Loan requests"
                columns={requestColumns}
                rows={requests}
                getRowId={(r) => r.id}
                activeRowId={activeRequestId}
                onActiveRowChange={(r) => setActiveRequestId(r.id)}
                onOpen={(r) => setOpen({ kind: "decide", request: r })}
                rowTone={(r) => (r.waitingForMe ? "warning" : r.status === "approved" && r.can.disburse ? "info" : undefined)}
                exportModule="LOANS"
                exportName="loan-requests"
                empty={{ title: "No requests", description: Object.values(requestFilters).some(Boolean) || q ? "Nothing matches the filters." : "Requests from HR and from self-service appear here." }}
              />
            </>
          )}
          {tab === "types" && (
            <>
              {!data.types.length && <Notice tone="info">No loan types yet. Add the loans and salary advances the company gives, with their limits.</Notice>}
              <DataGrid
                id="loan-types"
                label="Loan types"
                columns={typeColumns}
                rows={data.types}
                getRowId={(t) => t.id}
                activeRowId={activeTypeId}
                onActiveRowChange={(t) => setActiveTypeId(t.id)}
                onOpen={(t) => (can.types ? setOpen({ kind: "type", type: t }) : undefined)}
                pageSize={0}
                empty={{ title: "No loan types", description: can.types ? "Add one with New loan type." : "A company-wide user adds them." }}
              />
            </>
          )}
        </div>
      </Tabs>

      {open?.kind === "request" && <RequestWindow data={data} onClose={() => setOpen(null)} onSaved={done} />}
      {open?.kind === "decide" && <DecisionWindow request={open.request} onClose={() => setOpen(null)} onDone={done} onDisburse={() => setOpen({ kind: "disburse", request: open.request })} />}
      {open?.kind === "disburse" && <DisburseWindow request={open.request} data={data} onClose={() => setOpen(null)} onDone={done} />}
      {open?.kind === "repay" && <RepaymentWindow loan={open.loan} today={data.today} onClose={() => setOpen(null)} onDone={done} />}
      {open?.kind === "writeOff" && <WriteOffWindow loan={open.loan} onClose={() => setOpen(null)} onDone={done} />}
      {open?.kind === "detail" && <LoanDetailWindow loanId={open.loanId} onClose={() => setOpen(null)} />}
      {open?.kind === "type" && <LoanTypeWindow type={open.type} onClose={() => setOpen(null)} onSaved={done} />}
      {open?.kind === "import" && <LoanOpeningImportWindow onClose={() => setOpen(null)} onImported={(text) => (setNotice(text), router.refresh())} />}
      {open?.kind === "settings" && (
        <ApprovalPolicyWindow
          title="Approval settings · Loans and advances"
          description="Who approves loan and salary advance requests before they are disbursed. Company administrators can Final approve; nobody approves their own loan."
          policy={data.policy}
          approvers={data.approvers}
          help={{
            simple: "Any user with Loans → Approve approves it, never the person who asked.",
            multi_level: "Named approvers in order: Level 2 acts only after Level 1. Approved when the last level approves.",
            none: "Requests are approved once made. A request about the person asking still needs someone else.",
          }}
          pendingNote={pendingCount ? `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting keep the approvers they were sent to.` : "Applies to requests made from now on."}
          levelsHint="A level is skipped when its approver asked for the loan or it is their own. Approvers away can delegate in Users."
          noApproverHint="No active user can approve loans yet. Give a role Loans → Approve in Roles."
          onSave={async (policy) => {
            const r = await saveLoanApprovalSettingsAction(policy);
            if (!r.success) return { ok: false, error: r.error, errors: ("validationErrors" in r && r.validationErrors) || {} };
            done(r.data.pendingKept ? `Approval settings saved. ${r.data.pendingKept} waiting request${r.data.pendingKept === 1 ? "" : "s"} keep their approvers.` : "Approval settings saved.");
            return { ok: true };
          }}
          onClose={() => setOpen(null)}
        />
      )}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "deleteType" ? "Delete this loan type?" : "Remove this carried loan?"}
        tone="danger"
        message={
          confirm?.kind === "deleteType"
            ? `${confirm.type.name} has no loans or requests.`
            : confirm
              ? `${confirm.loan.employeeName}: ${confirm.loan.typeName}, ${rs(confirm.loan.remaining)} to recover. Nothing has been deducted or repaid on it yet.`
              : ""
        }
        confirmLabel={confirm?.kind === "deleteType" ? "Delete" : "Remove"}
        onConfirm={async () => {
          if (!confirm) return;
          const r = confirm.kind === "deleteType" ? await deleteLoanTypeAction(confirm.type.id) : await removeOpeningLoanAction(confirm.loan.id);
          if (!r.success) throw new Error(r.error);
          done(confirm.kind === "deleteType" ? "Loan type deleted." : "Carried loan removed.");
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
