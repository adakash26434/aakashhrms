"use client";

import { UserWithRole } from "@/lib/types/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  UserCheck,
  UserX,
  KeyRound,
  Edit2,
  Lock,
  UserCog,
  ScrollText,
  ShieldAlert,
  Link2,
  Mail,
} from "lucide-react";

interface UserTableProps {
  users: UserWithRole[];
  onEdit: (user: UserWithRole) => void;
  onDeactivate: (user: UserWithRole) => void;
  onReactivate: (user: UserWithRole) => void;
  onResetPassword: (user: UserWithRole) => void;
  onResendInvitation?: (user: UserWithRole) => void;
  onDelegate: (user: UserWithRole) => void;
  onViewAudit: (user: UserWithRole) => void;
}

const SCOPE_VARIANTS: Record<string, "info" | "success" | "warning" | "default"> = {
  GLOBAL: "info",
  BRANCH: "success",
  DEPARTMENT: "warning",
  SELF: "default",
};

export function UserTable({
  users,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onResendInvitation,
  onDelegate,
  onViewAudit,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="py-16 text-center">
        <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-600 text-base font-semibold">No user accounts found</p>
        <p className="text-gray-400 text-xs mt-1">Try adjusting your filters or create a new user account.</p>
      </div>
    );
  }

  const formatLastLogin = (date: Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getBranchDeptDisplay = (user: UserWithRole) => {
    const branchStr = user.employeeBranchCode || user.employeeBranch;
    const deptStr = user.employeeDepartmentCode || user.employeeDepartment;

    if (branchStr && deptStr) {
      return `${branchStr} / ${deptStr}`;
    }
    if (branchStr) return branchStr;
    if (deptStr) return deptStr;
    return "—";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
          <tr className="border-b border-zinc-300 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Scope</th>
            <th className="px-4 py-3">Branch / Dept</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last Login</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {users.map((user) => {
            const isSysAdmin = user.roleSlug === "system_admin";
            const scopeType = user.roleScopeType || "GLOBAL";
            const scopeVariant = SCOPE_VARIANTS[scopeType] || "info";
            const hasNeverLoggedIn = !user.lastLoginAt;

            const isDelegated =
              user.delegatedToUserId &&
              user.delegatedUntil &&
              new Date(user.delegatedUntil) > new Date();

            return (
              <tr key={user.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                {/* USER (Linked Employee Badge) */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 border border-zinc-200 text-zinc-600 font-medium text-xs">
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-zinc-900 truncate flex items-center gap-1.5">
                        <span>{user.name || user.email.split("@")[0]}</span>
                        {isSysAdmin && <Lock className="h-3 w-3 text-amber-500 shrink-0" />}
                      </div>
                      <div className="text-zinc-500 text-[11px] truncate flex items-center gap-2">
                        <span>{user.email}</span>
                        {isDelegated && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-800 bg-amber-50/70 border border-amber-200/50 px-1.5 py-0.2 rounded" title={`Delegated to ${user.delegatedToUserName}`}>
                            <ShieldAlert className="h-2.5 w-2.5" /> Proxy: {user.delegatedToUserName}
                          </span>
                        )}
                      </div>

                      {/* Employee Link Badge */}
                      <div className="mt-1">
                        {user.employeeId && user.employeeCode ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-200/50 px-1.5 py-0.5 rounded">
                            <Link2 className="h-2.5 w-2.5 text-emerald-600" />
                            <span>{user.employeeCode}</span>
                            {user.employeeName && <span className="text-emerald-700 font-normal">({user.employeeName})</span>}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">No linked employee</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* ROLE */}
                <td className="px-4 py-4">
                  <span className="inline-flex items-center rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 border border-zinc-200">
                    {user.roleName || "Unassigned"}
                  </span>
                </td>

                {/* SCOPE */}
                <td className="px-4 py-4">
                  <Badge variant={scopeVariant} className="px-2 py-0.5 font-medium text-[10px] tracking-wide">
                    {scopeType}
                  </Badge>
                </td>

                {/* BRANCH / DEPT */}
                <td className="px-4 py-4 text-zinc-600 font-mono text-xs">
                  {getBranchDeptDisplay(user)}
                </td>

                {/* STATUS */}
                <td className="px-4 py-4">
                  <Badge variant={user.isActive ? "success" : "neutral"} className="rounded-full px-2 py-0.5">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>

                {/* LAST LOGIN */}
                <td className="px-4 py-4 text-zinc-500 font-mono text-xs whitespace-nowrap">
                  {formatLastLogin(user.lastLoginAt)}
                </td>

                {/* ACTIONS */}
                <td className="px-4 py-4 text-right relative whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {/* Resend Welcome Invitation (Only if never logged in) */}
                    {hasNeverLoggedIn && onResendInvitation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResendInvitation(user)}
                        title="Resend Welcome Invitation"
                        className="h-7 px-2 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Delegation of Authority */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelegate(user)}
                      title="Delegate Authority (Proxy)"
                      className="h-7 px-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    >
                      <UserCog className="h-3.5 w-3.5" />
                    </Button>

                    {/* Activity Audit Log Snapshot */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewAudit(user)}
                      title="View Activity Audit Log"
                      className="h-7 px-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(user)}
                      title="Edit User"
                      className="h-7 px-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    {/* Reset Password */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetPassword(user)}
                      title="Reset Password"
                      className="h-7 px-2 text-zinc-500 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>

                    {/* Deactivate / Reactivate */}
                    {user.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSysAdmin}
                        onClick={() => onDeactivate(user)}
                        title={isSysAdmin ? "System Admin cannot be deactivated" : "Deactivate Account"}
                        className="h-7 px-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReactivate(user)}
                        title="Reactivate Account"
                        className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
