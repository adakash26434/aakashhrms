"use client";

import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { RECORD_GAP_SHORT } from "@/lib/engines/employee.engine";
import type { EmployeeListRow } from "@/lib/types/employee";
import type { ReactNode } from "react";

const COLUMNS: GridColumn<EmployeeListRow>[] = [
  { id: "code", header: "Code", type: "code", sticky: true, width: 104, value: (r) => r.employeeCode },
  {
    id: "name",
    header: "Employee",
    sticky: true,
    width: 220,
    value: (r) => r.fullName,
    cell: (r) => <span className="font-medium text-ink">{r.fullName}</span>,
  },
  { id: "attendance", header: "Att. code", type: "code", width: 96, value: (r) => r.attendanceCode },
  { id: "department", header: "Department", width: 160, value: (r) => r.departmentName },
  { id: "designation", header: "Designation", width: 170, value: (r) => r.designationName },
  { id: "branch", header: "Branch", width: 140, value: (r) => r.branchName },
  { id: "category", header: "Category", width: 110, value: (r) => r.category },
  { id: "joined", header: "Joined", type: "date", value: (r) => r.joiningDate || null },
  { id: "mobile", header: "Mobile", type: "code", width: 130, defaultHidden: true, value: (r) => r.mobileNo },
  { id: "email", header: "Company email", width: 200, defaultHidden: true, value: (r) => r.companyEmail },
  {
    id: "records",
    header: "Records",
    width: 150,
    value: (r) => r.gaps.map((g) => RECORD_GAP_SHORT[g]).join(", "),
    cell: (r) =>
      r.gaps.length === 0 ? (
        <span className="text-ink-faint">Complete</span>
      ) : (
        <span className="font-medium text-warning">Missing {r.gaps.map((g) => RECORD_GAP_SHORT[g]).join(", ")}</span>
      ),
  },
  { id: "status", header: "Status", type: "status", width: 104, value: (r) => r.status },
];

/** The employee DataGrid: columns, tones and keyboard wiring. */
export function EmployeeRegister({
  rows,
  activeId,
  onActive,
  onOpen,
  selected,
  onSelectedChange,
  canExport,
  empty,
}: {
  rows: EmployeeListRow[];
  activeId: string | null;
  onActive: (row: EmployeeListRow) => void;
  onOpen: (row: EmployeeListRow) => void;
  selected: ReadonlySet<string>;
  onSelectedChange: (next: Set<string>) => void;
  canExport: boolean;
  empty: { title: string; description?: string; action?: ReactNode };
}) {
  return (
    <DataGrid
      id="employees"
      label="Employees"
      columns={COLUMNS}
      rows={rows}
      getRowId={(r) => r.id}
      selectable
      selected={selected}
      onSelectedChange={onSelectedChange}
      activeRowId={activeId}
      onActiveRowChange={onActive}
      onOpen={onOpen}
      // Active employees who cannot be paid or reported correctly get an amber edge.
      rowTone={(r) => (r.status === "Active" && r.gaps.length > 0 ? "warning" : undefined)}
      defaultSort={{ columnId: "name", direction: "asc" }}
      pageSize={50}
      exportModule={canExport ? "EMPLOYEES" : undefined}
      exportName="Employees"
      empty={empty}
      maxHeight="calc(100vh - 300px)"
    />
  );
}
