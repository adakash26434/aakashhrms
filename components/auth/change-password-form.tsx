"use client";

import { useState } from "react";
import { changePasswordAction } from "@/app/actions/change-password.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function ChangePasswordForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      toast.error("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        const msg = res.error || "Failed to update password.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Password changed successfully! Redirecting...");
      const targetUrl =
        res.data?.scopeType === "SELF" ? "/self-service" : "/dashboard";
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 bg-white shadow-xl border-emerald-100 rounded-2xl">
      <div className="text-center mb-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-200">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#1b3a1f]">
          Change Your Password
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          For security, please set a new personal password before accessing the
          system.
        </p>
      </div>

      {success ? (
        <div className="flex flex-col items-center justify-center py-6 text-center animate-[fadeIn_200ms_ease-out]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-[#1b3a1f]">
            Password Changed Successfully!
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Redirecting to your workspace...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Current / Temporary Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current or temporary password"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-10 py-2 text-sm outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-0.5 rounded"
                aria-label={
                  showCurrentPassword ? "Hide password" : "Show password"
                }
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              New Password
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-10 py-2 text-sm outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-0.5 rounded"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Confirm New Password
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-10 py-2 text-sm outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-0.5 rounded"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2e7d32] hover:bg-[#256629] text-white mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating Password...</span>
              </div>
            ) : (
              <span>Update Password & Continue</span>
            )}
          </Button>
        </form>
      )}
    </Card>
  );
}
