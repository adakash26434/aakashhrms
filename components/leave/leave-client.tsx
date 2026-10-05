"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, ClipboardList, Plus, RefreshCw, Repeat, Wallet } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import type { LeavePageData, LeaveTabId } from "@/lib/types/leave";
import { LeaveBalances } from "./leave-balances";
import { LeaveCalendar } from "./leave-calendar";
import { LeaveSubstitute, OpenYearWindow } from "./leave-entitlements";
import { LeaveRequests } from "./leave-requests";
import { AdjustBalanceWindow, NewRequestWindow } from "./leave-windows";

/**
 * Leaves (4.6): Requests · Balances · Substitute · Calendar. The server
 * counts every request's days from the employee's own calendar, approvals
 * follow the approval engine (supervisor or leave approver, never your own),
 * balances come from the leave ledger, and the leave year is opened once a
 * year (carry-over with the Labour Act caps).
 */
export function LeaveClient({ data }: { data: LeavePageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<LeaveTabId>(data.tab);
  const [windowOpen, setWindowOpen] = useState<null | { kind: "new" } | { kind: "open-year" } | { kind: "adjust"; employeeId: string }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const can = data.permissions;

  const waiting = data.requests.filter((r) => r.status === "Pending" && (r.can.approve || r.can.finalApprove)).length;
  const toDecide = data.permissions.edit ? (data.substitute ?? []).filter((s) => !s.decided && s.employee.id !== data.myEmployeeId).length : 0;
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
    startRefresh(() => router.replace(`${pathname}?tab=${next}`, { scroll: false }));
  };
  const done = (text: string) => {
    setWindowOpen(null);
    setNotice(text);
    router.refresh();
  };
  const adjustPerson = windowOpen?.kind === "adjust" ? data.people.find((p) => p.id === windowOpen.employeeId) : undefined;

  return (
    <div>
      <PageBar
        title="Leaves"
        description={`${data.people.length} employee${data.people.length === 1 ? "" : "s"}${data.fiscalYear ? ` · leave year ${data.fiscalYear.label}` : ""}${waiting ? ` · ${waiting} waiting for you` : ""}`}
        actions={[
          { id: "new", label: "New request", icon: Plus, group: "create", primary: true, hidden: !can.add, onClick: () => setWindowOpen({ kind: "new" }) },
          { id: "open-year", label: "Open leave year", icon: CalendarPlus, group: "create", hidden: !can.openYear, onClick: () => setWindowOpen({ kind: "open-year" }) },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      {notice && (
        <div role="status" className="mb-3 flex items-start justify-between gap-3 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
          <p>{notice}</p>
          <button type="button" className="cursor-pointer text-2xs font-medium text-ink-muted hover:text-ink" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Leave views">
        {tab === "requests" && <LeaveRequests data={data} onNew={() => setWindowOpen({ kind: "new" })} onDone={done} />}
        {tab === "balances" && <LeaveBalances data={data} onAdjust={(employeeId) => setWindowOpen({ kind: "adjust", employeeId })} />}
        {tab === "substitute" && <LeaveSubstitute data={data} onDone={done} />}
        {tab === "calendar" && <LeaveCalendar data={data} />}
      </Tabs>

      {windowOpen?.kind === "new" && <NewRequestWindow data={data} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen?.kind === "open-year" && <OpenYearWindow types={data.types} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {adjustPerson && <AdjustBalanceWindow data={data} person={adjustPerson} onClose={() => setWindowOpen(null)} onSaved={done} />}
    </div>
  );
}
