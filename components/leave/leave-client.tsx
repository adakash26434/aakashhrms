"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, ClipboardList, ListPlus, Plus, RefreshCw, Repeat, Wallet } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { useDateText } from "@/components/kit/date-cell";
import { Notice } from "@/components/kit/notice";
import { SelectField } from "@/components/kit/select-field";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { LeavePageData, LeaveTabId } from "@/lib/types/leave";
import { LeaveBalances } from "./leave-balances";
import { LeaveCalendar } from "./leave-calendar";
import { LeaveSubstitute, OpenYearWindow, SwitchHomeLeaveWindow } from "./leave-entitlements";
import { StartingBalancesWindow } from "./starting-balances";
import { LeaveRequests } from "./leave-requests";
import { AdjustBalanceWindow, NewRequestWindow } from "./leave-windows";

/**
 * Leaves (4.6): Requests · Balances · Substitute leave · Calendar, laid out
 * like Attendance: the page bar, a context strip (branch for every tab, the
 * leave year), then the folder tabs. The server counts every request's days
 * from the employee's own calendar, approvals follow the approval engine
 * (supervisor or leave approver, never your own), balances come from the
 * leave ledger, and the leave year is opened once a year.
 */
export function LeaveClient({ data }: { data: LeavePageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const dateText = useDateText();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<LeaveTabId>(data.tab);
  const [branch, setBranch] = useState(data.branchFilter);
  const [windowOpen, setWindowOpen] = useState<null | { kind: "new" } | { kind: "open-year" } | { kind: "switch-home" } | { kind: "starting" } | { kind: "adjust"; employeeId: string }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const can = data.permissions;

  // The URL keeps the tab, branch and calendar month, so a refresh or a shared link opens the same view.
  const go = (next: { tab?: LeaveTabId; branch?: string; y?: number; m?: number }) => {
    const p = new URLSearchParams();
    p.set("tab", next.tab ?? tab);
    const b = next.branch ?? branch;
    if (b) p.set("branch", b);
    if (next.y && next.m) {
      p.set("y", String(next.y));
      p.set("m", String(next.m));
    }
    startRefresh(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  const inBranch = (branchId: string) => !branch || branchId === branch;
  const waiting = data.requests.filter((r) => r.status === "Pending" && (r.can.approve || r.can.finalApprove)).length;
  const toDecide = can.edit ? (data.substitute ?? []).filter((s) => !s.decided && s.employee.id !== data.myEmployeeId).length : 0;
  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "requests", label: "Requests", icon: ClipboardList, badge: waiting || undefined },
      { id: "balances", label: "Balances", icon: Wallet },
      { id: "substitute", label: "Substitute leave", icon: Repeat, badge: toDecide || undefined },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
    ],
    [waiting, toDecide]
  );
  const changeTab = (next: string) => {
    setTab(next as LeaveTabId);
    go({ tab: next as LeaveTabId });
  };
  const done = (text: string) => {
    setWindowOpen(null);
    setNotice(text);
    router.refresh();
  };
  const adjustPerson = windowOpen?.kind === "adjust" ? data.people.find((p) => p.id === windowOpen.employeeId) : undefined;
  const year = data.fiscalYear;

  return (
    <div>
      <PageBar
        title="Leaves"
        description={`${data.people.length} employee${data.people.length === 1 ? "" : "s"}${year ? ` · leave year ${year.label}` : ""}${waiting ? ` · ${waiting} waiting for you` : ""}`}
        actions={[
          { id: "new", label: "New request", icon: Plus, group: "create", primary: true, hidden: !can.add, onClick: () => setWindowOpen({ kind: "new" }) },
          { id: "starting", label: "Starting balances", icon: ListPlus, group: "output", hidden: !can.openYear, onClick: () => setWindowOpen({ kind: "starting" }) },
          { id: "open-year", label: "Open leave year", icon: CalendarPlus, group: "output", hidden: !can.openYear, onClick: () => setWindowOpen({ kind: "open-year" }) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <SelectField
            name="leave-branch"
            options={data.branches.map((b) => ({ value: b.id, label: b.name }))}
            value={branch}
            onChange={(v) => {
              // Filtering happens here, so only the address changes (no reload; the calendar keeps its month).
              setBranch(v);
              const p = new URLSearchParams(window.location.search);
              if (v) p.set("branch", v);
              else p.delete("branch");
              window.history.replaceState(null, "", `${pathname}?${p.toString()}`);
            }}
            placeholder="All branches"
            allowEmpty
          />
        </div>
        <span className="text-2xs text-ink-muted">
          {year ? `Leave year ${year.label} (${dateText(year.start)} – ${dateText(year.end)})` : "No fiscal year covers today: set one up in Company setup"}
          {data.leaveStart ? ` · kept in AakashHRMS from ${data.leaveStart.label}` : ""} · weekly offs and holidays inside a leave are not counted.
        </span>
      </div>

      {notice && (
        <Notice tone="success" className="mb-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Leave views">
        {tab === "requests" && <LeaveRequests data={data} inBranch={inBranch} onNew={() => setWindowOpen({ kind: "new" })} onDone={done} />}
        {tab === "balances" && <LeaveBalances data={data} inBranch={inBranch} onAdjust={(employeeId) => setWindowOpen({ kind: "adjust", employeeId })} onSwitchHome={() => setWindowOpen({ kind: "switch-home" })} />}
        {tab === "substitute" && <LeaveSubstitute data={data} inBranch={inBranch} onDone={done} />}
        {tab === "calendar" && <LeaveCalendar data={data} inBranch={inBranch} loading={refreshing} onMonth={(p) => go(p ? { y: p.year, m: p.month } : {})} />}
      </Tabs>

      {windowOpen?.kind === "new" && <NewRequestWindow data={data} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen?.kind === "starting" && <StartingBalancesWindow onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen?.kind === "switch-home" && <SwitchHomeLeaveWindow onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen?.kind === "open-year" && <OpenYearWindow types={data.types} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {adjustPerson && <AdjustBalanceWindow data={data} person={adjustPerson} onClose={() => setWindowOpen(null)} onSaved={done} />}
    </div>
  );
}
