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
          ? "Confirm approval of this leave request."
          : "Provide a reason for rejecting this leave request."
      }
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <DataSaveButton
            onClick={handleConfirm}
            isSaving={saving}
            label={isApprove ? "Approve" : "Reject"}
          />
        </>
      }
    >
      {target && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border border-[#d7e8d0]/80 bg-[#f6faf6]/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d7e8d0] text-sm font-bold text-[#1b3a1f]">
                {target.employeeName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-[#1b3a1f]">{target.employeeName}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {target.leaveTypeName}
                  </span>
                  <span>&middot; {target.noOfDays} day(s) &middot; {target.duration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-[#1b3a1f]">
              Review Remarks
              {!isApprove && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              required={!isApprove}
              className="mt-1 w-full rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              placeholder={
                isApprove
                  ? "Optional: add approval remarks..."
                  : "Reason for rejection (required)..."
              }
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}