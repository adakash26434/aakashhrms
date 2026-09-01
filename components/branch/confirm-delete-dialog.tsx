"use client";

import { AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Branch } from "@/lib/types/branch";

interface ConfirmDeleteDialogProps {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({ open, branch, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Branch"
      description="This action cannot be undone"
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={!branch}>
            Delete Permanently
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#2e7d32]">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1b3a1f]">{branch ? branch.name : "—"}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-[#d7e8d0]/60 px-1.5 py-0.5 font-medium text-[#1b3a1f]">Branch</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">{branch?.code ?? ""}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {branch
            ? `Are you sure you want to permanently delete the "${branch.name}" branch? Departments and employees assigned to this branch will need reassignment.`
            : "This branch no longer exists."}
        </p>
      </div>
    </Dialog>
  );
}