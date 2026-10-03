"use client";

import { useMemo, type ReactNode, type SyntheticEvent } from "react";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { DataGrid, type GridColumn } from "@/components/kit/data-grid";
import { RECORD_GAP_SHORT } from "@/lib/engines/employee.engine";
import type { EmployeeListRow } from "@/lib/types/employee";
import { cn } from "@/lib/utils";
import { formatPhoneNumber } from "@/lib/utils/phone";

/** Clicks on row actions must not also select or open the row. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

function ActionLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      tabIndex={-1}
      title={label}
      aria-label={label}
      onClick={stop}
      onDoubleClick={stop}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

/** Active / Inactive switch in a row: opens the status window (never toggles silently). */
function StatusSwitch({ row, onToggle }: { row: EmployeeListRow; onToggle: (row: EmployeeListRow) => void }) {
  const active = row.status === "Active";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      tabIndex={-1}
      title={active ? "Make inactive" : "Make active again"}
      aria-label={`${row.fullName}: ${active ? "active, click to make inactive" : "inactive, click to make active"}`}
      onClick={(e) => {
        stop(e);
        onToggle(row);
      }}
      onDoubleClick={stop}
      className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors", active ? "bg-success" : "bg-line-strong")}
    >
      <span className={cn("absolute h-3 w-3 rounded-full bg-white shadow transition-transform", active ? "translate-x-3.5" : "translate-x-0.5")} />
    </button>
  );
}

/** The employee DataGrid: columns, row actions, tones and keyboard wiring. */
export function EmployeeRegister({
  rows,
  activeId,
  onActive,
  onOpen,
  onToggleStatus,
  selected,
  onSelectedChange,
  canEdit,
  canExport,
  empty,
}: {
  rows: EmployeeListRow[];
  activeId: string | null;
  onActive: (row: EmployeeListRow) => void;
  onOpen: (row: EmployeeListRow) => void;
  onToggleStatus: (row: EmployeeListRow) => void;
  selected: ReadonlySet<string>;
  onSelectedChange: (next: Set<string>) => void;
  canEdit: boolean;
  canExport: boolean;
  empty: { title: string; description?: string; action?: ReactNode };
}) {
  const columns = useMemo<GridColumn<EmployeeListRow>[]>(
    () => [
      { id: "code", header: "Code", type: "code", sticky: true, width: 96, value: (r) => r.employeeCode },
      {
        id: "name",
        header: "Employee",
        sticky: true,
        width: 190,
        value: (r) => r.fullName,
        cell: (r) => <span className={cn("font-medium", r.status === "Active" ? "text-ink" : "text-ink-muted")}>{r.fullName}</span>,
      },
      { id: "attendance", header: "Att. code", type: "code", width: 88, value: (r) => r.attendanceCode },
      { id: "department", header: "Department", width: 150, value: (r) => r.departmentName },
      { id: "designation", header: "Designation", width: 160, value: (r) => r.designationName },
      { id: "branch", header: "Branch", width: 120, value: (r) => r.branchName },
      { id: "category", header: "Category", width: 104, value: (r) => r.category, defaultHidden: true },
      { id: "joined", header: "Joined", type: "date", value: (r) => r.joiningDate || null },
      { id: "mobile", header: "Mobile", type: "code", width: 130, defaultHidden: true, value: (r) => (r.mobileNo ? formatPhoneNumber(r.mobileNo) : "") },
      { id: "email", header: "Company email", width: 200, defaultHidden: true, value: (r) => r.companyEmail },
      {
        id: "records",
        header: "Records",
        width: 120,
        value: (r) => r.gaps.map((g) => RECORD_GAP_SHORT[g]).join(", "),
        cell: (r) =>
          r.gaps.length === 0 ? (
            <span className="text-ink-faint">Complete</span>
          ) : (
            <span className="font-medium text-warning">Missing {r.gaps.map((g) => RECORD_GAP_SHORT[g]).join(", ")}</span>
          ),
      },
      { id: "status", header: "Status", type: "status", width: 90, value: (r) => r.status },
      {
        id: "actions",
        header: "Actions",
        width: 100,
        sortable: false,
        hideable: false,
        value: () => "",
        cell: (r) => (
          <span className="flex items-center gap-1">
            <ActionLink href={`/workforce/employees/${r.id}`} label={`View ${r.fullName}`}>
              <Eye aria-hidden className="h-3.5 w-3.5" />
            </ActionLink>
            {canEdit && (
              <>
                <ActionLink href={`/workforce/employees/${r.id}/edit`} label={`Edit ${r.fullName}`}>
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                </ActionLink>
                <span className="ml-1">
                  <StatusSwitch row={r} onToggle={onToggleStatus} />
                </span>
              </>
            )}
          </span>
        ),
      },
    ],
    [canEdit, onToggleStatus]
  );

  return (
    <DataGrid
      id="employees"
      label="Employees"
      columns={columns}
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
