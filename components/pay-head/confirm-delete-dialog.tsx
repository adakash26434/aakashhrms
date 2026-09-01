"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PayHead } from "@/lib/types/pay-head";

interface ConfirmDeleteDialogProps {
  open: boolean;
  head: PayHead | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a pay head.
 *
 * Renders a danger-tinted Dialog with the target pay head's
 * code + name so the user is sure which row they're removing.
 */
export function ConfirmDeleteDialog({
  open,
  head,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Pay Head"
      description="This action cannot be undone. The pay head will be permanently removed from the system."
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
            disabled={!head}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        You are about to delete the pay head:{" "}
        <span className="font-semibold">
          {head ? `${head.name} (${head.code})` : "this pay head"}
        </span>
        . If this head is referenced by any employee salary
        mapping, the mapping will be affected. Remove the head
        from any salary mapping before deleting.
      </div>
    </Dialog>
  );
}
