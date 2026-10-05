"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, ClipboardList, Info, Loader2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { Guide } from "@/components/kit/guide";
import { SelectField } from "@/components/kit/select-field";
import { SplitView } from "@/components/kit/split-view";
import { WindowButton } from "@/components/kit/window";
import { getHomeLeaveYearAction, getLeaveLedgerAction } from "@/app/actions/leave.actions";
import { balanceOn, capOf, fmt } from "@/lib/engines/leave.engine";
import { LEDGER_KIND_LABEL, type EmployeeBalancesRow, type HomeLeaveYear, type LeavePageData, type LedgerLine } from "@/lib/types/leave";
import { HomeLeaveYearView } from "./home-leave-year";
import { cn } from "@/lib/utils";

type Line = LedgerLine & { createdByName: string | null };

/**
 * Balances for the leave year: employees × balance types (home, sick,
 * substitute, company types with a balance). Event leave (maternity,
 * mourning …) has no balance. The pane shows the ledger: every credit,
 * leave taken and adjustment, never edited or deleted.
 */
export function LeaveBalances({ data, onAdjust, onSwitchHome, onStartingBalances }: { data: LeavePageData; onAdjust: (employeeId: string) => void; onSwitchHome: () => void; onStartingBalances: () => void }) {
  const dateText = useDateText();
  const [branch, setBranch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<{ employeeId: string; lines: Line[] | null; error: string | null } | null>(null);
  const [homeYear, setHomeYear] = useState<{ employeeId: string; year: HomeLeaveYear | null } | null>(null);
  const balanceTypes = useMemo(() => data.types.filter((t) => t.kind === "balance" && t.isActive), [data.types]);
  const sickType = data.types.find((t) => t.statutoryCode === "SICK");
  const homeType = data.types.find((t) => t.statutoryCode === "HOME");
  const sickDays = sickType?.days ?? 12;
  const sickCap = (sickType && capOf(sickType)) ?? 45;
  const homeCap = (homeType && capOf(homeType)) ?? 90;
  const rows = data.balances.filter((b) => !branch || b.employee.branchId === branch);
  const active = data.balances.find((b) => b.employee.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    getLeaveLedgerAction(activeId).then((r) => {
      if (live) setLedger({ employeeId: activeId, lines: r.success ? r.data : null, error: r.success ? null : r.error });
    });
    getHomeLeaveYearAction(activeId).then((r) => {
      if (live) setHomeYear({ employeeId: activeId, year: r.success ? r.data : null });
    });
    return () => {
      live = false;
    };
    // The balances change after an adjustment: reload with them.
  }, [activeId, data.balances]);

  const columns = useMemo<GridColumn<EmployeeBalancesRow>[]>(
    () => [
      { id: "name", header: "Employee", width: 200, sticky: true, value: (b) => b.employee.fullName, cell: (b) => <span className="font-medium text-ink">{b.employee.fullName} <span className="font-code text-3xs text-ink-faint">{b.employee.employeeCode}</span></span> },
      { id: "branch", header: "Branch", width: 140, value: (b) => b.employee.branchName, defaultHidden: true },
      { id: "dept", header: "Department", width: 150, value: (b) => b.employee.departmentName },
      ...balanceTypes.map(
        (t): GridColumn<EmployeeBalancesRow> => ({
          id: `t-${t.id}`,
          header: t.name,
          type: "number",
          width: t.statutoryCode === "HOME" ? 210 : 140,
          value: (b) => b.cells.find((c) => c.leaveTypeId === t.id)?.balance ?? null,
          cell: (b) => {
            const c = b.cells.find((x) => x.leaveTypeId === t.id);
            if (!c) return <span className="text-ink-faint">—</span>;
            if (c.home) {
              const h = c.home;
              return (
                <span className="tabular-nums" title={h.givenUpFront !== null ? `${fmt(h.givenUpFront)} days given up front by the old system; not switched to earned home leave yet` : `Earned ${fmt(h.earned)} so far this year; up to ${fmt(h.upTo)} by the year end if every day is paid. Taken ${fmt(c.taken)}.`}>
                  <span className={cn("font-semibold", c.balance < 0 ? "text-danger" : "text-ink")}>{fmt(c.balance)}</span>
                  <span className="text-2xs text-ink-muted"> · {h.givenUpFront !== null ? "given up front" : `earned ${fmt(h.earned)} of up to ${fmt(h.upTo)}`}</span>
                </span>
              );
            }
            return (
              <span className="tabular-nums" title={`Taken ${fmt(c.taken)} this year${c.waiting ? `, ${fmt(c.waiting)} waiting` : ""}`}>
                <span className={cn("font-semibold", c.balance < 0 ? "text-danger" : "text-ink")}>{fmt(c.balance)}</span>
                {(c.taken > 0 || c.waiting > 0) && (
                  <span className="text-2xs text-ink-muted">
                    {" "}
                    · {fmt(c.taken)} taken{c.waiting ? `, ${fmt(c.waiting)} waiting` : ""}
                  </span>
                )}
              </span>
            );
          },
        })
      ),
    ],
    [balanceTypes]
  );

  if (!data.fiscalYear) {
    return <p className="p-4 text-xs text-ink-muted">No fiscal year covers today, so there is no leave year. Set up the fiscal year first (the leave year is the fiscal year, Labour Act §50).</p>;
  }

  const own = active?.employee.id === data.myEmployeeId;
  const lines = ledger?.employeeId === activeId ? ledger.lines : null;

  return (
    <div className="p-3">
      <Guide
        id="leave-balances"
        className="mb-3"
        title="How leave balances work"
        steps={[
          { title: "Sick leave", text: `${fmt(sickDays)} days are given at the start of each leave year (less for someone who joins during the year). Unused days build up to ${sickCap}.` },
          { title: "Home leave", text: `Earned by working: 1 day for every 20 days paid, added when an attendance month is closed. Unused days build up to ${homeCap}.` },
          { title: "Substitute leave", text: "Given for working on a weekly off or holiday (Substitute leave tab). It must be taken within 21 days." },
          { title: "Each new year", text: "Press Open leave year at the top: balances carry over, and days above the limits are paid out at basic salary." },
        ]}
        note="Click a name to see every change to that person's balance, with who made it and why. Maternity, maternity care and mourning leave have no balance: they are given each time they are needed."
      />
      {data.homeSwitch && (
        <div role="status" className="mb-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2.5 text-xs text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Home leave for {data.fiscalYear.label} was given up front by the old system.</p>
            <p className="mt-0.5 text-ink-muted">
              {data.homeSwitch.people} {data.homeSwitch.people === 1 ? "employee has" : "employees have"} home leave given in full for the year ({fmt(data.homeSwitch.givenUpFront)} days in all). The law gives it as it is earned: 1 day for every 20 paid days. Switching replaces the up-front days with what each person has earned, and from then on every closed attendance month adds its days.
              {!data.permissions.openYear && " Someone with a company-wide leave role can make the switch."}
            </p>
          </div>
          {data.permissions.openYear && (
            <WindowButton variant="primary" onClick={onSwitchHome}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> Switch to earned home leave…
            </WindowButton>
          )}
        </div>
      )}
      {data.homeMonthsToClose.length > 0 && (
        <div role="status" className="mb-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-info/30 bg-info-subtle px-3 py-2.5 text-xs text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Home leave for {data.homeMonthsToClose.map((m) => m.label).join(", ")} isn&apos;t added yet.</p>
            <p className="mt-0.5 text-ink-muted">
              {data.homeMonthsToClose.length === 1 ? "The month has" : "These months have"} ended, but attendance isn&apos;t closed for {Math.max(...data.homeMonthsToClose.map((m) => m.people))} employee{Math.max(...data.homeMonthsToClose.map((m) => m.people)) === 1 ? "" : "s"}. Home leave is added when a month is closed in Attendance → Month close.
            </p>
          </div>
          <Link href={`/timeAndLeave/attendance?tab=close&year=${data.homeMonthsToClose[0].year}&month=${data.homeMonthsToClose[0].month}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-sunken">
            Go to month close <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <SelectField name="balance-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={branch} onChange={setBranch} placeholder="All branches" allowEmpty />
        </div>
        {data.permissions.openYear && (
          <WindowButton onClick={onStartingBalances}>
            <ClipboardList className="h-3.5 w-3.5" /> Starting balances…
          </WindowButton>
        )}
        <span className="text-2xs text-ink-muted">
          Leave year {data.fiscalYear.label} ({dateText(data.fiscalYear.start)} – {dateText(data.fiscalYear.end)}).{" "}
          {data.leaveStart
            ? `Leave is kept here from ${data.leaveStart.label}; earlier balances came in as starting balances.`
            : data.permissions.openYear
              ? "Starting to keep leave here? Enter everyone's balances from the old records with Starting balances."
              : null}{" "}
          Balances are what can be taken today.
        </span>
      </div>
      <SplitView
        id="leave-balances"
        detailTitle={active ? `${active.employee.fullName} · balances` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <div className="space-y-3 text-xs">
              {data.permissions.edit && (
                <div className="space-y-1 rounded-lg border border-line bg-surface px-3 py-2.5">
                  <WindowButton onClick={() => onAdjust(active.employee.id)} disabled={own}>
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust balance
                  </WindowButton>
                  {own && <p className="text-2xs text-ink-muted">This is your own balance, so someone else has to adjust it.</p>}
                </div>
              )}
              {homeYear?.employeeId === active.employee.id && homeYear.year && <HomeLeaveYearView year={homeYear.year} />}
              {ledger?.error && (
                <p role="alert" className="text-danger">
                  {ledger.error}
                </p>
              )}
              {!lines && !ledger?.error && (
                <p className="flex items-center gap-1.5 text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the ledger…
                </p>
              )}
              {lines &&
                balanceTypes
                  .filter((t) => active.cells.some((c) => c.leaveTypeId === t.id))
                  .map((t) => {
                    const own = lines.filter((l) => l.leaveTypeId === t.id);
                    return (
                      <section key={t.id} aria-label={t.name} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                        <h3 className="mb-1.5 flex justify-between text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                          <span>{t.name}</span>
                          <span className="text-ink">{fmt(balanceOn(own, data.today).available)}</span>
                        </h3>
                        {own.length === 0 ? (
                          <p className="text-2xs text-ink-muted">Nothing this leave year.</p>
                        ) : (
                          <table className="w-full text-2xs">
                            <tbody>
                              {own.map((l) => (
                                <tr key={l.id} className="border-t border-line first:border-0 align-top">
                                  <td className="py-1 pr-2 whitespace-nowrap text-ink-muted">{dateText(l.entryDate)}</td>
                                  <td className="py-1 pr-2">
                                    <span className="text-ink">{LEDGER_KIND_LABEL[l.kind]}</span>
                                    {l.note && <span className="block text-ink-muted">{l.note}</span>}
                                    {l.expiresOn && l.days > 0 && <span className={cn("block", l.expiresOn < data.today ? "text-ink-faint line-through" : "text-warning")}>Expires {dateText(l.expiresOn)}</span>}
                                    {l.createdByName && <span className="block text-ink-faint">by {l.createdByName}</span>}
                                  </td>
                                  <td className={cn("py-1 text-right tabular-nums font-medium", l.days < 0 ? "text-danger" : "text-success")}>
                                    {l.days > 0 ? "+" : ""}
                                    {fmt(l.days)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </section>
                    );
                  })}
            </div>
          ) : null
        }
        master={
          <DataGrid
            id="leave-balances"
            label="Leave balances"
            columns={columns}
            rows={rows}
            getRowId={(b) => b.employee.id}
            activeRowId={activeId}
            onActiveRowChange={(b) => setActiveId(b.employee.id)}
            onOpen={(b) => setActiveId(b.employee.id)}
            defaultSort={{ columnId: "name", direction: "asc" }}
            pageSize={100}
            empty={{ title: "No employees", description: "Employees in your scope appear here with their balances." }}
          />
        }
      />
    </div>
  );
}
