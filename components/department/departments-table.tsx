"use client";

import {
  Briefcase,
  Building2,
  ChevronDown,
  Cog,
  Coins,
  Eye,
  Headphones,
  Megaphone,
  Pencil,
  Trash2,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatPositionsCount,
  formatStaffCount,
  formatStatus,
  type Department,
  type DepartmentStatus,
  DEPARTMENT_STATUS_META,
} from "@/lib/types/department";

interface DepartmentsTableProps {
  /** The (filtered) departments to render. Already sorted by the parent. */
  departments: Department[];
  /** Resolved branch names by id. */
  branchNameById: Map<string, string>;
  onView: (department: Department) => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
}

/**
 * Read-only table of departments. Renders the columns exactly
 * as in the design screenshot:
 *
 *   DEPARTMENT | BRANCH | HEAD | DESIGNATIONS | EMPLOYEES | STATUS | ACTIONS
 *
 * - DEPARTMENT: a small icon (per code) + name + monospace code below
 * - BRANCH: a soft blue pill
 * - HEAD: free-text name
 * - DESIGNATIONS: number + "positions" (e.g. "4 positions")
 * - EMPLOYEES: number + "staff" (e.g. "4 staff")
 * - STATUS: a small clickable pill (Active / Inactive) with a chevron
 * - ACTIONS: view / edit / delete icon buttons
 *
 * The view button opens the detail panel.
 */
export function DepartmentsTable({
  departments,
  branchNameById,
  onView,
  onEdit,
  onDelete,
}: DepartmentsTableProps) {
  if (departments.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500">
        No departments match the current filter. Adjust the search or
        branch filter, or click{" "}
        <span className="font-medium text-payroll-navy">Add Department</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
            <th scope="col" className="px-4 py-4 font-semibold">
              Department
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Branch
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Head
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Designations
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Employees
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-4 text-right font-semibold"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <DepartmentRow
              key={d.id}
              department={d}
              branchName={branchNameById.get(d.branchId) ?? "—"}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

/**
 * Module-level icon lookup. The `Icon` constant is declared
 * outside of `DepartmentRow` so the React DevTools eslint
 * rule ("components created during render") never trips.
 * The row picks the icon by mapping `code → LucideIcon` here.
 */
const ICON_BY_CODE: Record<string, LucideIcon> = {
  ENG: Cog,
  IT: Cog,
  OPS: Briefcase,
  FIN: Coins,
  HR: Users,
  "HR-ADM": Users,
  SALES: Megaphone,
  MKT: Megaphone,
  CSUPP: Headphones,
  SUP: Headphones,
  LOG: Truck,
};

const DEFAULT_ICON: LucideIcon = Building2;

function DepartmentRow({
  department,
  branchName,
  onView,
  onEdit,
  onDelete,
}: {
  department: Department;
  branchName: string;
  onView: (d: Department) => void;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}) {
  const Icon = ICON_BY_CODE[department.code.toUpperCase()] ?? DEFAULT_ICON;
  return (
    <tr className="border-b border-zinc-100 last:border-b-0 transition-colors hover:bg-zinc-50/60">
      {/* Department — name + code */}
      <td className="px-4 py-4 align-middle">
        <div className="-ml-1 flex items-center gap-2.5 rounded px-1 py-0.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/40">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-zinc-950">
              {department.name}
            </span>
            <span className="block font-mono text-[11px] text-zinc-400">
              {department.code}
            </span>
          </span>
        </div>
      </td>

      {/* Branch */}
      <td className="px-4 py-4 align-middle">
        <span className="inline-flex items-center rounded border border-zinc-200/60 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {branchName}
        </span>
      </td>

      {/* Head */}
      <td className="px-4 py-4 align-middle text-zinc-900">
        {department.headName || "—"}
      </td>

      {/* Designations */}
      <td className="px-4 py-4 align-middle">
        <span className="font-semibold tabular-nums text-zinc-950">
          {department.designationCount}
        </span>
        <span className="ml-1 text-xs text-zinc-400">positions</span>
      </td>

      {/* Employees */}
      <td className="px-4 py-4 align-middle">
        <span className="font-semibold tabular-nums text-zinc-950">
          {department.employeeCount}
        </span>
        <span className="ml-1 text-xs text-zinc-400">staff</span>
      </td>

      {/* Status */}
      <td className="px-4 py-4 align-middle">
        <StatusPill status={department.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          <ActionButton
            label={`View ${department.name}`}
            onClick={() => onView(department)}
          >
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton
            label={`Edit ${department.name}`}
            onClick={() => onEdit(department)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton
            label={`Delete ${department.name}`}
            onClick={() => onDelete(department)}
            danger
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: DepartmentStatus }) {
  void DEPARTMENT_STATUS_META[status];
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium transition-colors",
        status === "active"
          ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
          : "border-zinc-200/60 bg-zinc-50 text-zinc-600",
      )}
      aria-label={`Status: ${formatStatus(status)}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          status === "active" ? "bg-emerald-600" : "bg-zinc-400",
        )}
        aria-hidden
      />
      <span>{formatStatus(status)}</span>
      <ChevronDown className="h-3 w-3 opacity-50" aria-hidden />
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        danger
          ? "text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900",
      )}
    >
      {children}
    </button>
  );
}

// Silence the unused-import lint for the helper formatters
// (they're re-exported for downstream consumers like the
// detail panel).
void formatPositionsCount;
void formatStaffCount;
