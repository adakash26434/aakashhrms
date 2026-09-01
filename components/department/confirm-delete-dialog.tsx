"use client";

import { AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Department } from "@/lib/types/department";
import {
  formatPositionsCount,
  formatStaffCount,
} from "@/lib/types/department";

interface ConfirmDeleteDialogProps {
  open: boolean;
  department: Department | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a department.
 *
 * Renders a danger-tinted Dialog with the target department's
 * summary (name + designation/employee counts), echoing the
 * design's "Engineering / Department · 4 designations · 4
 * employees" affordance verbatim. The body explains that the
 * action cannot be undone and lists the cascade impact.
 */
export function ConfirmDeleteDialog({
  open,
  department,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const isInUse = Boolean(
    department &&
      (department.designationCount > 0 || department.employeeCount > 0),
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Department"
      description="This action cannot be undone"
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={!department || isInUse}
            title={
              isInUse
                ? "This department is in use and cannot be deleted"
                : undefined
            }
          >
            Delete Permanently
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Department summary card */}
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#2e7d32]">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1b3a1f]">
              {department ? department.name : "—"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 font-medium text-[#1b3a1f]">
                Department
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">
                {formatPositionsCount(department?.designationCount ?? 0)}
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">
                {formatStaffCount(department?.employeeCount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Body copy */}
        <p className="text-sm text-gray-600">
          {department
            ? `Are you sure you want to permanently delete the "${department.name}" department? This will also remove all ${department.designationCount} designation${department.designationCount === 1 ? "" : "s"} assigned to it. Employees mapped to this department will need reassignment.`
            : "This department no longer exists."}
        </p>

        {/* In-use warning */}
        {isInUse && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This department is currently in use. Reassign or remove all
              designations and employees before deleting it.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
