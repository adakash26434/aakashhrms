"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Holiday } from "@/lib/types/holiday";

interface ConfirmDeleteDialogProps {
  open: boolean;
  holiday: Holiday | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a holiday.
 *
 * Renders a danger-tinted Dialog with the target holiday's
 * name so the user is sure which row they're removing.
 */
export function ConfirmDeleteDialog({
  open,
  holiday,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Holiday"
      description="This action cannot be undone. The holiday will be permanently removed from the system."
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
            disabled={!holiday}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        You are about to delete the holiday:{" "}
        <span className="font-semibold">
          {holiday ? holiday.name : "this holiday"}
        </span>
        . If this holiday is referenced by any locked payroll run, the
        run will be affected. Remove the holiday from any locked run
        before deleting.
      </div>
    </Dialog>
  );
}
