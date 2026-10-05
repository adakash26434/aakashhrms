"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CalendarPlus, Check, CheckCircle2, CircleDashed, Loader2, X } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { Guide } from "@/components/kit/guide";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { SelectField } from "@/components/kit/select-field";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { ReasonWindow } from "@/components/attendance/attendance-windows";
import { grantSubstituteLeaveAction, homeSwitchPreviewAction, leaveOpeningPreviewAction, openLeaveYearAction, switchHomeLeaveAction } from "@/app/actions/leave.actions";
import { capOf, fmt } from "@/lib/engines/leave.engine";
import type { HomeSwitchPreview, LeavePageData, LeaveRuleType, OpeningPreview, SubstituteSuggestion } from "@/lib/types/leave";
import { cn } from "@/lib/utils";
import { daysText, weekday } from "./leave-windows";

// ---------------------------------------------------------------------------
// Opening a leave year (Balances tab)
// ---------------------------------------------------------------------------

type OpeningRowView = OpeningPreview["rows"][number];

/** The company's own limits for the "what opening does" list (the law's unless a type says more). */
function limits(types: readonly LeaveRuleType[]) {
  const home = types.find((t) => t.statutoryCode === "HOME" && t.isActive);
  const sick = types.find((t) => t.statutoryCode === "SICK" && t.isActive);
  return { homeCap: home ? capOf(home) ?? 90 : 90, sickCap: sick ? capOf(sick) ?? 45 : 45, sickDays: sick?.days ?? 12 };
}

/**
 * Opens the next leave year (Labour Act §49 / §50), once: each balance
 * carries over up to its cap (home 90, sick 45), the excess is marked to be
 * paid out at basic salary (paid by leave salary, 4.9) or lapses, and the
 * year's credits are given (sick 12, pro-rata for joiners). The window says
 * plainly whether it can be done now, what is still needed (a checklist,
 * each with what to do), what opening does, and the figures it will post.
 */
