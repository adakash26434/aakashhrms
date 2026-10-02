"use client";

import { useState, useEffect, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getUsersByRoleIdAction,
  assignUsersToRoleAction,
} from "@/app/actions/role.actions";
import { getUsersAction } from "@/app/actions/user.actions";
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  IdCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignUsersDialogProps {
  open: boolean;
  onClose: () => void;
  roleId: string;
  roleName: string;
  onSuccess?: () => void;
}

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
}

export function AssignUsersDialog({
  open,
  onClose,
  roleId,
  roleName,
  onSuccess,
}: AssignUsersDialogProps) {
  const toast = useToast();
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [allUsers, setAllUsers] = useState<AssignedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [roleUsersRes, allUsersRes] = await Promise.all([
        getUsersByRoleIdAction(roleId),
        getUsersAction(),
      ]);

      if (roleUsersRes.success && roleUsersRes.data) {
        setAssignedUsers(roleUsersRes.data as AssignedUser[]);
      }
      if (allUsersRes.success && allUsersRes.data?.users) {
        setAllUsers(
          allUsersRes.data.users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            isActive: u.isActive,
            employeeId: u.employeeId,
            employeeCode: u.employeeCode,
            employeeName: u.employeeName,
          }))
        );
      }
    } catch (err) {
      toast.error("Failed to load users for this role.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedUserIdToAdd("");
      loadData();
    }
  }, [open, roleId]);

  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));
  const candidateUsersToAdd = allUsers.filter((u) => !assignedUserIds.has(u.id));

  const filteredAssignedUsers = assignedUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeCode?.toLowerCase().includes(q) ?? false) ||
      (u.employeeName?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleAddUser = () => {
    if (!selectedUserIdToAdd) return;
    startTransition(async () => {
      const res = await assignUsersToRoleAction(roleId, [selectedUserIdToAdd], []);
      if (res.success) {
        toast.success(`User successfully assigned to "${roleName}".`);
        setSelectedUserIdToAdd("");
        await loadData();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Failed to assign user to role.");
      }
    });
  };

  const handleRemoveUser = (userId: string, userName: string) => {
    startTransition(async () => {
      const res = await assignUsersToRoleAction(roleId, [], [userId]);
      if (res.success) {
        toast.success(`User "${userName}" reassigned to standard self-service role.`);
        await loadData();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Failed to remove user from role.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Assign Users to Role: ${roleName}`}
      description="Manage the team members and staff accounts assigned to this role without leaving this page."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-gray-500">
            {assignedUsers.length} {assignedUsers.length === 1 ? "user" : "users"} assigned
          </span>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Add User Section */}
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
            <UserPlus className="h-4 w-4 text-emerald-800" />
            <span>Assign User to this Role</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={selectedUserIdToAdd}
              onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
              disabled={isLoading || isPending || candidateUsersToAdd.length === 0}
              className="flex-1 h-9 px-3 text-xs rounded-md border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 cursor-pointer"
            >
              <option value="">
                {candidateUsersToAdd.length === 0
                  ? "-- All active users are already assigned to this role --"
                  : "-- Select user or employee to assign --"}
              </option>
              {candidateUsersToAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.employeeName || "User"} ({u.email})
                  {u.employeeCode ? ` • [${u.employeeCode}]` : ""}
                </option>
              ))}
            </select>

            <Button
              onClick={handleAddUser}
              disabled={!selectedUserIdToAdd || isPending || isLoading}
              isLoading={isPending}
              size="sm"
              className="bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              <span>Assign to Role</span>
            </Button>
          </div>
          <p className="text-2xs text-zinc-500">
            Assigning a user here immediately grants them this role&apos;s permission matrix across the platform.
          </p>
        </div>

        {/* Existing Assigned Users Header & Search */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-700" />
              <h4 className="text-xs font-semibold text-zinc-900">
                Currently Assigned Users ({assignedUsers.length})
              </h4>
            </div>

            {assignedUsers.length > 3 && (
              <div className="relative max-w-xs w-full">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  placeholder="Search assigned users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            )}
          </div>

          {/* User List */}
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-800" />
              <span>Loading role members...</span>
            </div>
          ) : filteredAssignedUsers.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
              <Users className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-600">
                {assignedUsers.length === 0
                  ? "No users currently assigned to this role."
                  : "No assigned users match your search."}
              </p>
              <p className="text-2xs text-zinc-400 mt-0.5">
                Use the dropdown above to assign employees or administrative accounts.
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white">
              {filteredAssignedUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50/70 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-bold">
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 truncate">
                          {user.name || user.employeeName || "User"}
                        </span>
                        {user.employeeCode && (
                          <span className="inline-flex items-center gap-0.5 text-2xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                            <IdCard className="h-2.5 w-2.5" />
                            {user.employeeCode}
                          </span>
                        )}
                        {!user.isActive && (
                          <span className="text-2xs font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-zinc-500 truncate font-mono mt-0.5">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveUser(user.id, user.name || user.email)}
                    disabled={isPending}
                    className="h-8 px-2.5 text-2xs text-zinc-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 shrink-0 gap-1 border-zinc-200"
                    title="Remove user from this role (reassigns to standard employee self-service)"
                  >
                    <UserMinus className="h-3 w-3" />
                    <span>Remove</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
