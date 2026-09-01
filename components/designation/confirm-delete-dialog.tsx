"use client";

import { AlertTriangle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Designation } from "@/lib/types/designation";
import { formatEmployeeCount } from "@/lib/types/designation";

interface ConfirmDeleteDialogProps {
  open: boolean;
  designation: Designation | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a designation.
 */
export function ConfirmDeleteDialog({
  open,
  designation,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const isInUse = Boolean(designation && designation.employeeCount > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Designation"
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
            disabled={!designation || isInUse}
            title={
              isInUse
                ? "This designation is in use and cannot be deleted"
                : undefined
            }
          >
            Delete Permanently
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Designation summary card */}
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600">
            <Briefcase className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1b3a1f]">
              {designation ? designation.name : "—"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 font-medium text-[#1b3a1f]">
                Designation
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">
                {formatEmployeeCount(designation?.employeeCount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Body copy */}
        <p className="text-sm text-gray-600">
          {designation
            ? `Are you sure you want to permanently delete the "${designation.name}" designation? Employees mapped to this designation will need reassignment.`
            : "This designation no longer exists."}
        </p>

        {/* In-use warning */}
        {isInUse && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This designation is currently assigned to employees. Reassign
              or remove them before deleting it.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}