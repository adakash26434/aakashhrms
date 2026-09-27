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
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
            <th scope="col" className="px-4 py-4 font-semibold">
              Designation
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Department
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Employees
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-4 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {designations.map((d) => (
            <tr
              key={d.id}
              className="border-b border-zinc-100 last:border-b-0 transition-colors hover:bg-zinc-50/60"
            >
              {/* Designation */}
              <td className="px-4 py-4 align-middle">
                <div className="-ml-1 flex items-center gap-2.5 rounded px-1 py-0.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/40">
                    <Pencil className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-950">
                      {d.name}
                    </span>
                  </span>
                </div>
              </td>

              {/* Department */}
              <td className="px-4 py-4 align-middle">
                <span className="inline-flex items-center rounded border border-zinc-200/60 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {departmentNameById.get(d.departmentId) ?? "—"}
                </span>
              </td>

              {/* Employees */}
              <td className="px-4 py-4 align-middle">
                <span className="font-semibold tabular-nums text-zinc-950">
                  {d.employeeCount}
                </span>
                <span className="ml-1 text-xs text-zinc-400">employees</span>
              </td>

              {/* Status */}
              <td className="px-4 py-4 align-middle">
                <StatusPill status={d.status} />
              </td>

              {/* Actions */}
              <td className="px-4 py-4 align-middle">
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
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium",
        status === "active"
          ? "border-emerald-200/50 bg-emerald-50/70 text-emerald-800"
          : "border-zinc-200/60 bg-zinc-50 text-zinc-600",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          status === "active" ? "bg-emerald-600" : "bg-zinc-400",
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