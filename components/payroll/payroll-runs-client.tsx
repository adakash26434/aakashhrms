"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Play, Plus, RefreshCw, Settings2, Wallet } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Amount } from "@/components/kit/amount";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { StatusChip } from "@/components/kit/status-chip";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { RUN_TYPE_LABEL } from "@/lib/engines/pay-calendar.engine";
import type { PayrollRunView, PayrollRunsPageData } from "@/lib/types/payroll-run";
import { cn } from "@/lib/utils";
import { PayrollRunWorkspace } from "./payroll-run-workspace";
import { NewRunWindow, PayrollSettingsWindow } from "./payroll-run-windows";

const STATUS: Record<PayrollRunView["status"], { chip: string; label: string }> = {
  DRAFT: { chip: "draft", label: "Draft" },
  UNDER_REVIEW: { chip: "review", label: "Waiting for approval" },
  APPROVED: { chip: "approved", label: "Approved" },
  LOCKED: { chip: "locked", label: "Locked" },
};

/**
 * Payroll (4.8a, template C): Runs (every month's run) and Run (the selected
 * one as steps: Pre-flight → Calculate → Variance → Review → Approval →
 * Lock). The server decides what each person may do; every action checks again.
 */
export function PayrollRunsClient({ data, initialTab }: { data: PayrollRunsPageData; initialTab: "runs" | "run" }) {
  const router = useRouter();
  const dateText = useDateText();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<"runs" | "run">(initialTab);
  const [windowOpen, setWindowOpen] = useState<null | "new" | "settings">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"mine" | "all">("all");
  const selected = data.selected;
  const { permissions: can } = data;

  const waitingForMe = useMemo(() => data.runs.filter((r) => r.status === "UNDER_REVIEW" && (r.can.approve || r.can.finalApprove)), [data.runs]);
  const rows = view === "mine" ? waitingForMe : data.runs;

  const open = (run: PayrollRunView) => {
    setTab("run");
    startRefresh(() => router.push(`/payroll?run=${run.id}&tab=run`));
  };
  const done = (text: string | null) => {
    setWindowOpen(null);
    if (text) setNotice(text);
    router.refresh();
  };

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "runs", label: "Runs", icon: Wallet, badge: waitingForMe.length || undefined },
      { id: "run", label: selected ? selected.run.label : "Run", icon: ListChecks, disabled: !selected },
    ],
    [waitingForMe.length, selected]
  );

  const columns = useMemo<GridColumn<PayrollRunView>[]>(
    () => [
      { id: "period", header: "Month", width: 150, value: (r) => r.payPeriodYear * 100 + r.payPeriodMonth, cell: (r) => <span className="font-medium text-ink">{r.label.split(" · ")[0]}</span> },
      { id: "type", header: "Type", width: 130, value: (r) => RUN_TYPE_LABEL[r.runType], cell: (r) => <span className={r.runType === "REGULAR" ? "text-ink-muted" : "font-medium text-ink"}>{RUN_TYPE_LABEL[r.runType]}</span> },
      { id: "scope", header: "Scope", width: 220, value: (r) => r.scopeText },
      { id: "employees", header: "Employees", type: "number", width: 110, value: (r) => r.employeeCount },
      { id: "gross", header: "Gross", type: "amount", width: 140, value: (r) => Number(r.totalGross), total: "sum" },
      { id: "net", header: "Net payable", type: "amount", width: 150, value: (r) => Number(r.totalNetPayable), cell: (r) => <Amount value={r.totalNetPayable} emphasis />, total: "sum" },
      { id: "status", header: "Status", width: 190, value: (r) => STATUS[r.status].label, cell: (r) => <StatusChip status={STATUS[r.status].chip} label={r.status === "UNDER_REVIEW" ? r.statusText : r.status === "DRAFT" && r.varianceOpen ? `Draft · ${r.varianceOpen} to acknowledge` : STATUS[r.status].label} /> },
      { id: "prepared", header: "Prepared by", width: 180, value: (r) => r.preparedByName, cell: (r) => <span className="text-2xs text-ink-muted">{r.preparedByName} · {dateText(r.generatedAt)}</span> },
      { id: "locked", header: "Locked", type: "date", width: 112, value: (r) => r.lockedAt ?? "" },
    ],
    [dateText]
  );

  return (
    <div>
      <PageBar
        title="Payroll"
        description={`${data.runs.length} run${data.runs.length === 1 ? "" : "s"}${waitingForMe.length ? ` · ${waitingForMe.length} waiting for you` : ""}`}
        actions={[
          { id: "new", label: "New run", icon: Plus, group: "create", primary: true, shortcut: "Ctrl+N", hidden: !can.generate, onClick: () => setWindowOpen("new") },
          { id: "settings", label: "Settings", icon: Settings2, group: "output", hidden: !can.settings, onClick: () => setWindowOpen("settings") },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={(t) => setTab(t as "runs" | "run")} label="Payroll views">
        {tab === "runs" && (
          <div className="p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Which runs" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
                {(
                  [
                    ["mine", `Waiting for me (${waitingForMe.length})`],
                    ["all", "All"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("cursor-pointer rounded px-3 py-1 font-medium", view === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-2xs text-ink-muted">Open a run to see its steps. A month is paid once, by two people: one prepares, another approves.</span>
            </div>
            <DataGrid
              id="payroll-runs"
              label="Payroll runs"
              columns={columns}
              rows={rows}
              getRowId={(r) => r.id}
              activeRowId={selected?.run.id ?? null}
              onActiveRowChange={open}
              onOpen={open}
              rowTone={(r) => (r.status === "UNDER_REVIEW" && (r.can.approve || r.can.finalApprove) ? "warning" : r.openMonths.length && r.status !== "LOCKED" ? "danger" : undefined)}
              defaultSort={{ columnId: "period", direction: "desc" }}
              pageSize={25}
              empty={
                view === "mine"
                  ? { title: "Nothing waiting for you", description: "Runs you can approve appear here." }
                  : { title: "No pay run yet", description: can.generate ? "New run starts the first month: pre-flight, calculation, variance review, approval, lock." : "Runs appear here once payroll prepares one." }
              }
            />
          </div>
        )}
        {tab === "run" && selected && <PayrollRunWorkspace data={data} detail={selected} onDone={done} onOpenSettings={can.settings ? () => setWindowOpen("settings") : undefined} />}
      </Tabs>

      {windowOpen === "new" && (
        <NewRunWindow
          data={data}
          onClose={() => setWindowOpen(null)}
          onGenerated={(runId, employees) => {
            setWindowOpen(null);
            setNotice(`Run generated for ${employees} employee${employees === 1 ? "" : "s"}. Review the payslips (and the variance for a regular run), then submit it for approval.`);
            setTab("run");
            startRefresh(() => router.push(`/payroll?run=${runId}&tab=run`));
          }}
        />
      )}
      {windowOpen === "settings" && <PayrollSettingsWindow data={data} onClose={() => setWindowOpen(null)} onSaved={() => done("Payroll settings saved. Runs submitted from now on follow them.")} />}
      <span className="sr-only">
        <Play className="hidden" />
      </span>
    </div>
  );
}
