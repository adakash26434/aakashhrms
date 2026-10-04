"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight, ClipboardCheck, Fingerprint, LockKeyhole, Plus, RefreshCw, Settings2, Table2, TimerReset } from "lucide-react";
import { PageBar } from "@/components/frame/page-bar";
import { useDateText } from "@/components/kit/date-cell";
import { SelectField } from "@/components/kit/select-field";
import { Tabs, type TabItem } from "@/components/kit/tabs";
import { WindowButton } from "@/components/kit/window";
import { shiftPeriod, periodFor } from "@/lib/engines/pay-period.engine";
import type { AttendancePageData, AttendanceTab } from "@/lib/types/attendance";
import { AttendanceAdjustments } from "./attendance-adjustments";
import { AttendanceClose } from "./attendance-close";
import { AttendancePunches } from "./attendance-punches";
import { AttendanceRegister } from "./attendance-register";
import { AttendanceToday } from "./attendance-today";
import { AdjustmentWindow, PunchWindow, RulesWindow } from "./attendance-windows";

/**
 * Attendance (4.5): Today · Register (month) · Adjustments · Month close ·
 * Punch log. The month follows the company calendar (BS now; AD with
 * payroll runs in AD months, 4.8). Every day is decided by one set of rules
 * (lib/engines/attendance-day.engine.ts) and the server re-checks every change.
 */
export function AttendanceClient({ data }: { data: AttendancePageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const dateText = useDateText();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<AttendanceTab>(data.tab);
  const [windowOpen, setWindowOpen] = useState<null | "punch" | "adjustment" | "rules">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { permissions: can, period } = data;

  const go = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { tab, year: period.year, month: period.month, branch: branchFilter, ...params };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") sp.set(k, String(v));
    startRefresh(() => router.push(`${pathname}?${sp.toString()}`));
  };
  const branchFilter = data.branchId;
  const changeTab = (next: string) => {
    setTab(next as AttendanceTab);
    go({ tab: next });
  };
  const step = (delta: number) => {
    const p = shiftPeriod(periodFor(period.calendar, period.year, period.month), delta);
    go({ year: p.year, month: p.month });
  };

  const waiting = data.adjustments.filter((a) => a.status === "pending" && (a.can.approve || a.can.finalApprove)).length;
  const missing = data.register.reduce((n, r) => n + r.summary.missingPunchDays, 0);
  const closed = data.months.filter((m) => m.status === "closed").length;
  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "today", label: "Today", icon: CalendarCheck2 },
      { id: "register", label: "Register", icon: Table2, badge: missing || undefined },
      { id: "adjustments", label: "Adjustments", icon: ClipboardCheck, badge: waiting || undefined },
      { id: "close", label: "Month close", icon: LockKeyhole, badge: data.months.length ? `${closed}/${data.months.length}` : undefined },
      { id: "punches", label: "Punch log", icon: Fingerprint },
    ],
    [missing, waiting, closed, data.months.length]
  );

  const done = (text: string) => {
    setWindowOpen(null);
    setNotice(text);
    router.refresh();
  };

  return (
    <div>
      <PageBar
        title="Attendance"
        description={`${data.register.length} employee${data.register.length === 1 ? "" : "s"} · ${period.label} (${dateText(period.start)} – ${dateText(period.end)}, ${period.days} days)`}
        actions={[
          { id: "punch", label: "Add punch", icon: Plus, group: "create", primary: tab === "today" || tab === "register", hidden: !can.add, onClick: () => setWindowOpen("punch") },
          { id: "adjustment", label: "New adjustment", icon: TimerReset, group: "create", hidden: !can.add, onClick: () => setWindowOpen("adjustment") },
          { id: "rules", label: "Attendance rules", icon: Settings2, group: "output", hidden: !can.settings, onClick: () => setWindowOpen("rules") },
          { id: "refresh", label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCw, group: "refresh", disabled: refreshing, onClick: () => startRefresh(() => router.refresh()) },
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-line-input bg-surface p-0.5">
          <WindowButton aria-label="Previous month" title="Previous month" onClick={() => step(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </WindowButton>
          <span className="min-w-36 px-2 text-center text-sm font-semibold text-ink">{period.label}</span>
          <WindowButton aria-label="Next month" title="Next month" onClick={() => step(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </WindowButton>
        </div>
        <div className="w-56">
          <SelectField
            name="attendance-branch"
            options={data.branches.map((b) => ({ value: b.id, label: b.name }))}
            value={branchFilter}
            onChange={(v) => go({ branch: v })}
            placeholder="All branches"
            allowEmpty
          />
        </div>
        <span className="text-2xs text-ink-muted">
          Office time {data.rules.shift.start}–{data.rules.shift.end} · grace {data.rules.shift.graceMinutes} min · a day with nothing recorded counts as {data.rules.noRecord}.
        </span>
      </div>

      {notice && (
        <div role="status" className="mb-3 flex items-start justify-between gap-3 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-xs text-ink">
          <p>{notice}</p>
          <button type="button" className="cursor-pointer text-2xs font-medium text-ink-muted hover:text-ink" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Tabs variant="folder" items={tabs} value={tab} onChange={changeTab} label="Attendance views">
        {tab === "today" && <AttendanceToday data={data} />}
        {tab === "register" && <AttendanceRegister data={data} onSaved={(t) => done(t)} />}
        {tab === "adjustments" && <AttendanceAdjustments data={data} onNew={() => setWindowOpen("adjustment")} onDone={(t) => done(t)} />}
        {tab === "close" && <AttendanceClose data={data} onDone={(t) => done(t)} />}
        {tab === "punches" && <AttendancePunches data={data} onDone={(t) => done(t)} />}
      </Tabs>

      {windowOpen === "punch" && <PunchWindow data={data} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen === "adjustment" && <AdjustmentWindow data={data} onClose={() => setWindowOpen(null)} onSaved={done} />}
      {windowOpen === "rules" && <RulesWindow data={data} onClose={() => setWindowOpen(null)} onSaved={done} />}
    </div>
  );
}
