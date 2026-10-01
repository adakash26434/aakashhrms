"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RoleWithStats,
  PermissionRow,
} from "@/lib/repositories/role.repository";
import { PermissionChangeLogEntry } from "@/lib/types/audit";
import RoleMatrixForm from "./role-matrix-form";
import { CreateRoleDialog } from "./create-role-dialog";
import { CloneRoleDialog } from "./clone-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import { AssignUsersDialog } from "./assign-users-dialog";
import { PermissionChangeTable } from "@/components/admin/audit/permission-change-table";
import { deleteRoleAction } from "@/app/actions/role.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Shield,
  Users,
  Building2,
  User,
  UserPlus,
  Globe,
  History,
  Plus,
  Copy,
  Edit3,
  Trash2,
  Search,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { ScopeType } from "@/lib/types/role";
import { cn } from "@/lib/utils";

interface RoleClientProps {
  roles: RoleWithStats[];
  allPermissions: PermissionRow[];
  rolePermissionsMap: Record<string, string[]>;
  permissionChangeLogs?: PermissionChangeLogEntry[];
}

const SCOPE_META: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    variant: "info" | "success" | "warning" | "neutral";
  }
> = {
  GLOBAL: { label: "Global", icon: Globe, variant: "info" },
  BRANCH: { label: "Branch", icon: Building2, variant: "success" },
  DEPARTMENT: { label: "Department", icon: Users, variant: "warning" },
  SELF: { label: "Self Only", icon: User, variant: "neutral" },
};

