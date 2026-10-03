"use client";

import Link from "next/link";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import type { EmployeeLeaveTabData } from "@/lib/types/employee";

type Balance = EmployeeLeaveTabData["balances"][number];
type Request = EmployeeLeaveTabData["requests"][number];

const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const BALANCE_COLUMNS: GridColumn<Balance>[] = [
  { id: "type", header: "Leave type", width: 200, value: (r) => r.leaveTypeName },
  { id: "allotted", header: "Allotted", type: "number", align: "right", value: (r) => r.allotted, cell: (r) => days(r.allotted) },
  { id: "carried", header: "Carried in", type: "number", align: "right", value: (r) => r.carriedForward, cell: (r) => days(r.carriedForward) },
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

/** Leave tab: this fiscal year's balances and the latest requests. */
export function EmployeeRecordLeave({ data }: { data: EmployeeLeaveTabData }) {
  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-2">
      <Panel level={3} title="Balances" meta={data.fiscalYearLabel ?? "No active fiscal year"} padded={false}>
        <DataGrid
          id="employee-leave-balances"
          label="Leave balances"
          columns={BALANCE_COLUMNS}
          rows={data.balances}
          getRowId={(r) => r.leaveTypeName}
          pageSize={0}
          empty={{ title: "No balances yet", description: "Balances are allotted when the employee is added or the fiscal year opens." }}
        />
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
      <p className="text-3xs text-ink-faint xl:col-span-2">
        To apply for or decide on leave, use <Link href="/timeAndLeave/leaves" className="underline">Leave applications</Link>.
      </p>
    </div>
  );
}
