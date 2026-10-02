"use client";

import { Building2, Eye, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatBranchStatus,
  type Branch,
  type BranchStatus,
  BRANCH_STATUS_META,
} from "@/lib/types/branch";

interface BranchesTableProps {
  branches: Branch[];
  onView: (branch: Branch) => void;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
}

/**
 * Read-only table of branches.
 *
 * Columns: BRANCH | CODE | LOCATION | CONTACT | STATUS | ACTIONS
 */
export function BranchesTable({
  branches,
  onView,
  onEdit,
  onDelete,
}: BranchesTableProps) {
  if (branches.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500">
        No branches found. Click{" "}
        <span className="font-medium text-payroll-navy">Add Branch</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-180 text-left text-sm">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-2xs font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-2xs uppercase tracking-wider text-zinc-500">
            <th scope="col" className="px-4 py-4 font-semibold">Branch</th>
            <th scope="col" className="px-4 py-4 font-semibold">Code</th>
            <th scope="col" className="px-4 py-4 font-semibold">Location</th>
            <th scope="col" className="px-4 py-4 font-semibold">Contact</th>
            <th scope="col" className="px-4 py-4 font-semibold">Status</th>
            <th scope="col" className="px-4 py-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr
              key={b.id}
              className="border-b border-zinc-100 last:border-b-0 transition-colors hover:bg-zinc-50/60"
            >
              <td className="px-4 py-4 align-middle">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/40">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-950">
                      {b.name}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 align-middle">
                <code className="rounded border border-zinc-200/60 bg-zinc-50 px-1.5 py-0.5 text-2xs font-mono text-zinc-700">
                  {b.code}
                </code>
              </td>
              <td className="px-4 py-4 align-middle">
                <div className="flex items-center gap-1.5 text-zinc-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate max-w-40">{b.location}</span>
                </div>
              </td>
              <td className="px-4 py-4 align-middle">
                <div className="space-y-0.5">
                  {b.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-600">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {b.email && (
                    <span className="text-xs text-zinc-400">{b.email}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 align-middle">
                <StatusPill status={b.status} />
              </td>
              <td className="px-4 py-4 align-middle">
                <div className="flex items-center justify-end gap-1">
                  <ActionButton label={`View ${b.name}`} onClick={() => onView(b)}>
                    <Eye className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton label={`Edit ${b.name}`} onClick={() => onEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionButton>
                  <ActionButton label={`Delete ${b.name}`} onClick={() => onDelete(b)} danger>
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

function StatusPill({ status }: { status: BranchStatus }) {
  void BRANCH_STATUS_META[status];
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
      <span>{formatBranchStatus(status)}</span>
    </span>
  );
}

function ActionButton({
  label, onClick, children, danger,
}: {
  label: string; onClick: () => void; children: React.ReactNode; danger?: boolean;
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