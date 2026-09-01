"use client";

import { AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Employee } from "@/lib/types/employee";

interface ConfirmDeleteEmployeeDialogProps {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteEmployeeDialog({
  open,
  employee,
  onClose,
  onConfirm,
}: ConfirmDeleteEmployeeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Employee"
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
            disabled={!employee}
          >
            Delete Permanently
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#2e7d32]">
            <User className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1b3a1f]">
              {employee ? `${employee.firstName} ${employee.lastName}` : "—"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-gray-500">
              {employee?.employeeCode ?? "—"}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          {employee
            ? `Are you sure you want to permanently delete ${employee.firstName} ${employee.lastName}? Historical payroll records may be affected.`
            : "This employee no longer exists."}
        </p>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Deleting an employee removes their record from the directory. Use
            termination instead if payroll history must be preserved.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
