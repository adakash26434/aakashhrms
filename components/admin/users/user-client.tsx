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

      {/* KPI Stat Cards (Top Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2e7d32]/15 text-[#2e7d32]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Users</p>
            <p className="text-2xl font-bold text-[#1b3a1f]">{kpis.total}</p>
          </div>
        </Card>

        {/* Active Users */}
        <Card className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Users</p>
            <p className="text-2xl font-bold text-emerald-700">{kpis.active}</p>
          </div>
        </Card>

        {/* Inactive Users */}
        <Card className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inactive Users</p>
            <p className="text-2xl font-bold text-gray-700">{kpis.inactive}</p>
          </div>
        </Card>

        {/* Linked to Employee */}
        <Card className="p-4 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Employees</p>
            <p className="text-2xl font-bold text-green-700">{kpis.linkedToEmployee}</p>
          </div>
        </Card>
      </div>

      {/* Filters & Actions Header */}
      <Card className="p-4 overflow-visible">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Filters Bar */}
          <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
            {/* Search Input */}
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search user by name, email, code..."
                value={search}
                onChange={(e) => handleFilterChange(e.target.value, roleIdFilter, statusFilter)}
                className="w-full rounded-lg border border-[#d7e8d0] bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleIdFilter}
              onChange={(e) => handleFilterChange(search, e.target.value, statusFilter)}
              className="rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
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
              className="rounded-lg border border-[#d7e8d0] bg-white px-3 py-2 text-sm text-[#1b3a1f] outline-none focus:border-[#2e7d32]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Add User Button */}
          <Button onClick={handleCreateOpen} className="shrink-0 gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Add User</span>
          </Button>
        </div>

        {/* Table Container */}
        <div className="mt-4 border-t border-[#d7e8d0]/60 pt-4">
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
      </Card>

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
