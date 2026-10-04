"use client";

import { useMemo, useState } from "react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import type { SalaryStructureData, StructureRow } from "@/lib/types/salary-structure";
import { SalaryStructureDetail } from "./salary-structure-detail";

const STATUS_LABEL: Record<StructureRow["status"], { key: string; label: string }> = {
  current: { key: "active", label: "Current" },
  future: { key: "review", label: "Takes effect later" },
  pending: { key: "pending", label: "Change waiting" },
  none: { key: "draft", label: "No structure" },
};

/** Structures tab: everyone's current salary, filters, and the breakdown and history beside it. */
export function SalaryStructureRegister({
  data,
  selectedId,
  onSelect,
  onRevise,
}: {
  data: SalaryStructureData;
  selectedId: string | null;
  onSelect: (row: StructureRow | null) => void;
  onRevise?: (row: StructureRow) => void;
}) {
  const [filters, setFilters] = useState<FilterValues>({});
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (!filters.branch || r.branchId === filters.branch) &&
        (!filters.dept || r.departmentId === filters.dept) &&
        (!filters.level || r.levelCode === filters.level) &&
        (!filters.status || r.status === filters.status) &&
        (!q || r.fullName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q))
    );
  }, [data.rows, filters, search]);
  const active = data.rows.find((r) => r.employeeId === selectedId) ?? null;

  const columns = useMemo<GridColumn<StructureRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", sticky: true, width: 92, value: (r) => r.employeeCode },
      { id: "name", header: "Employee", sticky: true, width: 180, value: (r) => r.fullName, cell: (r) => <span className="font-medium text-ink">{r.fullName}</span> },
      { id: "department", header: "Department", width: 150, value: (r) => r.departmentName },
      { id: "designation", header: "Designation", width: 160, value: (r) => r.designationName, defaultHidden: true },
      { id: "level", header: "Level", type: "code", width: 96, value: (r) => r.levelCode },
      { id: "basic", header: "Basic", type: "amount", width: 124, value: (r) => r.current?.lines.basic ?? null, total: "sum" },
      { id: "grade", header: "Grade", type: "amount", width: 112, value: (r) => r.current?.lines.gradeAmount ?? null, total: "sum" },
      { id: "allowances", header: "Allowances", type: "amount", width: 136, value: (r) => r.current?.totals.allowances ?? null, total: "sum" },
      { id: "gross", header: "Gross", type: "amount", width: 130, value: (r) => r.current?.totals.gross ?? null, total: "sum" },
      { id: "deductions", header: "Deductions", type: "amount", width: 136, value: (r) => (r.current ? r.current.totals.deductions + r.current.totals.retirementEmployee : null), total: "sum" },
      { id: "net", header: "Net before tax", type: "amount", width: 150, value: (r) => r.current?.totals.netBeforeTax ?? null, total: "sum" },
      { id: "scheme", header: "Scheme", width: 92, value: (r) => (r.current ? r.current.lines.scheme.toUpperCase().replace("NONE", "—") : "") },
      { id: "effective", header: "Effective from", type: "date", value: (r) => r.current?.effectiveFrom ?? null },
      {
        id: "status",
        header: "Status",
        width: 140,
        value: (r) => STATUS_LABEL[r.status].label,
        cell: (r) => <StatusChip status={STATUS_LABEL[r.status].key} label={STATUS_LABEL[r.status].label} />,
      },
    ],
    []
  );

  return (
    <div className="p-3">
      <FilterStrip
        id="salary-structures"
        className="mb-3"
        values={filters}
        onChange={setFilters}
        search={{ value: search, onChange: setSearch, placeholder: "Name or code" }}
        filters={[
          { id: "branch", label: "Branch", allLabel: "All branches", options: data.branches.map((b) => ({ value: b.id, label: b.name })) },
          { id: "dept", label: "Department", allLabel: "All departments", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          { id: "level", label: "Level", allLabel: "All levels", options: data.levels.map((l) => ({ value: l.code, label: `${l.code} · ${l.name}` })) },
          {
            id: "status",
            label: "Status",
            allLabel: "All statuses",
            options: (Object.keys(STATUS_LABEL) as StructureRow["status"][]).map((s) => ({ value: s, label: STATUS_LABEL[s].label })),
          },
        ]}
      />
      <SplitView
        id="salary-structures"
        detailTitle={active ? `${active.fullName} · ${active.employeeCode}` : undefined}
        onCloseDetail={() => onSelect(null)}
        detail={active ? <SalaryStructureDetail row={active} data={data} onRevise={onRevise} /> : null}
        master={
          <DataGrid
            id="salary-structures"
            label="Salary structures"
            columns={columns}
            rows={visible}
            getRowId={(r) => r.employeeId}
            activeRowId={selectedId}
            onActiveRowChange={onSelect}
            onOpen={(r) => (onRevise && r.status !== "pending" ? onRevise(r) : onSelect(r))}
            rowTone={(r) => (r.status === "none" ? "warning" : r.status === "pending" ? "info" : undefined)}
            defaultSort={{ columnId: "name", direction: "asc" }}
            pageSize={100}
            exportModule={data.permissions.export ? "SALARY_MAPPING" : undefined}
            exportName="Salary structures"
            maxHeight="calc(100vh - 320px)"
            empty={{ title: "No employees match", description: "Clear the search or filters to see everyone." }}
          />
        }
      />
    </div>
  );
}
