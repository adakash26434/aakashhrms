"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole } from "@/lib/types/user";
import { resetPasswordAction } from "@/app/actions/user.actions";
import { Mail, Check, Copy, AlertCircle, Loader2, KeyRound } from "lucide-react";

interface UserResendInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRole | null;
}

export function UserResendInvitationDialog({
  open,
  onClose,
  user,
}: UserResendInvitationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const handleIssueInvitation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resetPasswordAction(user.id);
      if (!res.success) {
        setError(res.error || "Failed to generate new invitation credentials.");
        return;
      }
      if (res.data) {
        setIssuedPassword(res.data.tempPassword);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (issuedPassword) {
      navigator.clipboard.writeText(issuedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setIssuedPassword(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Resend Welcome Invitation"
      description={`Issue a fresh temporary login password for ${user.name || user.email}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {issuedPassword ? "Done" : "Cancel"}
          </Button>
          {!issuedPassword && (
            <Button
              onClick={handleIssueInvitation}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  <span>Generate New Password</span>
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!issuedPassword ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-xs leading-relaxed">
              This user has never logged in yet. Clicking below will generate a new secure temporary password
              and invalidate any previous credential.
            </p>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">User Account:</span>
                <span className="font-semibold text-[#1b3a1f]">{user.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Login Email:</span>
                <span className="font-semibold text-gray-700">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Assigned Role:</span>
                <span className="font-semibold text-slate-600">{user.roleName || "Unassigned"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-[fadeIn_200ms_ease-out]">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                New Temporary Password Generated
              </p>
              <div className="flex items-center justify-between bg-white rounded-lg border border-emerald-200 p-2.5">
                <code className="font-mono text-sm font-bold text-emerald-950 tracking-wider">
                  {issuedPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 text-xs h-7 px-2"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <p className="text-[11px] text-emerald-800 leading-tight">
                Share this credential with <strong>{user.email}</strong>. They will be prompted to choose a new password upon first sign-in.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
