"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, Loader2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Guide } from "@/components/kit/guide";
import { Notice } from "@/components/kit/notice";
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
export function LeaveBalances({ data, inBranch, onAdjust, onSwitchHome }: { data: LeavePageData; inBranch: (branchId: string) => boolean; onAdjust: (employeeId: string) => void; onSwitchHome: () => void }) {
  const dateText = useDateText();
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<{ employeeId: string; lines: Line[] | null; error: string | null } | null>(null);
  const [homeYear, setHomeYear] = useState<{ employeeId: string; year: HomeLeaveYear | null } | null>(null);
  const balanceTypes = useMemo(() => data.types.filter((t) => t.kind === "balance" && t.isActive), [data.types]);
  const sickType = data.types.find((t) => t.statutoryCode === "SICK");
  const homeType = data.types.find((t) => t.statutoryCode === "HOME");
  const sickDays = sickType?.days ?? 12;
  const sickCap = (sickType && capOf(sickType)) ?? 45;
  const homeCap = (homeType && capOf(homeType)) ?? 90;
  const q = search.trim().toLowerCase();
  const rows = data.balances.filter(
    (b) => inBranch(b.employee.branchId) && (!filters.department || b.employee.departmentId === filters.department) && (!q || b.employee.fullName.toLowerCase().includes(q) || b.employee.employeeCode.toLowerCase().includes(q))
  );
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
          width: t.statutoryCode === "HOME" ? 180 : 140,
          value: (b) => b.cells.find((c) => c.leaveTypeId === t.id)?.balance ?? null,
          cell: (b) => {
            const c = b.cells.find((x) => x.leaveTypeId === t.id);
            if (!c) return <span className="text-ink-faint">—</span>;
            if (c.home) {
              const h = c.home;
              return (
                <span className="tabular-nums" title={h.givenUpFront !== null ? `${fmt(h.givenUpFront)} days given up front by the old system; not switched to earned home leave yet` : `Earned ${fmt(h.earned)} so far this year; up to ${fmt(h.upTo)} by the year end if every day is paid. Taken ${fmt(c.taken)}.`}>
                  <span className={cn("font-semibold", c.balance < 0 ? "text-danger" : "text-ink")}>{fmt(c.balance)}</span>
                  <span className="text-2xs text-ink-muted"> · {h.givenUpFront !== null ? "given up front" : `up to ${fmt(h.upTo)} this year`}</span>
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
          { title: "Sick leave", text: `${fmt(sickDays)} days at the start of each leave year (a share for joiners); up to ${sickCap} can be saved.` },
          { title: "Home leave", text: `1 day for every 20 paid days, added as each attendance month is closed; up to ${homeCap} can be saved.` },
          { title: "Substitute leave", text: "For working on a weekly off or holiday; to be taken within 21 days." },
          { title: "Each new year", text: "Open leave year carries balances over; days above the limits are paid out." },
        ]}
        note="Balances are what can be taken today. Click a name for the month-by-month home leave and every change, with who made it and why. Maternity, maternity care and mourning have no balance: they are given each time."
      />
      {data.homeSwitch && (
        <Notice
          tone="warning"
          className="mb-3"
          title={`Home leave for ${data.fiscalYear.label} was given up front by the old system`}
          action={
            data.permissions.openYear ? (
              <WindowButton variant="primary" onClick={onSwitchHome}>
                <ArrowRightLeft className="h-3.5 w-3.5" /> Switch to earned home leave…
              </WindowButton>
            ) : undefined
          }
        >
          {data.homeSwitch.people} {data.homeSwitch.people === 1 ? "employee has" : "employees have"} the whole year&apos;s home leave already ({fmt(data.homeSwitch.givenUpFront)} days in all). The law gives it as it is earned, 1 day for every 20 paid days; switching replaces it with what each person has earned.
          {!data.permissions.openYear && " Someone with a company-wide leave role can make the switch."}
        </Notice>
      )}
      {data.homeMonthsToClose.length > 0 && (
        <Notice
          tone="info"
          className="mb-3"
          title={`Home leave for ${data.homeMonthsToClose.map((m) => m.label).join(", ")} isn't added yet`}
          action={
            <Link href={`/timeAndLeave/attendance?tab=close&year=${data.homeMonthsToClose[0].year}&month=${data.homeMonthsToClose[0].month}`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-sunken">
              Go to month close <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {data.homeMonthsToClose.length === 1 ? "The month has" : "These months have"} ended but {data.homeMonthsToClose.length === 1 ? "isn't" : "aren't"} closed in Attendance. Each month&apos;s home leave is added when it is closed.
        </Notice>
      )}
      <FilterStrip
        id="leave-balances"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[{ id: "department", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) }]}
      />
      <SplitView
        id="leave-balances"
        detailTitle={active ? `${active.employee.fullName} · balances` : undefined}
        onCloseDetail={() => setActiveId(null)}
        detail={
          active ? (
            <div className="space-y-3 text-xs">
              {data.permissions.edit && (
                <div className="space-y-1">
                  <WindowButton onClick={() => onAdjust(active.employee.id)} disabled={own}>
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust balance
                  </WindowButton>
                  {own && <p className="text-2xs text-ink-muted">This is your own balance, so someone else has to adjust it.</p>}
                </div>
              )}
              {homeYear?.employeeId === active.employee.id && homeYear.year && <HomeLeaveYearView year={homeYear.year} />}
              {ledger?.error && <Notice tone="danger">{ledger.error}</Notice>}
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
                          <table className="w-full table-fixed text-2xs">
                            <colgroup>
                              <col className="w-24" />
                              <col />
                              <col className="w-12" />
                            </colgroup>
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
