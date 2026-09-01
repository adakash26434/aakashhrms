"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FiscalYear } from "@/lib/types/fiscal-year";

interface ConfirmDeleteDialogProps {
  open: boolean;
  fiscalYear: FiscalYear | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a fiscal year.
 *
 * Renders a danger-tinted Dialog with the target FY's label and a
 * confirmation message. Deletion is permanent.
 */
export function ConfirmDeleteDialog({
  open,
  fiscalYear,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Fiscal Year"
      description="This action cannot be undone. The fiscal year will be permanently removed."
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
            disabled={!fiscalYear}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        You are about to delete{" "}
        <span className="font-semibold">
          {fiscalYear?.label ?? "this fiscal year"}
        </span>
        . Any associated configuration referencing this year may break.
      </div>
    </Dialog>
  );
}
