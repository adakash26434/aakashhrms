"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatNPRAmount, formatRateLabel, type TaxSlab } from "@/lib/types/tax-rate";

interface ConfirmDeleteDialogProps {
  open: boolean;
  slab: TaxSlab | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before deleting a tax slab.
 *
 * Renders a danger-tinted Dialog with the target slab's range
 * and rate so the user is sure which row they're removing.
 * Deletion is permanent (locally — no API integration yet).
 */
export function ConfirmDeleteDialog({
  open,
  slab,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Tax Slab"
      description="This action cannot be undone. The slab will be permanently removed from this category's tax ladder."
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
            disabled={!slab}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        You are about to delete the slab:{" "}
        <span className="font-semibold">
          {slab
            ? `${
                formatNPRAmount(slab.amountFrom)
              } → ${
                slab.amountTo === null
                  ? "Above"
                  : formatNPRAmount(slab.amountTo)
              } @ ${formatRateLabel(slab.ratePercent)}`
            : "this slab"}
        </span>
        . Removing a slab creates a gap in the tax ladder. You may need
        to add a new slab to close the gap before payslip generation.
      </div>
    </Dialog>
  );
}
