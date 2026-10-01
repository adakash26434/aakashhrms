"use client";

import { useState, useTransition } from "react";
import {
  UserWithRole,
  UserKPIs,
  UserStatus,
} from "@/lib/types/user";
import { RoleRow } from "@/lib/repositories/role.repository";
import { UserTable } from "./user-table";
import { UserFormModal } from "./user-form-modal";
import { UserDeactivateDialog } from "./user-deactivate-dialog";
import { UserResetPasswordDialog } from "./user-reset-password-dialog";
import { UserDelegationDialog } from "./user-delegation-dialog";
import { UserAuditModal } from "./user-audit-modal";
import { UserResendInvitationDialog } from "./resend-invitation-dialog";
import {
  getUsersAction,
  reactivateUserAction,
} from "@/app/actions/user.actions";
import { useToast } from "@/components/ui/toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Users,
  UserCheck,
  UserX,
  Link2,
  Search,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

interface UserClientProps {
  initialUsers: UserWithRole[];
  initialKPIs: UserKPIs;
  roles: RoleRow[];
  branches?: Array<{ id: string; name: string; code: string }>;
  departments?: Array<{ id: string; name: string; code: string }>;
  unlinkedEmployees: Array<{ id: string; employeeCode: string; name: string }>;
}

export function UserClient({
  initialUsers,
  initialKPIs,
  roles,
  branches = [],
  departments = [],
  unlinkedEmployees,
}: UserClientProps) {
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [kpis, setKpis] = useState<UserKPIs>(initialKPIs);
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [search, setSearch] = useState("");
  const [roleIdFilter, setRoleIdFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserWithRole | null>(null);

  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<UserWithRole | null>(null);

  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<UserWithRole | null>(null);

  const [resendInvitationDialogOpen, setResendInvitationDialogOpen] = useState(false);
  const [userToResendInvitation, setUserToResendInvitation] = useState<UserWithRole | null>(null);

  const [delegationDialogOpen, setDelegationDialogOpen] = useState(false);
  const [userToDelegate, setUserToDelegate] = useState<UserWithRole | null>(null);

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [userForAudit, setUserForAudit] = useState<UserWithRole | null>(null);

  // Success Toast for Created User Credential
  const [createdPasswordToast, setCreatedPasswordToast] = useState<{
    userEmail: string;
    tempPassword: string;
  } | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const handleFilterChange = (
    newSearch: string,
    newRoleId: string,
    newStatus: UserStatus | "all"
  ) => {
    setSearch(newSearch);
    setRoleIdFilter(newRoleId);
    setStatusFilter(newStatus);

    startTransition(async () => {
      const res = await getUsersAction({
        search: newSearch,
        roleId: newRoleId,
        status: newStatus,
      });
      if (res.success && res.data) {
        setUsers(res.data.users);
        setKpis(res.data.kpis);
      }
    });
  };

  const handleCreateOpen = () => {
    setUserToEdit(null);
    setFormModalOpen(true);
  };

  const handleEditOpen = (user: UserWithRole) => {
    setUserToEdit(user);
    setFormModalOpen(true);
  };

  const handleDeactivateOpen = (user: UserWithRole) => {
    setUserToDeactivate(user);
    setDeactivateDialogOpen(true);
  };

  const handleResetPasswordOpen = (user: UserWithRole) => {
    setUserToResetPassword(user);
    setResetPasswordDialogOpen(true);
  };

  const handleResendInvitationOpen = (user: UserWithRole) => {
    setUserToResendInvitation(user);
    setResendInvitationDialogOpen(true);
  };

  const handleDelegateOpen = (user: UserWithRole) => {
    setUserToDelegate(user);
    setDelegationDialogOpen(true);
  };

  const handleViewAuditOpen = (user: UserWithRole) => {
    setUserForAudit(user);
    setAuditModalOpen(true);
  };

  const toast = useToast();

  const handleReactivate = async (user: UserWithRole) => {
    try {
      const res = await reactivateUserAction(user.id);
      if (res.success) {
        toast.success(`User "${user.name || user.email}" reactivated successfully.`);
        refreshData();
      } else {
        toast.error(res.error || "Failed to reactivate user.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reactivate user.");
    }
  };

  const refreshData = () => {
    startTransition(async () => {
      const res = await getUsersAction({
        search,
        roleId: roleIdFilter,
        status: statusFilter,
      });
      if (res.success && res.data) {
        setUsers(res.data.users);
        setKpis(res.data.kpis);
      }
    });
  };

  const handleFormSaved = (savedUser: UserWithRole, tempPassword?: string) => {
    if (tempPassword) {
      setCreatedPasswordToast({
        userEmail: savedUser.email,
        tempPassword: tempPassword,
      });
      toast.success(`Account created for ${savedUser.email}`);
    } else {
      toast.success(`User "${savedUser.name || savedUser.email}" updated successfully.`);
    }
    refreshData();
  };

  const handleCopyToastPassword = () => {
    if (createdPasswordToast) {
      navigator.clipboard.writeText(createdPasswordToast.tempPassword);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast banner for newly created user credentials */}
      {createdPasswordToast && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 shadow-sm animate-[fadeIn_200ms_ease-out]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">User account created successfully!</p>
              <p className="text-xs text-emerald-800">
                Created <strong>{createdPasswordToast.userEmail}</strong>. Temporary password:{" "}
                <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded font-bold text-emerald-950">
                  {createdPasswordToast.tempPassword}
                </code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToastPassword} className="gap-1 bg-white">
              {copiedToast ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-gray-500" />}
              <span>{copiedToast ? "Copied" : "Copy Password"}</span>
            </Button>
            <button
              onClick={() => setCreatedPasswordToast(null)}
              className="text-xs text-emerald-700 hover:text-emerald-950 px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 py-2">
        {/* Total Users */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Total system accounts</p>
              <Users className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.total}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Registered login credentials
          </div>
        </div>

        {/* Active Users */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Active accounts</p>
              <UserCheck className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.active}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Authorized for system access
          </div>
        </div>

        {/* Inactive Users */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Inactive accounts</p>
              <UserX className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.inactive}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Suspended or revoked access
          </div>
        </div>

        {/* Linked to Employee */}
        <div className="group flex flex-col justify-between py-3 px-4 sm:first:pl-0 sm:last:pr-0">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Linked personnel</p>
              <Link2 className="h-4 w-4 text-zinc-600" />
            </div>
            <div className="mt-2.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums font-sans">
                {kpis.linkedToEmployee}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-200 text-xs text-zinc-400">
            Mapped to workforce records
          </div>
        </div>
      </div>

      {/* Filters & Actions Header */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Filters Bar */}
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
            {/* Search Input */}
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search user by name, email, code..."
                value={search}
                onChange={(e) => handleFilterChange(e.target.value, roleIdFilter, statusFilter)}
                className="w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 placeholder:text-zinc-400"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleIdFilter}
              onChange={(e) => handleFilterChange(search, e.target.value, statusFilter)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">All System Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(search, roleIdFilter, e.target.value as UserStatus | "all")}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Add User Button */}
          <Button onClick={handleCreateOpen} className="shrink-0 gap-1.5 bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-xs">
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </Button>
        </div>

        {/* Table Container */}
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <UserTable
            users={users}
            onEdit={handleEditOpen}
            onDeactivate={handleDeactivateOpen}
            onReactivate={handleReactivate}
            onResetPassword={handleResetPasswordOpen}
            onResendInvitation={handleResendInvitationOpen}
            onDelegate={handleDelegateOpen}
            onViewAudit={handleViewAuditOpen}
          />
        </div>
      </div>

      {/* Modals */}
      <UserFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        userToEdit={userToEdit}
        roles={roles}
        branches={branches}
        departments={departments}
        unlinkedEmployees={unlinkedEmployees}
        onSuccess={handleFormSaved}
      />

      <UserDeactivateDialog
        open={deactivateDialogOpen}
        onClose={() => setDeactivateDialogOpen(false)}
        user={userToDeactivate}
        onDeactivated={() => refreshData()}
      />

      <UserResetPasswordDialog
        open={resetPasswordDialogOpen}
        onClose={() => setResetPasswordDialogOpen(false)}
        user={userToResetPassword}
      />

      <UserResendInvitationDialog
        open={resendInvitationDialogOpen}
        onClose={() => setResendInvitationDialogOpen(false)}
        user={userToResendInvitation}
      />

      <UserDelegationDialog
        open={delegationDialogOpen}
        onClose={() => setDelegationDialogOpen(false)}
        user={userToDelegate}
        allUsers={users}
        onDelegationSaved={() => refreshData()}
      />

      <UserAuditModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        user={userForAudit}
      />
    </div>
  );
}
