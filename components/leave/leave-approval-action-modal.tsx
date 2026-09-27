"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataSaveButton } from "@/components/ui/data-save-button";

interface ActionTarget {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  noOfDays: number;
  duration: string;
}

interface LeaveApprovalActionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
  action: "approve" | "reject";
  target: ActionTarget | null;
}

export function LeaveApprovalActionModal({
  open,
  onClose,
  onConfirm,
  action,
  target,
}: LeaveApprovalActionModalProps) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(remarks);
      setRemarks("");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRemarks("");
    onClose();
  };

  const isApprove = action === "approve";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isApprove ? "Approve Leave Application" : "Reject Leave Application"}
      description={
        isApprove
          ? "Confirm administrative approval for this employee absence."
          : "Provide an explanatory reason for declining this request."
      }
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {target ? `${target.employeeName} (${target.noOfDays} days)` : "Action confirmation"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <DataSaveButton
              onClick={handleConfirm}
              isSaving={saving}
              label={isApprove ? "Approve Application" : "Reject Application"}
              className={
                isApprove
                  ? "rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer"
                  : "rounded-md bg-rose-700 hover:bg-rose-800 text-white font-medium shadow-none cursor-pointer"
              }
            />
          </div>
        </div>
      }
    >
      {target && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="rounded-md border border-zinc-200/80 bg-zinc-50/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200/60 text-xs font-bold text-emerald-950">
                {target.employeeName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">{target.employeeName}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1 font-medium text-zinc-700">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    {target.leaveTypeName}
                  </span>
                  <span>•</span>
                  <span>{target.noOfDays} day(s)</span>
                  <span>•</span>
                  <span>{target.duration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
              Review Remarks {!isApprove && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              required={!isApprove}
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 resize-y"
              placeholder={
                isApprove
                  ? "Optional: add supervisor notes or instructions..."
                  : "Reason for rejection (mandatory)..."
              }
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}