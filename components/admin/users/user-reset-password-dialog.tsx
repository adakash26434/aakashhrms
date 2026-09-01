"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole } from "@/lib/types/user";
import { resetPasswordAction } from "@/app/actions/user.actions";
import { KeyRound, Copy, Check, AlertCircle } from "lucide-react";

interface UserResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRole | null;
}

export function UserResetPasswordDialog({
  open,
  onClose,
  user,
}: UserResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resetPasswordAction(user.id);
      if (res.success && res.data) {
        setTempPassword(res.data.tempPassword);
      } else {
        setError(res.error || "Failed to reset password");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setTempPassword(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Reset User Password"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {tempPassword ? "Done" : "Cancel"}
          </Button>
          {!tempPassword && (
            <Button variant="default" onClick={handleReset} disabled={loading}>
              {loading ? "Resetting..." : "Generate New Password"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {!tempPassword ? (
          <>
            <p className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to reset password for <strong className="text-[#1b3a1f]">{user.email}</strong>?
              A new secure temporary password will be generated for this user.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              <KeyRound className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Password successfully reset! Please copy the temporary password below.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1">
                Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tempPassword}
                  className="flex-1 font-mono text-sm font-bold bg-[#f6faf6] border border-[#d7e8d0] rounded-lg px-3 py-2 text-[#1b3a1f]"
                />
                <Button variant="outline" size="md" onClick={handleCopy} className="shrink-0 gap-1.5">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              Share this temporary password with the user securely. They will use it to sign in to the system.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
