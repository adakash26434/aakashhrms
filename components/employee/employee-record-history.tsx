"use client";

import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import type { EmployeeHistoryRow } from "@/lib/types/employee";

const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit" });

const COLUMNS: GridColumn<EmployeeHistoryRow>[] = [
  {
    id: "when",
    header: "When",
    type: "date",
    width: 150,
    value: (r) => new Date(r.at),
    cell: (r) => (
      <span className="tabular-nums">
        {new Date(r.at).toISOString().slice(0, 10)} <span className="text-ink-faint">{TIME.format(new Date(r.at))}</span>
      </span>
    ),
  },
  { id: "who", header: "By", width: 170, value: (r) => r.userName ?? "System" },
  {
    id: "what",
    header: "What happened",
    width: 420,
    value: (r) => r.summary,
    cell: (r) => <span className={r.result === "SUCCESS" ? "text-ink" : "font-medium text-danger"}>{r.summary}</span>,
  },
];

/** History tab: who changed what on this record. Values are never stored, only field names (S18). */
export function EmployeeRecordHistory({ rows }: { rows: EmployeeHistoryRow[] }) {
  return (
    <Panel level={3} title="Change history" meta="Latest 50" href="/admin/audit-log" hrefLabel="Audit log" padded={false}>
      <DataGrid
        id="employee-history"
        label="Change history"
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.id}
        pageSize={0}
        defaultSort={{ columnId: "when", direction: "desc" }}
        rowTone={(r) => (r.result === "SUCCESS" ? undefined : "danger")}
        empty={{ title: "No changes recorded yet", description: "Changes made from now on are listed here, with who made them." }}
      />
      <p className="border-t border-line px-4 py-2 text-3xs text-ink-faint">Only the names of changed fields are kept, never the old or new values.</p>
    </Panel>
  );
}
