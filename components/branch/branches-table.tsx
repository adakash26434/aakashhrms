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
        <span className="font-medium text-[#1b3a1f]">Add Branch</span>{" "}
        to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-180 text-left text-sm">
        <thead>
          <tr className="border-b border-[#d7e8d0]/80 bg-[#f6faf6]/60 text-[11px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="px-5 py-3 font-semibold">Branch</th>
            <th scope="col" className="px-5 py-3 font-semibold">Code</th>
            <th scope="col" className="px-5 py-3 font-semibold">Location</th>
            <th scope="col" className="px-5 py-3 font-semibold">Contact</th>
            <th scope="col" className="px-5 py-3 font-semibold">Status</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr
              key={b.id}
              className="border-b border-[#d7e8d0]/60 last:border-b-0 transition-colors hover:bg-[#f6faf6]/40"
            >
              <td className="px-5 py-4 align-middle">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-[#2e7d32]">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[#1b3a1f]">
                      {b.name}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 align-middle">
                <code className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 text-[11px] font-mono text-[#1b3a1f]">
                  {b.code}
                </code>
              </td>
              <td className="px-5 py-4 align-middle">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-40">{b.location}</span>
                </div>
              </td>
              <td className="px-5 py-4 align-middle">
                <div className="space-y-0.5">
                  {b.phone && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {b.email && (
                    <span className="text-xs text-gray-500">{b.email}</span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4 align-middle">
                <StatusPill status={b.status} />
              </td>
              <td className="px-5 py-4 align-middle">
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