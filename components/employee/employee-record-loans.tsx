"use client";

import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { Panel } from "@/components/kit/panel";
import type { EmployeeLoanRow } from "@/lib/types/employee";

const COLUMNS: GridColumn<EmployeeLoanRow>[] = [
  { id: "type", header: "Loan type", width: 180, value: (r) => r.loanTypeName },
  { id: "given", header: "Given", type: "date", value: (r) => r.givenDate },
  { id: "amount", header: "Amount", type: "amount", value: (r) => r.amount, total: "sum" },
  { id: "installment", header: "Instalment", type: "amount", value: (r) => r.installment },
  { id: "count", header: "Instalments", type: "number", align: "right", value: (r) => r.installments },
  { id: "returned", header: "Repaid", type: "amount", value: (r) => r.returned, total: "sum" },
  { id: "remaining", header: "Outstanding", type: "amount", value: (r) => r.remaining, total: "sum" },
  { id: "status", header: "Status", type: "status", value: (r) => r.status },
];

/** Loans tab: every loan with what is still outstanding. */
export function EmployeeRecordLoans({ rows }: { rows: EmployeeLoanRow[] }) {
  return (
    <Panel level={3} title="Loans" href="/loans" hrefLabel="Loans register" padded={false}>
      <DataGrid
        id="employee-loans"
        label="Loans"
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.id}
        pageSize={0}
        defaultSort={{ columnId: "given", direction: "desc" }}
        rowTone={(r) => (r.status === "ACTIVE" && r.remaining > 0 ? "info" : undefined)}
        empty={{ title: "No loans", description: "Loans given to this employee appear here." }}
      />
    </Panel>
  );
}
