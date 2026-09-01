"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import type { SalaryMapping } from "@/lib/types/salary-mapping";

interface ConfirmDeleteDialogProps {
  open: boolean;
  mapping: SalaryMapping | null;
  employeeName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  mapping,
  employeeName,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!mapping) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Salary Mapping"
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Delete
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#1b3a1f]">
            Delete salary mapping for
          </p>
          <p className="mt-1 text-sm font-bold text-[#1b3a1f]">{employeeName}?</p>
          <p className="mt-2 text-xs text-gray-500">
            This will permanently remove this salary mapping. The employee will
            need a new mapping for future payroll runs.
          </p>
        </div>
      </div>
    </Dialog>
  );
}