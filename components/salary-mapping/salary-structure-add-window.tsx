"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { inputClass } from "@/components/kit/property-form";
import { StatusChip } from "@/components/kit/status-chip";
import { Window, WindowButton, WindowCancel } from "@/components/kit/window";
import { needsStructure } from "@/lib/engines/salary-structure.engine";
import type { SalaryStructureData, StructureRow } from "@/lib/types/salary-structure";
import { cn } from "@/lib/utils";

/**
 * Add new (4.4b): pick the employee whose salary structure to add, from those
 * with none yet or with only basic + grade from the employee form. Continue
 * opens the set-up window for that person.
 */
export function SalaryStructureAddWindow({
  data,
  initialId,
  onClose,
  onChoose,
}: {
  data: SalaryStructureData;
  initialId: string | null;
  onClose: () => void;
  onChoose: (row: StructureRow) => void;
}) {
  const candidates = useMemo(() => data.rows.filter(needsStructure), [data.rows]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(() => (candidates.some((r) => r.employeeId === initialId) ? initialId : candidates.length === 1 ? candidates[0].employeeId : null));
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? candidates.filter((r) => r.fullName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)) : candidates;
  }, [candidates, search]);
  const chosen = candidates.find((r) => r.employeeId === picked) ?? null;

  const columns = useMemo<GridColumn<StructureRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", width: 92, value: (r) => r.employeeCode },
      { id: "name", header: "Employee", width: 180, value: (r) => r.fullName, cell: (r) => <span className="font-medium text-ink">{r.fullName}</span> },
      { id: "department", header: "Department", width: 140, value: (r) => r.departmentName, defaultHidden: true },
      { id: "designation", header: "Designation", width: 170, value: (r) => r.designationName },
      { id: "level", header: "Level", type: "code", width: 72, value: (r) => r.levelCode },
      { id: "joined", header: "Joined", type: "date", width: 112, value: (r) => r.joiningDate || null },
      { id: "base", header: "Basic + grade", type: "amount", width: 136, value: (r) => (r.current ? r.current.totals.basic + r.current.totals.grade : null) },
      {
        id: "status",
        header: "Has now",
        width: 150,
        value: (r) => (r.status === "setup" ? "Basic + grade only" : "No structure"),
        cell: (r) => <StatusChip status={r.status === "setup" ? "onHold" : "draft"} label={r.status === "setup" ? "Basic + grade only" : "No structure"} />,
      },
    ],
    []
  );

  return (
    <Window
      open
      onClose={onClose}
      size="xl"
      title="Add salary structure"
      description="Choose the employee. Next you add the retirement scheme, allowances and deductions (a template can fill them) and see the net payable."
      footer={
        <>
          <span className="mr-auto text-2xs text-ink-muted">
            {chosen ? `${chosen.fullName} · ${chosen.employeeCode}` : "Select an employee (double-click to continue)."}
          </span>
          <WindowCancel />
          <WindowButton variant="primary" disabled={!chosen} onClick={() => chosen && onChoose(chosen)}>
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </WindowButton>
        </>
      }
    >
      <label className="relative mb-3 block max-w-xs">
        <span className="sr-only">Search employees</span>
        <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" className={cn(inputClass, "pl-7")} />
      </label>
      <DataGrid
        id="salary-structure-add"
        label="Employees without a salary structure"
        columns={columns}
        rows={visible}
        getRowId={(r) => r.employeeId}
        activeRowId={picked}
        onActiveRowChange={(r) => setPicked(r.employeeId)}
        onOpen={onChoose}
        rowTone={(r) => (r.status === "none" ? "warning" : undefined)}
        defaultSort={{ columnId: "name", direction: "asc" }}
        pageSize={50}
        maxHeight="50vh"
        empty={
          candidates.length
            ? { title: "No employees match", description: "Clear the search to see everyone." }
            : { title: "Everyone has a salary structure", description: "Use Revise salary to change one." }
        }
      />
    </Window>
  );
}