export default function RoleClient({
  roles,
  allPermissions,
  rolePermissionsMap,
  permissionChangeLogs = [],
}: RoleClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"matrix" | "history">("matrix");
  const [activeRoleId, setActiveRoleId] = useState<string>(roles[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignUsersOpen, setAssignUsersOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];
  const isSystemAdmin =
    activeRole?.isSystemRole && activeRole?.slug === "system_admin";
  const isProtectedRole =
    activeRole?.isSystemRole || activeRole?.isProtected || false;
  const scope =
    SCOPE_META[activeRole?.scopeType || "GLOBAL"] || SCOPE_META.GLOBAL;
  const ScopeIcon = scope.icon;

  const toast = useToast();

  const handleDeleteRole = () => {
    if (!activeRole) return;
    setDeleteError(null);
    const roleName = activeRole.name;
    startDeleteTransition(async () => {
      const res = await deleteRoleAction(activeRole.id);
      if (res.success) {
        setDeleteConfirmOpen(false);
        toast.success(`Role "${roleName}" deleted successfully.`);
        const remaining = roles.filter((r) => r.id !== activeRole.id);
        if (remaining.length > 0) {
          setActiveRoleId(remaining[0].id);
        }
      } else {
        const msg = res.error || "Failed to delete role.";
        setDeleteError(msg);
        toast.error(msg);
      }
    });
  };

  if (!roles.length) {
    return (
      <Card className="border-payroll-light shadow-payroll-xs">
        <CardContent className="py-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-payroll-navy text-lg font-bold">No roles found</p>
          <p className="text-gray-500 text-xs mt-1">Create your first organizational role to get started.</p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="mt-4 bg-payroll-primary hover:bg-payroll-primary-hover text-white shadow-payroll-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Role
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Navigation Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1 border-b border-zinc-200/60">
        {/* Tab switchers */}
        <div className="inline-flex items-center p-1 rounded-lg border border-zinc-200/70 bg-zinc-50/80">
          <button
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer select-none",
              activeTab === "matrix"
                ? "bg-white text-emerald-950 shadow-2xs border border-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60",
            )}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-700" />
              <span>Permission Matrix</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer select-none",
              activeTab === "history"
                ? "bg-white text-emerald-950 shadow-2xs border border-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/60",
            )}
          >
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-zinc-500" />
              <span>Change History ({permissionChangeLogs.length})</span>
            </div>
          </button>
        </div>

        {/* Create Role Trigger */}
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs px-3.5 py-2 rounded-lg"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Create Custom Role</span>
        </Button>
      </div>

      {activeTab === "matrix" ? (
        <div className="space-y-5">
          {/* ── Role Selector Bar with Search & Refined Chips ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Select Organizational Role
              </span>
              {roles.length > 5 && (
                <div className="relative max-w-xs">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    placeholder="Filter roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 pl-8 pr-2.5 py-1 text-xs rounded-md border border-zinc-200/80 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filteredRoles.map((role) => {
                const isActive = role.id === activeRoleId;
                const isSys = role.isSystemRole || role.isProtected;
                const rScope = SCOPE_META[role.scopeType] || SCOPE_META.GLOBAL;
                const RScopeIcon = rScope.icon;

                return (
                  <button
                    key={role.id}
                    onClick={() => setActiveRoleId(role.id)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer border select-none text-xs",
                      isActive
                        ? "bg-emerald-950 border-emerald-950 text-white shadow-xs font-semibold"
                        : "bg-white border-zinc-200/80 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50/70 font-medium",
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate max-w-44">{role.name}</span>
                      {isSys && (
                        <Lock
                          className={cn(
                            "h-3 w-3 shrink-0",
                            isActive ? "text-emerald-300" : "text-zinc-400",
                          )}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-zinc-200/40">
                      <span
                        className={cn(
                          "text-[10px] inline-flex items-center gap-0.5",
                          isActive ? "text-emerald-300" : "text-zinc-500",
                        )}
                      >
                        <RScopeIcon className="h-2.5 w-2.5" />
                        {rScope.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded font-mono font-medium",
                          isActive
                            ? "bg-white/15 text-white"
                            : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {role.userCount}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Active Role Control Header ── */}
          {activeRole && (
            <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950">
                    {activeRole.name}
                  </h3>
                  <Badge variant={scope.variant} size="sm">
                    <ScopeIcon className="h-3 w-3 mr-1" />
                    <span>{scope.label} Scope</span>
                  </Badge>
                  {activeRole.isProtected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                      <Lock className="h-2.5 w-2.5" /> System Protected
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      Custom Role
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 max-w-2xl leading-relaxed">
                  {activeRole.description ||
                    "No custom description configured for this role."}
                </p>
              </div>

              {/* Role Actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignUsersOpen(true)}
                  className="text-xs border-emerald-300 bg-white text-emerald-950 hover:bg-emerald-50/80 font-medium shadow-2xs"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1 text-emerald-700" />
                  <span>Assign Users ({activeRole.userCount})</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCloneDialogOpen(true)}
                  className="text-xs border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-medium"
                >
                  <Copy className="h-3.5 w-3.5 mr-1 text-zinc-500" />
                  <span>Clone</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="text-xs border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-medium"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1 text-zinc-500" />
                  <span>Edit</span>
                </Button>

                {!isProtectedRole && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200/60 font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Role Permission Matrix Form ── */}
          {activeRole && (
            <RoleMatrixForm
              key={activeRole.id}
              roleId={activeRole.id}
              roleName={activeRole.name}
              isSystemAdmin={isSystemAdmin}
              isProtectedRole={isProtectedRole}
              allPermissions={allPermissions}
              currentPermissionIds={rolePermissionsMap[activeRole.id] || []}
            />
          )}
        </div>
      ) : (
        /* ── Permission Change History Tab ── */
        <PermissionChangeTable logs={permissionChangeLogs} />
      )}

      {/* ── Modal Dialogs ── */}
      <CreateRoleDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        allPermissions={allPermissions}
        onSuccess={(newId) => {
          setActiveRoleId(newId);
        }}
      />

      {activeRole && (
        <>
          <CloneRoleDialog
            open={cloneDialogOpen}
            onClose={() => setCloneDialogOpen(false)}
            sourceRoleId={activeRole.id}
            sourceRoleName={activeRole.name}
            sourceScope={activeRole.scopeType as ScopeType}
            onSuccess={(newId) => {
              setActiveRoleId(newId);
            }}
          />

          <EditRoleDialog
            open={editDialogOpen}
            onClose={() => setEditDialogOpen(false)}
            roleId={activeRole.id}
            roleName={activeRole.name}
            roleScope={activeRole.scopeType as ScopeType}
            roleDescription={activeRole.description}
            isSystemRole={activeRole.isSystemRole}
            isProtected={activeRole.isProtected}
            onSuccess={() => {}}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            title="Delete Custom Role"
            description={`Are you sure you want to permanently delete the role "${activeRole.name}"?`}
            footer={
              <div className="flex items-center justify-end gap-2.5 w-full">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteRole}
                  isLoading={isDeleting}
                  disabled={isDeleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  <span>Delete Role</span>
                </Button>
              </div>
            }
          >
            <div className="space-y-3 py-2">
              {deleteError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <p className="text-xs text-gray-600 leading-relaxed">
                This action cannot be undone. All assigned permissions for this custom role will be permanently removed.
              </p>
              {activeRole.userCount > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> {activeRole.userCount} active
                    user(s) are currently assigned to this role. Please reassign these
                    users to another role before deleting.
                  </span>
                </div>
              )}
            </div>
          </Dialog>

          {/* Assign Users Dialog */}
          <AssignUsersDialog
            open={assignUsersOpen}
            onClose={() => setAssignUsersOpen(false)}
            roleId={activeRole.id}
            roleName={activeRole.name}
            onSuccess={() => {
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}
