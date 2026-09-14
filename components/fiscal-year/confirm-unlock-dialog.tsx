"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FiscalYear } from "@/lib/types/fiscal-year";
import { LockOpen, CheckCircle2, ShieldCheck } from "lucide-react";

interface ConfirmUnlockDialogProps {
  open: boolean;
  fiscalYear: FiscalYear | null;
  onClose: () => void;
  onConfirm: (targetStatus: "Active" | "Inactive") => void;
}

/**
 * Confirmation dialog before unlocking a locked fiscal year.
 *
 * Allows the company admin to unlock a previously locked fiscal year,
 * restore editing & deleting permissions, and choose whether to make
 * it the Active fiscal cycle or keep it Inactive.
 */
export function ConfirmUnlockDialog({
  open,
  fiscalYear,
  onClose,
  onConfirm,
}: ConfirmUnlockDialogProps) {
  const [targetStatus, setTargetStatus] = useState<"Active" | "Inactive">("Active");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Unlock Fiscal Year"
      description={`Unlocking will restore editing and deletion capabilities for ${fiscalYear?.label ?? "this fiscal year"}.`}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
            onClick={() => onConfirm(targetStatus)}
            disabled={!fiscalYear}
          >
            <LockOpen className="w-4 h-4 mr-1.5" />
            Unlock Fiscal Year
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Info Alert */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
          <div className="flex gap-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold mb-1">
                Unlock {fiscalYear?.label ?? "Fiscal Year"}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11.5px] text-emerald-800">
                <li>Enables editing and deleting this fiscal year.</li>
                <li>Allows modifying tax rate slabs and holiday calendars for this period.</li>
                <li>Enables standard Active / Inactive status management.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Status Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-payroll-navy uppercase tracking-wider">
            Status After Unlocking
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetStatus("Active")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                targetStatus === "Active"
                  ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-payroll-navy">Active</p>
                  <p className="text-[10px] text-gray-500">Current cycle</p>
                </div>
                {targetStatus === "Active" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus("Inactive")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                targetStatus === "Inactive"
                  ? "border-payroll-navy bg-payroll-navy/5 ring-1 ring-payroll-navy"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-payroll-navy">Inactive</p>
                  <p className="text-[10px] text-gray-500">Archived cycle</p>
                </div>
                {targetStatus === "Inactive" && (
                  <CheckCircle2 className="w-4 h-4 text-payroll-navy shrink-0" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