export function OpenYearWindow({ types, onClose, onSaved }: { types: readonly LeaveRuleType[]; onClose: () => void; onSaved: (text: string) => void }) {
  const dateText = useDateText();
  const [preview, setPreview] = useState<OpeningPreview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const law = limits(types);

  useEffect(() => {
    let live = true;
    leaveOpeningPreviewAction().then((r) => {
      if (!live) return;
      if (r.success) setPreview(r.data);
      else setFailure(r.error);
    });
    return () => {
      live = false;
    };
  }, []);

  const columns = useMemo<GridColumn<OpeningRowView>[]>(
    () =>
      preview
        ? [
            { id: "name", header: "Employee", width: 190, sticky: true, value: (r) => r.employee.fullName, cell: (r) => <span className="font-medium text-ink">{r.employee.fullName} <span className="font-code text-3xs text-ink-faint">{r.employee.employeeCode}</span></span> },
            { id: "branch", header: "Branch", width: 130, value: (r) => r.employee.branchName, defaultHidden: true },
            ...preview.types.map(
              (t): GridColumn<OpeningRowView> => ({
                id: `t-${t.id}`,
                header: t.name,
                type: "number",
                width: 210,
                value: (r) => r.cells.find((c) => c.leaveTypeId === t.id)?.opening ?? null,
                cell: (r) => {
                  const c = r.cells.find((x) => x.leaveTypeId === t.id);
                  if (!c) return <span className="text-ink-faint">—</span>;
                  const parts = [
                    preview.from ? `had ${fmt(c.closing)}` : null,
                    c.over > 0 ? `${fmt(c.over)} ${c.overKind === "paid_out" ? "to be paid out" : "lapse"}` : null,
                    c.credit > 0 ? `+${fmt(c.credit)} new` : null,
                  ].filter(Boolean);
                  return (
                    <span className="tabular-nums">
                      <span className="font-semibold text-ink">{fmt(c.opening)}</span>
                      {parts.length > 0 && <span className={cn("text-2xs", c.over > 0 ? "text-warning" : "text-ink-muted")}> · {parts.join(", ")}</span>}
                    </span>
                  );
                },
              })
            ),
          ]
        : [],
    [preview]
  );

  const open = async () => {
    const r = await openLeaveYearAction();
    if (!r.success) throw new Error(r.error);
    onSaved(`${r.data.label} is open: balances carried over and credited for ${r.data.people} employee${r.data.people === 1 ? "" : "s"}.`);
  };

  const target = preview?.target;
  const ready = !!preview && !!target && preview.problems.length === 0;
  const alreadyOpen = !!preview && !!target && preview.history.some((h) => h.label === target.label);
  return (
    <Window
      open
      onClose={onClose}
      size={target ? "full" : "lg"}
      title={target ? `Open leave year ${target.label}` : "Open the next leave year"}
      description="Once a year, when a new fiscal year starts: carries everyone's leave balances into it and gives the new year's leave."
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          {preview && !ready && <p className="mr-auto text-2xs text-ink-muted">Opening is possible once every item in the checklist is ticked.</p>}
          <WindowCancel>{ready ? "Cancel" : "Close"}</WindowCancel>
          <WindowButton variant="primary" onClick={() => setConfirming(true)} disabled={!ready}>
            <CalendarPlus className="h-3.5 w-3.5" /> {target ? `Open ${target.label}` : "Open"}
          </WindowButton>
        </>
      }
    >
      {!preview && !failure && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the leave year…
        </p>
      )}
      {preview && (
        <div className="@container space-y-3 text-xs">
          {/* Where things stand, in one sentence. */}
          <div className={cn("rounded-lg border px-3 py-2.5", ready ? "border-success/30 bg-success-subtle" : "border-line bg-surface-sunken")}>
            <p className="text-sm font-semibold text-ink">
              {ready
                ? `Ready to open ${target!.label}.`
                : alreadyOpen
                  ? `${target!.label} is already open. Nothing to do.`
                  : target
                    ? `${target.label} can't be opened yet.`
                    : "There is no next leave year to open yet."}
            </p>
            <p className="mt-0.5 text-ink-muted">
              {preview.from && (
                <>
                  The current leave year is <span className="font-medium text-ink">{preview.from.label}</span> ({dateText(preview.from.start)} – {dateText(preview.from.end)}).{" "}
                </>
              )}
              {ready ? "Check the figures below, then press Open. It is done once and can't be undone." : !target && preview.nextStart ? `The next one starts on ${dateText(preview.nextStart)}; come back then.` : null}
            </p>
          </div>

          <div className="grid gap-3 @3xl:grid-cols-2">
            <section aria-label="Before you can open" className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Before you can open</h3>
              <ul className="space-y-2">
                {preview.checks.map((c) => (
                  <li key={c.label} className="flex gap-2">
                    {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Done" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Not yet" />}
                    <span>
                      <span className={cn("block font-medium", c.ok ? "text-ink" : "text-ink")}>{c.label}</span>
                      {c.fix && <span className="block text-2xs text-ink-muted">{c.fix}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="What opening does" className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">What opening does</h3>
              <ol className="list-decimal space-y-1 pl-4 text-ink">
                <li>
                  <span className="font-medium">Home leave</span> carries over, up to {law.homeCap} days. Days above {law.homeCap} are marked <span className="font-medium">to be paid out</span> at basic salary (Labour Act §49).
                </li>
                <li>
                  <span className="font-medium">Sick leave</span> carries over, up to {law.sickCap} days (above that: paid out), and <span className="font-medium">{fmt(law.sickDays)} new days</span> are given. Someone who joined during the year gets a share.
                </li>
                <li>
                  <span className="font-medium">Substitute leave</span> still in date moves over and keeps its expiry date.
                </li>
                <li>
                  <span className="font-medium">Other leave types</span> carry over or start again, as each type is set up.
                </li>
              </ol>
              <p className="mt-2 text-2xs text-ink-muted">Home leave gets no new days here: it is earned month by month (1 day for every 20 days paid) when attendance months are closed. The payment of days marked to be paid out is made with leave salary.</p>
            </section>
          </div>

          {target && (
            <section aria-label="What it will post" className="space-y-2">
              <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">What it will post{hasStarted(preview) ? "" : " (preview as of today)"}</h3>
              <dl className="grid grid-cols-2 gap-2 @lg:grid-cols-5">
                {(
                  [
                    ["Employees", String(preview.totals.people)],
                    ["Days carried over", fmt(preview.totals.carried)],
                    ["To be paid out", fmt(preview.totals.paidOut)],
                    ["Lapsed", fmt(preview.totals.lapsed)],
                    ["New days given", fmt(preview.totals.credited)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2">
                    <dt className="text-2xs text-ink-muted">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-2xs text-ink-muted">Each cell shows the new balance in bold, then what the person had at the end of the old year, any days over the limit, and the new days given.</p>
              <DataGrid
                id="leave-opening"
                label="Opening balances"
                columns={columns}
                rows={preview.rows}
                getRowId={(r) => r.employee.id}
                defaultSort={{ columnId: "name", direction: "asc" }}
                pageSize={100}
                maxHeight="50vh"
                empty={{ title: "Nobody to open", description: "Employees employed on the first day of the year appear here." }}
              />
            </section>
          )}

          {preview.history.length > 0 && (
            <section aria-label="Leave years opened" className="rounded-lg border border-line bg-surface px-3 py-2.5">
              <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Opened before</h3>
              <ul className="space-y-1">
                {preview.history.map((h) => (
                  <li key={h.label + h.openedAt} className="flex flex-wrap gap-x-2 text-2xs">
                    <span className="font-medium text-ink">{h.label}</span>
                    <span className="text-ink-muted">
                      {dateText(h.openedAt.slice(0, 10))} · {h.by} · {h.people} employee{h.people === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <Confirm
        open={confirming && !!target}
        title={`Open ${target?.label ?? "the leave year"}?`}
        message={`This carries over and gives leave for ${preview?.totals.people ?? 0} employees, exactly as shown. It is done once and can't be undone. Type OPEN to confirm.`}
        confirmLabel="Open leave year"
        requireText="OPEN"
        onConfirm={open}
        onCancel={() => setConfirming(false)}
      />
    </Window>
  );
}

/** Whether the target year has started (the figures are final), from the checklist. */
const hasStarted = (p: OpeningPreview) => !p.checks.some((c) => !c.ok && c.label.endsWith("has started"));

// ---------------------------------------------------------------------------
// Switching this year's home leave to earned (once)
// ---------------------------------------------------------------------------

type SwitchRow = HomeSwitchPreview["rows"][number];

/**
 * The old system gave the whole year's home leave up front. This replaces
 * it, for everyone at once, with what each person has earned (1 day per 20
 * paid days, from the closed attendance months); open months add theirs
 * when they close. The preview shows each balance now and after.
 */
export function SwitchHomeLeaveWindow({ onClose, onSaved }: { onClose: () => void; onSaved: (text: string) => void }) {
  const [preview, setPreview] = useState<HomeSwitchPreview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    let live = true;
    homeSwitchPreviewAction().then((r) => {
      if (!live) return;
      if (r.success) setPreview(r.data);
      else setFailure(r.error);
    });
    return () => {
      live = false;
    };
  }, []);

  const columns = useMemo<GridColumn<SwitchRow>[]>(
    () => [
      { id: "name", header: "Employee", width: 190, sticky: true, value: (r) => r.employee.fullName, cell: (r) => <span className="font-medium text-ink">{r.employee.fullName} <span className="font-code text-3xs text-ink-faint">{r.employee.employeeCode}</span></span> },
      { id: "given", header: "Given up front", type: "number", width: 120, value: (r) => r.givenUpFront, cell: (r) => <span className="tabular-nums text-ink-muted line-through">{fmt(r.givenUpFront)}</span> },
      { id: "bf", header: "Brought forward", type: "number", width: 130, value: (r) => r.broughtForward, cell: (r) => <span className="tabular-nums">{fmt(r.broughtForward)}</span> },
      { id: "earned", header: "Earned so far", type: "number", width: 120, value: (r) => r.earnedSoFar, cell: (r) => <span className="tabular-nums text-success">+{fmt(r.earnedSoFar)}</span> },
      { id: "taken", header: "Taken", type: "number", width: 90, value: (r) => r.taken, cell: (r) => <span className="tabular-nums">{fmt(r.taken)}</span> },
      {
        id: "after",
        header: "Balance now → after",
        type: "number",
        width: 170,
        value: (r) => r.balanceAfter,
        cell: (r) => (
          <span className="tabular-nums">
            <span className="text-ink-muted">{fmt(r.balanceNow)}</span> → <span className={cn("font-semibold", r.balanceAfter < 0 ? "text-danger" : "text-ink")}>{fmt(r.balanceAfter)}</span>
          </span>
        ),
      },
    ],
    []
  );

  const closed = preview?.months.filter((m) => m.closed) ?? [];
  const open = preview?.months.filter((m) => !m.closed) ?? [];
  const below = preview?.rows.filter((r) => r.balanceAfter < 0).length ?? 0;
  const run = async () => {
    const r = await switchHomeLeaveAction();
    if (!r.success) throw new Error(r.error);
    onSaved(`Home leave for ${r.data.yearLabel} is now earned month by month for ${r.data.people} employee${r.data.people === 1 ? "" : "s"}.`);
  };
  const names = (list: { label: string }[]) => list.map((m) => m.label.replace(/ \d{4}$/, "")).join(", ");

  return (
    <Window
      open
      onClose={onClose}
      size="xl"
      title="Switch to earned home leave"
      description={preview ? `For ${preview.year.label}: home leave becomes what each person has earned, 1 day for every 20 paid days (Labour Act §43), instead of the year given up front.` : "Home leave becomes what each person has earned, 1 day for every 20 paid days (Labour Act §43)."}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto rounded-md border border-danger/30 bg-danger-subtle px-2.5 py-1 text-xs text-danger">
              {failure}
            </p>
          )}
          <WindowCancel />
          <WindowButton variant="primary" onClick={() => setConfirming(true)} disabled={!preview?.rows.length}>
            <ArrowRightLeft className="h-3.5 w-3.5" /> Switch {preview?.rows.length ?? ""} employee{preview?.rows.length === 1 ? "" : "s"}
          </WindowButton>
        </>
      }
    >
      {!preview && !failure && (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out what each person has earned…
        </p>
      )}
      {preview && (
        <div className="@container space-y-3 text-xs">
          <section aria-label="What happens" className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">What happens</h3>
            <ol className="list-decimal space-y-1 pl-4 text-ink">
              <li>The home leave given up front for {preview.year.label} is taken off each balance. Each person&apos;s history gets a line saying why.</li>
              <li>{closed.length ? <>Each closed attendance month adds the days earned in it: {names(closed)}.</> : <>No attendance month of {preview.year.label} is closed yet, so nothing is added now.</>}</li>
              <li>{open.length ? <>{names(open)} {open.length === 1 ? "adds its days when it is" : "add their days when they are"} closed in Attendance, and so does every month after.</> : <>Every month after this adds its days when it is closed in Attendance.</>}</li>
              <li>Leave already taken stays taken. Days brought forward from earlier years stay.</li>
            </ol>
          </section>
          {!closed.length && (
            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-ink">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>Balances will show only what was brought forward until {names(open.slice(0, 1)) || "the first month"} is closed. Switching now or after closing those months gives the same result.</span>
            </p>
          )}
          {below > 0 && (
            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-ink">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                {below} {below === 1 ? "person has" : "people have"} taken more home leave than earned so far, so the balance goes below 0 until the coming months make it up. New home leave requests are refused while the balance is short.
              </span>
            </p>
          )}
          <DataGrid id="leave-home-switch" label="Home leave before and after" columns={columns} rows={preview.rows} getRowId={(r) => r.employee.id} defaultSort={{ columnId: "name", direction: "asc" }} pageSize={100} maxHeight="45vh" empty={{ title: "Nothing to switch", description: "Everyone's home leave is already earned month by month." }} />
        </div>
      )}
      <Confirm
        open={confirming}
        title="Switch to earned home leave?"
        message={`Home leave for ${preview?.rows.length ?? 0} employees changes exactly as shown. It is done once and can't be undone. Type SWITCH to confirm.`}
        confirmLabel="Switch"
        requireText="SWITCH"
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </Window>
  );
}

// ---------------------------------------------------------------------------
// Substitute leave (Labour Act §42)
// ---------------------------------------------------------------------------

const keyOf = (s: SubstituteSuggestion) => `${s.employee.id}|${s.date}`;
const hours = (m: number) => `${fmt(Math.round((m / 60) * 10) / 10)} h`;
const SUGGESTED: Record<SubstituteSuggestion["suggested"], string> = { 1: "Full day", 0.5: "Half day", 0: "Under half a day" };

type Grant = { employeeId: string; date: string; days: 1 | 0.5 | 0; note?: string };

/**
 * Days worked on a weekly off or holiday in the last 21 days. HR grants a
 * full or half substitute day (it expires 21 days after the day worked, and
 * the oldest grant is used first) or records why not (e.g. paid as
 * overtime). Never your own.
 */
export function LeaveSubstitute({ data, onDone }: { data: LeavePageData; onDone: (text: string) => void }) {
  const dateText = useDateText();
  const [show, setShow] = useState<"open" | "all">("open");
  const [branch, setBranch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refusing, setRefusing] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = data.substitute;
  const rows = useMemo(() => (list ?? []).filter((s) => (show === "all" || !s.decided) && (!branch || s.employee.branchId === branch)), [list, show, branch]);
  const canGrant = data.permissions.edit;
  const grantable = (s: SubstituteSuggestion) => canGrant && !s.decided && s.employee.id !== data.myEmployeeId;
  const chosen = rows.filter((s) => selected.has(keyOf(s)) && grantable(s));

  const send = async (grants: Grant[], text: string): Promise<string | null> => {
    setBusy(true);
    setMessage(null);
    const r = await grantSubstituteLeaveAction(grants);
    setBusy(false);
    if (!r.success) {
      setMessage(r.error);
      return r.error;
    }
    setSelected(new Set());
    setRefusing(null);
    onDone(text);
    return null;
  };
  const grant = (items: SubstituteSuggestion[], days: "suggested" | 1 | 0.5) => {
    const grants = items.map((s) => ({ employeeId: s.employee.id, date: s.date, days: days === "suggested" ? s.suggested : days })).filter((g) => g.days > 0);
    if (!grants.length) return setMessage("None of these reach half a day. Use “Not granted” with a reason instead.");
    const total = grants.reduce((n, g) => n + g.days, 0);
    void send(grants, `Substitute leave granted: ${daysText(total)} for ${grants.length} day${grants.length === 1 ? "" : "s"} worked.`);
  };

  const columns = useMemo<GridColumn<SubstituteSuggestion>[]>(
    () => [
      { id: "name", header: "Employee", width: 190, sticky: true, value: (s) => s.employee.fullName, cell: (s) => <span className="font-medium text-ink">{s.employee.fullName} <span className="font-code text-3xs text-ink-faint">{s.employee.employeeCode}</span></span> },
      { id: "branch", header: "Branch", width: 130, value: (s) => s.employee.branchName, defaultHidden: true },
      { id: "date", header: "Worked on", width: 140, value: (s) => s.date, cell: (s) => <span className="tabular-nums">{weekday(s.date)} {dateText(s.date)}</span> },
      { id: "why", header: "Day", width: 170, value: (s) => s.why },
      { id: "inout", header: "In – out", width: 120, value: (s) => `${s.firstIn ?? ""}–${s.lastOut ?? ""}`, cell: (s) => <span className="tabular-nums text-ink-muted">{s.firstIn ?? "—"} – {s.lastOut ?? "—"}</span> },
      { id: "worked", header: "Worked", type: "number", width: 90, value: (s) => s.workMinutes, cell: (s) => <span className="tabular-nums">{hours(s.workMinutes)}</span> },
      { id: "ot", header: "Off-day OT", type: "number", width: 100, value: (s) => s.otOffMinutes, cell: (s) => (s.otOffMinutes ? <span className="tabular-nums">{hours(s.otOffMinutes)}</span> : <span className="text-ink-faint">—</span>) },
      { id: "suggested", header: "Suggested", width: 130, value: (s) => s.suggested, cell: (s) => <span className={s.suggested ? "text-ink" : "text-ink-muted"}>{SUGGESTED[s.suggested]}</span> },
      { id: "expires", header: "Would expire", width: 120, value: (s) => s.expiresOn, cell: (s) => <span className="tabular-nums text-ink-muted">{dateText(s.expiresOn)}</span> },
      {
        id: "decided",
        header: "Decision",
        width: 220,
        value: (s) => (s.decided ? (s.decided.granted ? `Granted ${s.decided.days}` : "Not granted") : ""),
        cell: (s) =>
          s.decided ? (
            <span className="flex flex-col">
              <span>
                <StatusChip status={s.decided.granted ? "approved" : "rejected"} label={s.decided.granted ? `Granted ${daysText(s.decided.days)}` : "Not granted"} />
              </span>
              <span className="truncate text-2xs text-ink-muted" title={s.decided.note ?? undefined}>
                {s.decided.by ? `by ${s.decided.by}` : ""}
                {s.decided.granted ? "" : s.decided.note ? ` · ${s.decided.note.replace(/^Not granted: /, "")}` : ""}
              </span>
            </span>
          ) : s.employee.id === data.myEmployeeId ? (
            <span className="text-2xs text-ink-muted">Your own: someone else decides</span>
          ) : !canGrant ? (
            <StatusChip status="pending" label="To decide" />
          ) : (
            <span className="flex gap-1">
              {s.suggested > 0 && (
                <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); grant([s], "suggested"); }} className="cursor-pointer rounded border border-brand/40 bg-brand-subtle px-2 py-0.5 text-2xs font-medium text-brand-strong hover:bg-brand hover:text-white disabled:opacity-50">
                  Grant {s.suggested === 1 ? "1 day" : "½ day"}
                </button>
              )}
              <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); setRefusing([keyOf(s)]); }} className="cursor-pointer rounded border border-line-input bg-surface px-2 py-0.5 text-2xs font-medium text-ink-muted hover:text-ink disabled:opacity-50">
                Not granted
              </button>
            </span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grant / send read the latest state when clicked
    [dateText, data.myEmployeeId, canGrant, busy]
  );

  return (
    <div className="p-3">
      <Guide
        id="leave-substitute"
        className="mb-3"
        title="How substitute leave works"
        steps={[
          { title: "Someone works on a day off", text: "When attendance shows work on a person's weekly off or a holiday, the day appears here by itself (the last 21 days)." },
          { title: "Look at the hours", text: "A full shift suggests a full day off, at least half a shift suggests a half day. In – out and hours worked are shown." },
          { title: "Decide", text: "Press Grant on the row, or tick several rows and use the buttons above the list. Choose Not granted, with a reason, if you pay off-day overtime for it instead." },
          { title: "The employee takes it", text: "It is added to their Substitute leave balance and must be taken within 21 days of the day worked (Labour Act §42), or it expires. The oldest day is used first." },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which days" className="inline-flex rounded-md border border-line-input bg-surface p-0.5 text-xs">
          {(
            [
              ["open", `To decide (${(list ?? []).filter((s) => !s.decided).length})`],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={show === id} onClick={() => setShow(id)} className={cn("cursor-pointer rounded px-3 py-1 font-medium", show === id ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-sunken")}>
              {label}
            </button>
          ))}
        </div>
        <div className="w-56">
          <SelectField name="substitute-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={branch} onChange={setBranch} placeholder="All branches" allowEmpty />
        </div>
        {chosen.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted">{chosen.length} selected</span>
            <WindowButton variant="primary" onClick={() => grant(chosen, "suggested")} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Grant as suggested
            </WindowButton>
            <WindowButton onClick={() => grant(chosen, 1)} disabled={busy}>
              Full day
            </WindowButton>
            <WindowButton onClick={() => grant(chosen, 0.5)} disabled={busy}>
              Half day
            </WindowButton>
            <WindowButton variant="danger" onClick={() => setRefusing(chosen.map(keyOf))} disabled={busy}>
              <X className="h-3.5 w-3.5" /> Not granted
            </WindowButton>
          </span>
        )}
      </div>
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      {list === null ? (
        <p className="flex items-center gap-1.5 p-2 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading days worked…
        </p>
      ) : (
        <DataGrid
          id="leave-substitute"
          label="Days worked on a weekly off or holiday"
          columns={columns}
          rows={rows}
          getRowId={keyOf}
          selectable={canGrant}
          selected={selected}
          onSelectedChange={setSelected}
          defaultSort={{ columnId: "date", direction: "desc" }}
          pageSize={100}
          empty={
            show === "open"
              ? { title: "Nothing to decide", description: (list ?? []).length ? "Every day worked on a day off has been decided. See All for the decisions." : "Nobody worked on a weekly off or holiday in the last 21 days. When someone does, the day shows here once their attendance for it is in." }
              : { title: "No days worked on a day off", description: "Nobody in your scope worked on a weekly off or holiday in the last 21 days." }
          }
        />
      )}
      {refusing && (
        <ReasonWindow
          title={refusing.length === 1 ? "Not granting substitute leave" : `Not granting ${refusing.length} days`}
          description="Say why (e.g. paid as off-day overtime). It is recorded against the day, so it is not suggested again."
          action="Record"
          danger
          onClose={() => setRefusing(null)}
          onConfirm={(reason) => {
            const items = (list ?? []).filter((s) => refusing.includes(keyOf(s)));
            return send(
              items.map((s) => ({ employeeId: s.employee.id, date: s.date, days: 0, note: reason })),
              `${items.length} day${items.length === 1 ? "" : "s"} recorded as not granted.`
            );
          }}
        />
      )}
    </div>
  );
}
