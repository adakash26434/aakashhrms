"use client";

import { useMemo, useState } from "react";
import { ListPlus, Plus } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { FilterStrip, type FilterValues } from "@/components/kit/filter-strip";
import { Notice } from "@/components/kit/notice";
import { WindowButton } from "@/components/kit/window";
import { SplitView } from "@/components/kit/split-view";
import { StatusChip } from "@/components/kit/status-chip";
import { needsStructure } from "@/lib/engines/salary-structure.engine";
import type { SalaryStructureData, StructureRow } from "@/lib/types/salary-structure";
import { SalaryStructureDetail } from "./salary-structure-detail";
import { batchStatusText } from "./salary-structure-approval";

const STATUS_LABEL: Record<StructureRow["status"], { key: string; label: string }> = {
  current: { key: "active", label: "Current" },
  future: { key: "review", label: "Takes effect later" },
  pending: { key: "pending", label: "Change waiting" },
  setup: { key: "onHold", label: "Basic + grade only" },
  none: { key: "draft", label: "No structure" },
};

/** Structures tab: everyone's current salary, filters, and the breakdown and history beside it. */
export function SalaryStructureRegister({
  data,
  selectedId,
  onSelect,
  onRevise,
  onAdd,
  onBulkAdd,
}: {
  data: SalaryStructureData;
  selectedId: string | null;
  onSelect: (row: StructureRow | null) => void;
  onRevise?: (row: StructureRow) => void;
  /** Add new: choose one employee and add their structure. */
  onAdd?: () => void;
  /** Bulk add: everyone who needs a structure, in the bulk table. */
  onBulkAdd?: () => void;
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
  const toAdd = data.rows.filter(needsStructure);
  const basicOnly = toAdd.filter((r) => r.status === "setup").length;

  const columns = useMemo<GridColumn<StructureRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", sticky: true, width: 92, value: (r) => r.employeeCode },
      { id: "name", header: "Employee", sticky: true, width: 180, value: (r) => r.fullName, cell: (r) => <span className="font-medium text-ink">{r.fullName}</span> },
      { id: "department", header: "Department", width: 150, value: (r) => r.departmentName },
      { id: "designation", header: "Designation", width: 160, value: (r) => r.designationName, defaultHidden: true },
      { id: "level", header: "Level", type: "code", width: 96, value: (r) => r.levelCode },
      // Salary sheet: earnings, then deductions, then net payable (the payslip's terms).
      { id: "basic", header: "Basic", type: "amount", width: 116, value: (r) => r.current?.totals.basic ?? null, total: "sum" },
      { id: "grade", header: "Grade", type: "amount", width: 104, value: (r) => r.current?.totals.grade ?? null, total: "sum" },
      { id: "allowances", header: "Allowances", type: "amount", width: 136, value: (r) => r.current?.totals.allowances ?? null, total: "sum" },
      { id: "totalSalary", header: "Total salary", type: "amount", width: 140, value: (r) => r.current?.totals.totalSalary ?? null, total: "sum" },
      { id: "ssfEmployer", header: "SSF employer 20%", type: "amount", width: 164, value: (r) => r.current?.totals.employerInEarnings ?? null, total: "sum", defaultHidden: true },
      { id: "grossEarnings", header: "Gross earnings", type: "amount", width: 156, value: (r) => r.current?.totals.grossEarnings ?? null, total: "sum" },
      { id: "retirement", header: "SSF / PF deduction", type: "amount", width: 176, value: (r) => r.current?.totals.retirementDeduction ?? null, total: "sum" },
      { id: "otherDeductions", header: "Other deductions", type: "amount", width: 168, value: (r) => r.current?.totals.otherDeductions ?? null, total: "sum" },
      { id: "incomeTax", header: "Income tax (est.)", type: "amount", width: 164, value: (r) => r.current?.totals.incomeTax ?? null, total: "sum" },
      { id: "totalDeductions", header: "Total deductions", type: "amount", width: 164, value: (r) => r.current?.totals.totalDeductions ?? null, total: "sum" },
      { id: "netPayable", header: "Net payable (est.)", type: "amount", width: 176, value: (r) => r.current?.totals.netPayable ?? null, total: "sum" },
      { id: "costToCompany", header: "Cost to company", type: "amount", width: 160, value: (r) => r.current?.totals.costToCompany ?? null, total: "sum", defaultHidden: true },
      { id: "scheme", header: "Scheme", width: 92, value: (r) => (r.current ? r.current.lines.scheme.toUpperCase().replace("NONE", "—") : "") },
      { id: "effective", header: "Effective from", type: "date", value: (r) => r.current?.effectiveFrom ?? null },
      {
        id: "status",
        header: "Status",
        width: 140,
        value: (r) => STATUS_LABEL[r.status].label,
        cell: (r) => {
          // A waiting change says where it is: "Level 1 of 2 · Hari Thapa" in the tooltip.
          const batch = r.status === "pending" ? data.batches.find((b) => b.id === r.pendingBatchId) : null;
          return (
            <span title={batch ? batchStatusText(batch, data) : undefined}>
              <StatusChip status={STATUS_LABEL[r.status].key} label={batch && batch.flow.type === "multi_level" ? `Waiting · L${batch.currentLevel}` : STATUS_LABEL[r.status].label} />
            </span>
          );
        },
      },
    ],
    [data]
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
      {toAdd.length > 0 && (
        <Notice
          tone="warning"
          className="mb-3"
          title={`${toAdd.length} employee${toAdd.length === 1 ? " needs" : "s need"} a salary structure`}
          action={
            onAdd || onBulkAdd ? (
              <>
                {onAdd && (
                  <WindowButton onClick={onAdd}>
                    <Plus className="h-3.5 w-3.5" /> Add new
                  </WindowButton>
                )}
                {onBulkAdd && (
                  <WindowButton variant="primary" onClick={onBulkAdd}>
                    <ListPlus className="h-3.5 w-3.5" /> Bulk add
                  </WindowButton>
                )}
              </>
            ) : undefined
          }
        >
          {basicOnly === toAdd.length
            ? "They have only basic + grade from the employee form."
            : basicOnly
              ? `${basicOnly} with only basic + grade from the employee form, ${toAdd.length - basicOnly} with no salary at all.`
              : "They have no salary yet, so payroll leaves them out."}{" "}
          {basicOnly
            ? "Add the retirement scheme, allowances and deductions (a template fills them), or confirm that none apply, so payroll pays them in full."
            : "Add their basic, grade, retirement scheme, allowances and deductions."}
        </Notice>
      )}
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
            rowTone={(r) => (r.status === "none" || r.status === "setup" ? "warning" : r.status === "pending" ? "info" : undefined)}
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
