"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { SelectField } from "@/components/kit/select-field";
import { SplitView } from "@/components/kit/split-view";
import { WindowButton } from "@/components/kit/window";
import { getLeaveLedgerAction } from "@/app/actions/leave.actions";
import { fmt, ledgerBalance } from "@/lib/engines/leave.engine";
import { LEDGER_KIND_LABEL, type EmployeeBalancesRow, type LeavePageData, type LedgerLine } from "@/lib/types/leave";
import { cn } from "@/lib/utils";

type Line = LedgerLine & { createdByName: string | null };

/**
 * Balances for the leave year: employees × balance types (home, sick,
 * substitute, company types with a balance). Event leave (maternity,
 * mourning …) has no balance. The pane shows the ledger: every credit,
 * leave taken and adjustment, never edited or deleted.
 */
export function LeaveBalances({ data, onAdjust }: { data: LeavePageData; onAdjust: (employeeId: string) => void }) {
  const dateText = useDateText();
  const [branch, setBranch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<{ employeeId: string; lines: Line[] | null; error: string | null } | null>(null);
  const balanceTypes = useMemo(() => data.types.filter((t) => t.kind === "balance" && t.isActive), [data.types]);
  const rows = data.balances.filter((b) => !branch || b.employee.branchId === branch);
  const active = data.balances.find((b) => b.employee.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    getLeaveLedgerAction(activeId).then((r) => {
      if (live) setLedger({ employeeId: activeId, lines: r.success ? r.data : null, error: r.success ? null : r.error });
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
          width: 140,
          value: (b) => b.cells.find((c) => c.leaveTypeId === t.id)?.balance ?? null,
          cell: (b) => {
            const c = b.cells.find((x) => x.leaveTypeId === t.id);
            if (!c) return <span className="text-ink-faint">—</span>;
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <SelectField name="balance-branch" options={data.branches.map((b) => ({ value: b.id, label: b.name }))} value={branch} onChange={setBranch} placeholder="All branches" allowEmpty />
        </div>
        <span className="text-2xs text-ink-muted">
          Leave year {data.fiscalYear.label} ({dateText(data.fiscalYear.start)} – {dateText(data.fiscalYear.end)}). Maternity, maternity care and mourning are given per event and have no balance.
        </span>
      </div>
      <SplitView
        id="leave-balances"
        detailTitle={active ? `${active.employee.fullName} · ledger` : undefined}
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
                          <span className="text-ink">{fmt(ledgerBalance(own))}</span>
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
