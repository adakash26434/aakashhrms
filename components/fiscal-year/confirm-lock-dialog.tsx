"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FiscalYear } from "@/lib/types/fiscal-year";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface ConfirmLockDialogProps {
  open: boolean;
  fiscalYear: FiscalYear | null;
  isLastActive: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog before locking a fiscal year.
 *
 * Renders a caution/warning-themed Dialog with the target FY's label,
 * detailing the consequences (read-only state for tax slabs, holidays, etc.).
 * Includes a strict safety alert if locking the last active fiscal year.
 */
export function ConfirmLockDialog({
  open,
  fiscalYear,
  isLastActive,
  onClose,
  onConfirm,
}: ConfirmLockDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Lock Fiscal Year"
      description="Locking a fiscal year freezes all associated data. This action is irreversible."
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-colors"
            onClick={onConfirm}
            disabled={!fiscalYear}
          >
            Confirm Lock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Core Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 animate-pulse" />
            <div>
              <p className="font-semibold mb-1">
                Are you sure you want to lock {fiscalYear?.label ?? "this fiscal year"}?
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-[13px] text-amber-700">
                <li>You will no longer be able to edit or delete this fiscal year.</li>
                <li>Adding, editing, or deleting tax slabs for this year will be disabled.</li>
                <li>Editing holiday calendars inside this fiscal year range will be disabled.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Last Active Guard Warning */}
        {isLastActive && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 animate-bounce">
            <div className="flex gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-950 mb-0.5">
                  Critical Warning
                </p>
                <p className="text-[13px] text-red-700">
                  This is the <span className="font-bold">ONLY active fiscal year</span> currently configured. Locking it will leave the system with no active periods for daily attendance logging or payroll processing. Please make sure you have created another active fiscal year.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
