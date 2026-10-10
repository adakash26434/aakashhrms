"use client";

import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import type { EmployeePayslipRow } from "@/lib/types/employee";

const COLUMNS: GridColumn<EmployeePayslipRow>[] = [
  { id: "period", header: "Month", width: 150, value: (r) => r.year * 100 + r.month, cell: (r) => r.periodLabel },
  { id: "gross", header: "Gross", type: "amount", value: (r) => r.gross, total: "sum" },
  { id: "tds", header: "TDS", type: "amount", value: (r) => r.tds, total: "sum" },
  { id: "ssf", header: "SSF (31%)", type: "amount", value: (r) => r.ssf, total: "sum" },
  { id: "deductions", header: "Deductions", type: "amount", value: (r) => r.deductions, total: "sum" },
  { id: "net", header: "Net pay", type: "amount", value: (r) => r.net, total: "sum" },
  { id: "status", header: "Run status", type: "status", value: (r) => r.status },
];

/** Payslips tab: the last 12 pay months, with totals; "Print payslips" opens this person's in Reports. */
export function EmployeeRecordPayslips({ rows, employeeId }: { rows: EmployeePayslipRow[]; employeeId: string }) {
  return (
    <Panel level={3} title="Payslips" meta="Last 12 months" href={`/reports/payslip?employee=${encodeURIComponent(employeeId)}`} hrefLabel="Print payslips" padded={false}>
      <DataGrid
        id="employee-payslips"
        label="Payslips"
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.id}
        pageSize={0}
        defaultSort={{ columnId: "period", direction: "desc" }}
        empty={{ title: "No payslips yet", description: "Payslips appear after this employee is included in a payroll run." }}
      />
    </Panel>
  );
}
