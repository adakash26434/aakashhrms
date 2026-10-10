"use client";

import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Confirm } from "@/components/kit/confirm";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { useDateText } from "@/components/kit/date-cell";
import { StatusChip } from "@/components/kit/status-chip";
import { WindowButton } from "@/components/kit/window";
import { closeAttendanceMonthAction, reopenAttendanceMonthAction } from "@/app/actions/attendance.actions";
import type { AttendancePageData, BranchMonth } from "@/lib/types/attendance";
import { ReasonWindow } from "./attendance-windows";

/**
 * Month close (per branch): every day is worked out, stored and locked, and
 * each person's month summary is ready for payroll. Blocked while
 * adjustments or overtime days wait for a decision; reopening needs a reason and is refused once that
 * month's payroll is approved or locked.
 */
export function AttendanceClose({ data, onDone, onOpenOvertime }: { data: AttendancePageData; onDone: (text: string) => void; onOpenOvertime: () => void }) {
  const dateText = useDateText();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState<BranchMonth | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const open = data.months.filter((m) => m.status === "open");
  const chosen = data.months.filter((m) => selected.has(m.branchId) && m.status === "open");
  const blocked = chosen.filter((m) => m.pendingAdjustments > 0);
  const otBlocked = chosen.filter((m) => m.waitingOvertime > 0);
  const monthEnded = data.period.end < data.today;

  const columns = useMemo<GridColumn<BranchMonth>[]>(
    () => [
      { id: "branch", header: "Branch", width: 180, value: (m) => m.branchName, cell: (m) => <span className="font-medium text-ink">{m.branchName}</span> },
      { id: "status", header: "Status", width: 100, value: (m) => m.status, cell: (m) => <StatusChip status={m.status === "closed" ? "locked" : "draft"} label={m.status === "closed" ? "Closed" : "Open"} /> },
      { id: "employees", header: "Employees", type: "number", width: 124, value: (m) => m.employees },
      { id: "unpaid", header: "Unpaid days", type: "number", width: 130, value: (m) => m.unpaidDays },
      { id: "ot", header: "OT hours", type: "number", width: 110, value: (m) => m.otHours },
      { id: "missing", header: "Missing punches", type: "number", width: 160, value: (m) => m.missingPunchDays, cell: (m) => (m.missingPunchDays ? <span className="font-medium text-warning">{m.missingPunchDays}</span> : <span className="text-ink-faint">0</span>) },
      { id: "pending", header: "Waiting adjustments", type: "number", width: 190, value: (m) => m.pendingAdjustments, cell: (m) => (m.pendingAdjustments ? <span className="font-medium text-danger">{m.pendingAdjustments}</span> : <span className="text-ink-faint">0</span>) },
      { id: "overtime", header: "Waiting overtime", type: "number", width: 170, value: (m) => m.waitingOvertime, cell: (m) => (m.waitingOvertime && m.status === "open" ? <span className="font-medium text-danger">{m.waitingOvertime}</span> : <span className="text-ink-faint">0</span>) },
      { id: "closed", header: "Closed by", width: 200, value: (m) => m.closedBy ?? "", cell: (m) => (m.closedBy ? <span className="text-2xs text-ink-muted">{m.closedBy} · {m.closedAt ? dateText(m.closedAt) : ""}</span> : m.reopenReason ? <span className="text-2xs text-ink-muted">Reopened: “{m.reopenReason}”</span> : <span className="text-ink-faint">—</span>) },
      {
        id: "actions",
        header: "Actions",
        width: 110,
        sortable: false,
        hideable: false,
        value: () => "",
        cell: (m) =>
          m.status === "closed" && data.permissions.lock ? (
            <button
              type="button"
              tabIndex={-1}
              disabled={m.payrollFinalised}
              title={m.payrollFinalised ? "Payroll for this month is approved or locked" : "Reopen this month for the branch"}
              className="cursor-pointer text-2xs font-medium text-brand-strong hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
              onClick={(e) => {
                e.stopPropagation();
                setReopening(m);
              }}
            >
              Reopen
            </button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  const close = async () => {
    const result = await closeAttendanceMonthAction({ year: data.period.year, month: data.period.month, branchIds: chosen.map((m) => m.branchId) });
    setConfirming(false);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    setSelected(new Set());
    const home = result.data.homeLeavePeople ? ` Home leave added: ${result.data.homeLeaveDays} days for ${result.data.homeLeavePeople} employee${result.data.homeLeavePeople === 1 ? "" : "s"}.` : "";
    onDone(`${data.period.label} closed for ${result.data.branches} branch${result.data.branches === 1 ? "" : "es"} (${result.data.employees} employees). Payroll now reads these results.${home}`);
  };

  return (
    <div className="p-3">
      <div className="mb-3 rounded-md border border-line bg-surface-panel px-3 py-2.5 text-xs text-ink-muted">
        <p>
          <span className="font-medium text-ink">Closing {data.period.label}</span> works out every day for the branch, stores it, locks it for payroll (overtime as decided on the Overtime tab), and adds the home leave earned in it (1 day for every 20 paid days; reopening takes it back). Days can then only change after reopening, which is no longer possible once that month&apos;s payroll is approved or locked.
        </p>
        {!monthEnded && <p className="mt-1 text-warning">This month has not ended yet: it can be closed after its last day.</p>}
      </div>
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
          {message}
        </p>
      )}
      {data.permissions.lock && open.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-muted">{chosen.length ? `${chosen.length} branch${chosen.length === 1 ? "" : "es"} selected` : "Select open branches to close"}</span>
          <WindowButton variant="primary" disabled={!chosen.length || !!blocked.length || !!otBlocked.length || !monthEnded} onClick={() => setConfirming(true)}>
            <LockKeyhole className="h-3.5 w-3.5" /> Close month
          </WindowButton>
          {blocked.length > 0 && <span className="text-danger">Decide the waiting adjustments first ({blocked.map((m) => m.branchName).join(", ")}).</span>}
          {otBlocked.length > 0 && (
            <span className="text-danger">
              Decide the waiting overtime first ({otBlocked.map((m) => m.branchName).join(", ")}).{" "}
              <button type="button" className="cursor-pointer font-medium text-brand-strong hover:underline" onClick={onOpenOvertime}>
                Open the Overtime tab
              </button>
            </span>
          )}
        </div>
      )}
      <DataGrid
        id="attendance-close"
        label={`Month close, ${data.period.label}`}
        columns={columns}
        rows={data.months}
        getRowId={(m) => m.branchId}
        selectable={data.permissions.lock}
        selected={selected}
        onSelectedChange={setSelected}
        rowTone={(m) => (m.status === "closed" ? undefined : m.pendingAdjustments || m.waitingOvertime ? "danger" : m.missingPunchDays ? "warning" : undefined)}
        empty={{ title: "No branches this month", description: "Nobody in your scope worked in this month." }}
      />
      <Confirm
        open={confirming}
        title={`Close ${data.period.label}?`}
        message={`${chosen.map((m) => m.branchName).join(", ")}: ${chosen.reduce((n, m) => n + m.employees, 0)} employees, ${chosen.reduce((n, m) => n + m.unpaidDays, 0)} unpaid days, ${chosen.reduce((n, m) => n + m.missingPunchDays, 0)} missing punches (counted as absent).`}
        confirmLabel="Close month"
        requireText="CLOSE"
        onConfirm={close}
        onCancel={() => setConfirming(false)}
      />
      {reopening && (
        <ReasonWindow
          title={`Reopen ${data.period.label} for ${reopening.branchName}?`}
          description="Its days can be changed again; payroll works them out afresh until the month is closed again."
          action="Reopen"
          onClose={() => setReopening(null)}
          onConfirm={async (reason) => {
            const result = await reopenAttendanceMonthAction({ year: data.period.year, month: data.period.month, branchId: reopening.branchId, reason });
            if (!result.success) return result.error;
            setReopening(null);
            onDone(`${data.period.label} reopened for ${reopening.branchName}.`);
            return null;
          }}
        />
      )}
    </div>
  );
}
