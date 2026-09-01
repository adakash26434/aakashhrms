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
        <span className="font-medium text-[#1b3a1f]">Add Department</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-200 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="px-5 py-3 font-semibold">
              Department
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Branch
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Head
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Designations
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Employees
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-right font-semibold"
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
    <tr className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40">
      {/* Department — name + code (no longer clickable; view uses the icon) */}
      <td className="px-5 py-4 align-middle">
        <div className="-ml-1 flex items-center gap-2.5 rounded-md px-1 py-0.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-[#2e7d32]">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-[#1b3a1f]">
              {department.name}
            </span>
            <span className="block font-mono text-[11px] text-gray-500">
              {department.code}
            </span>
          </span>
        </div>
      </td>

      {/* Branch — soft blue pill */}
      <td className="px-5 py-4 align-middle">
        <Badge
          variant="default"
          className="bg-green-50 text-green-700 hover:bg-green-50"
        >
          {branchName}
        </Badge>
      </td>

      {/* Head */}
      <td className="px-5 py-4 align-middle text-[#1b3a1f]">
        {department.headName}
      </td>

      {/* Designations — "4 positions" */}
      <td className="px-5 py-4 align-middle">
        <span className="font-semibold tabular-nums text-[#1b3a1f]">
          {department.designationCount}
        </span>
        <span className="ml-1 text-xs text-gray-500">positions</span>
      </td>

      {/* Employees — "4 staff" */}
      <td className="px-5 py-4 align-middle">
        <span className="font-semibold tabular-nums text-[#1b3a1f]">
          {department.employeeCount}
        </span>
        <span className="ml-1 text-xs text-gray-500">staff</span>
      </td>

      {/* Status — clickable pill (visual only today) */}
      <td className="px-5 py-4 align-middle">
        <StatusPill status={department.status} />
      </td>

      {/* Actions */}
      <td className="px-5 py-4 align-middle">
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

/**
 * Status pill with a chevron, mirroring the design's affordance
 * for an inline status selector. Today it's visual only (a
 * button that does nothing) — the same way the holiday card
 * renders status. A future enhancement would be to make it a
 * dropdown that calls a service endpoint to update status.
 */
function StatusPill({ status }: { status: DepartmentStatus }) {
  // `meta` is referenced for IDE/intellisense even though
  // the rendered classes are derived inline.
  void DEPARTMENT_STATUS_META[status];
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        status === "active"
          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
      aria-label={`Status: ${formatStatus(status)}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          status === "active" ? "bg-emerald-500" : "bg-gray-400",
        )}
        aria-hidden
      />
      <span>{formatStatus(status)}</span>
      <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
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
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
          : "text-gray-500 hover:bg-[#d7e8d0]/60 hover:text-[#2e7d32]",
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
