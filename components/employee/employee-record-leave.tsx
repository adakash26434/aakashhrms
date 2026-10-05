"use client";

import Link from "next/link";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import { HomeLeaveYearView } from "@/components/leave/home-leave-year";
import type { EmployeeLeaveTabData } from "@/lib/types/employee";

type Balance = EmployeeLeaveTabData["balances"][number];
type Request = EmployeeLeaveTabData["requests"][number];

const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const BALANCE_COLUMNS: GridColumn<Balance>[] = [
  { id: "type", header: "Leave type", width: 170, value: (r) => r.leaveTypeName },
  { id: "allotted", header: "Credited", type: "number", align: "right", value: (r) => r.allotted, cell: (r) => days(r.allotted), defaultHidden: true },
  { id: "carried", header: "Carried in", type: "number", align: "right", value: (r) => r.carriedForward, cell: (r) => days(r.carriedForward), defaultHidden: true },
  { id: "taken", header: "Taken", type: "number", align: "right", value: (r) => r.taken, cell: (r) => days(r.taken) },
  {
    id: "balance",
    header: "Balance",
    type: "number",
    align: "right",
    value: (r) => r.balance,
    cell: (r) => <span className={r.balance < 0 ? "font-semibold text-danger" : "font-semibold text-ink"}>{days(r.balance)}</span>,
  },
];

const REQUEST_COLUMNS: GridColumn<Request>[] = [
  { id: "type", header: "Leave type", width: 170, value: (r) => r.leaveTypeName },
  { id: "from", header: "From", type: "date", value: (r) => r.from },
  { id: "to", header: "To", type: "date", value: (r) => r.to },
  { id: "days", header: "Days", type: "number", align: "right", value: (r) => r.days, cell: (r) => days(r.days) },
  { id: "applied", header: "Applied", type: "date", value: (r) => r.appliedDate },
  { id: "status", header: "Status", type: "status", value: (r) => r.status },
];

/** Leave tab: the leave year's balances (from the leave ledger), what leaving would pay, and the latest requests. */
export function EmployeeRecordLeave({ data }: { data: EmployeeLeaveTabData }) {
  // Home leave earned in months whose attendance isn't closed yet (not in the balance until then).
  const pendingHome = (data.home?.months ?? []).filter((m) => m.status === "waiting" || m.status === "open").reduce((n, m) => n + (m.earned ?? 0), 0);
  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-2">
      <Panel level={3} title="Balances" meta={data.fiscalYearLabel ? `Leave year ${data.fiscalYearLabel}` : "No leave year"} padded={false}>
        <DataGrid
          id="employee-leave-balances"
          label="Leave balances"
          columns={BALANCE_COLUMNS}
          rows={data.balances}
          getRowId={(r) => r.leaveTypeName}
          pageSize={0}
          empty={{ title: "No balances yet", description: "Sick leave is credited when the employee joins or the leave year opens; home leave is earned as attendance months close." }}
        />
        {data.payable.length > 0 && (
          <div className="border-t border-line px-3 py-2.5 text-xs">
            <p className="font-medium text-ink">
              Payable on leaving:{" "}
              {data.payable.map((p, i) => (
                <span key={p.leaveTypeName}>
                  {i > 0 && ", "}
                  {p.leaveTypeName} <span className="font-semibold tabular-nums">{days(p.days)}</span> day{p.days === 1 ? "" : "s"}
                </span>
              ))}
            </p>
            {pendingHome > 0 && (
              <p className="mt-0.5 text-2xs text-ink">
                Plus about {days(Math.round(pendingHome * 10) / 10)} days of home leave earned in months not closed yet ({data.home!.months.filter((m) => m.status === "waiting" || m.status === "open").map((m) => m.label).join(", ")}); it is added when they are closed.
              </p>
            )}
            <p className="mt-0.5 text-2xs text-ink-muted">Accumulated home and sick leave is paid at the last basic salary when someone leaves (Labour Act §49, up to {data.payable.map((p) => (p.cap === null ? null : `${p.cap} ${p.leaveTypeName.replace(/ Leave$/i, "").toLowerCase()}`)).filter(Boolean).join(" / ") || "the limit"}). Leave salary pays it.</p>
          </div>
        )}
      </Panel>
      <Panel level={3} title="Recent requests" meta="Latest 10" href="/timeAndLeave/leaves" hrefLabel="All leave" padded={false}>
        <DataGrid
          id="employee-leave-requests"
          label="Recent leave requests"
          columns={REQUEST_COLUMNS}
          rows={data.requests}
          getRowId={(r) => r.id}
          pageSize={0}
          defaultSort={{ columnId: "from", direction: "desc" }}
          empty={{ title: "No leave requests", description: "Requests appear here once they are applied for." }}
        />
      </Panel>
      {data.home && <HomeLeaveYearView year={data.home} className="xl:col-span-2" />}
      <p className="text-3xs text-ink-faint xl:col-span-2">
        To apply for or decide on leave, use <Link href="/timeAndLeave/leaves" className="underline">Leaves</Link>.
      </p>
    </div>
  );
}
