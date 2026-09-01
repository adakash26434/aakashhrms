"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDesignationStatus,
  formatEmployeeCount,
  type Designation,
  type DesignationStatus,
  DESIGNATION_STATUS_META,
} from "@/lib/types/designation";

interface DesignationsTableProps {
  designations: Designation[];
  departmentNameById: Map<string, string>;
  onView: (designation: Designation) => void;
  onEdit: (designation: Designation) => void;
  onDelete: (designation: Designation) => void;
}

/**
 * Read-only table of designations.
 *
 * Columns: DESIGNATION | DEPARTMENT | EMPLOYEES | STATUS | ACTIONS
 */
export function DesignationsTable({
  designations,
  departmentNameById,
  onView,
  onEdit,
  onDelete,
}: DesignationsTableProps) {
  if (designations.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500">
        No designations match the current filter. Adjust the search or
        department filter, or click{" "}
        <span className="font-medium text-[#1b3a1f]">Add Designation</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-150 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="px-5 py-3 font-semibold">
              Designation
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Department
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Employees
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {designations.map((d) => (
            <tr
              key={d.id}
              className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40"
            >
              {/* Designation — name + id (no longer clickable; view uses the icon) */}
              <td className="px-5 py-4 align-middle">
                <div className="-ml-1 flex items-center gap-2.5 rounded-md px-1 py-0.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Pencil className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[#1b3a1f]">
                      {d.name}
                    </span>
                  </span>
                </div>
              </td>

              {/* Department */}
              <td className="px-5 py-4 align-middle">
                <Badge
                  variant="default"
                  className="bg-amber-50 text-amber-700 hover:bg-amber-50"
                >
                  {departmentNameById.get(d.departmentId) ?? "—"}
                </Badge>
              </td>

              {/* Employees */}
              <td className="px-5 py-4 align-middle">
                <span className="font-semibold tabular-nums text-[#1b3a1f]">
                  {d.employeeCount}
                </span>
                <span className="ml-1 text-xs text-gray-500">employees</span>
              </td>

              {/* Status */}
              <td className="px-5 py-4 align-middle">
                <StatusPill status={d.status} />
              </td>

              {/* Actions */}
              <td className="px-5 py-4 align-middle">
                <div className="flex items-center justify-end gap-1">
                  <ActionButton
                    label={`View ${d.name}`}
                    onClick={() => onView(d)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton
                    label={`Edit ${d.name}`}
                    onClick={() => onEdit(d)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton
                    label={`Delete ${d.name}`}
                    onClick={() => onDelete(d)}
                    danger
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ActionButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: DesignationStatus }) {
  void DESIGNATION_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        status === "active"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-100 text-gray-600",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          status === "active" ? "bg-emerald-500" : "bg-gray-400",
        )}
        aria-hidden
      />
      <span>{formatDesignationStatus(status)}</span>
    </span>
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