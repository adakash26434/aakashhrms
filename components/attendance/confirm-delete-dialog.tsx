"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title = "Delete Attendance Punch",
  description = "Are you sure you want to permanently delete this daily attendance record? This action cannot be undone.",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">
            <AlertTriangle className="h-4 w-4 mr-1.5" />
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
          <p className="text-sm font-bold text-[#1b3a1f]">{title}</p>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </Dialog>
  );
}