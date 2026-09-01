"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole, DelegationFormData } from "@/lib/types/user";
import { updateUserDelegationAction } from "@/app/actions/user.actions";
import { UserCheck, Calendar, ShieldAlert, X } from "lucide-react";

interface UserDelegationDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRole | null;
  allUsers: UserWithRole[];
  onDelegationSaved: (updatedUser: UserWithRole) => void;
}

export function UserDelegationDialog({
  open,
  onClose,
  user,
  allUsers,
  onDelegationSaved,
}: UserDelegationDialogProps) {
  const [delegatedToUserId, setDelegatedToUserId] = useState<string>("");
  const [delegatedUntil, setDelegatedUntil] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setError(null);
      setDelegatedToUserId(user.delegatedToUserId || "");
      if (user.delegatedUntil) {
        const d = new Date(user.delegatedUntil);
        setDelegatedUntil(d.toISOString().split("T")[0]);
      } else {
        setDelegatedUntil("");
      }
    }
  }, [open, user]);

  if (!user) return null;

  // Filter out the user themselves from the proxy candidates list
  const availableProxyUsers = allUsers.filter(
    (u) => u.id !== user.id && u.isActive
  );

  const isCurrentlyDelegated =
    user.delegatedToUserId &&
    user.delegatedUntil &&
    new Date(user.delegatedUntil) > new Date();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: DelegationFormData = {
      delegatedToUserId: delegatedToUserId || null,
      delegatedUntil: delegatedUntil || null,
    };

    try {
      const res = await updateUserDelegationAction(user.id, payload);
      if (res.success && res.data) {
        onDelegationSaved(res.data);
        onClose();
      } else {
        setError(res.error || "Failed to update delegation");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await updateUserDelegationAction(user.id, {
        delegatedToUserId: null,
        delegatedUntil: null,
      });
      if (res.success && res.data) {
        onDelegationSaved(res.data);
        onClose();
      } else {
        setError(res.error || "Failed to clear delegation");
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
      title="Delegation of Authority (Temporary Proxy)"
      description={`Delegate approval authority from ${user.name || user.email} to another active user during absence or leave.`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isCurrentlyDelegated && (
              <Button type="button" variant="ghost" onClick={handleClear} disabled={loading} className="text-red-600 hover:bg-red-50 gap-1">
                <X className="h-4 w-4" /> Revoke Delegation
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="delegation-form" disabled={loading}>
              {loading ? "Saving..." : "Save Delegation"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="delegation-form" onSubmit={handleSave} className="space-y-4 pt-1">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {isCurrentlyDelegated && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Active Delegation: Proxy is <strong>{user.delegatedToUserName}</strong> until{" "}
              {new Date(user.delegatedUntil!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            </span>
          </div>
        )}

        {/* Proxy User Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Delegate Proxy User
          </label>
          <div className="relative">
            <UserCheck className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <select
              value={delegatedToUserId}
              onChange={(e) => setDelegatedToUserId(e.target.value)}
              className="w-full rounded-lg border border-[#d7e8d0] pl-9 pr-3 py-2 text-sm outline-none bg-white focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            >
              <option value="">-- Select Proxy User (No Delegation) --</option>
              {availableProxyUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ? `${u.name} (${u.email})` : u.email} — [{u.roleName || "No Role"}]
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            The proxy user will temporarily inherit approval rights for leave, OT, and payroll actions.
          </p>
        </div>

        {/* Expiration Date */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Delegation Expiration Date (Until)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={delegatedUntil}
              onChange={(e) => setDelegatedUntil(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-[#d7e8d0] pl-9 pr-3 py-2 text-sm outline-none bg-white focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            On this date at 23:59, proxy delegation will automatically expire and revert back.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
