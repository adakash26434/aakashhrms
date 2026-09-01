"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole } from "@/lib/types/user";
import { deactivateUserAction } from "@/app/actions/user.actions";
import { AlertTriangle } from "lucide-react";

interface UserDeactivateDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRole | null;
  onDeactivated: (user: UserWithRole) => void;
}

export function UserDeactivateDialog({
  open,
  onClose,
  user,
  onDeactivated,
}: UserDeactivateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleDeactivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deactivateUserAction(user.id);
      if (res.success && res.data) {
        onDeactivated(res.data);
        onClose();
      } else {
        setError(res.error || "Failed to deactivate user");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Deactivate User Account"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeactivate} disabled={loading}>
            {loading ? "Deactivating..." : "Deactivate User"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Confirm Deactivation</p>
            <p className="text-amber-800 text-xs leading-relaxed">
              Are you sure you want to deactivate account <strong className="text-amber-950">{user.email}</strong>?
              This user will immediately lose access to the system.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-[#f6faf6] border border-[#d7e8d0]/60 p-3 text-xs space-y-1 text-gray-700">
          <div><strong className="text-[#1b3a1f]">User Email:</strong> {user.email}</div>
          <div><strong className="text-[#1b3a1f]">Role:</strong> {user.roleName || "No Role"}</div>
          {user.employeeName && (
            <div><strong className="text-[#1b3a1f]">Linked Employee:</strong> {user.employeeName} ({user.employeeCode})</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
