"use client";

import { useState, useTransition } from "react";
import {
  RoleWithStats,
  PermissionRow,
} from "@/lib/repositories/role.repository";
import { PermissionChangeLogEntry } from "@/lib/types/audit";
import RoleMatrixForm from "./role-matrix-form";
import { CreateRoleDialog } from "./create-role-dialog";
import { CloneRoleDialog } from "./clone-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
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
  const [activeTab, setActiveTab] = useState<"matrix" | "history">("matrix");
  const [activeRoleId, setActiveRoleId] = useState<string>(roles[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-payroll-light/80 shadow-payroll-xs">
          <button
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer select-none",
              activeTab === "matrix"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:text-payroll-navy hover:bg-payroll-cream",
            )}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Permission Matrix</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer select-none",
              activeTab === "history"
                ? "bg-payroll-primary text-white shadow-payroll-xs"
                : "text-gray-600 hover:text-payroll-navy hover:bg-payroll-cream",
            )}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>
                Change History ({permissionChangeLogs.length})
              </span>
            </div>
          </button>
        </div>

        {/* Create Role Trigger */}
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Create Custom Role</span>
        </Button>
      </div>

      {activeTab === "matrix" ? (
        <div className="space-y-5">
          {/* ── Role Selector Bar with Search & Badges ── */}
          <div className="space-y-3">
            {roles.length > 5 && (
              <div className="relative max-w-xs">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Filter roles list..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary shadow-payroll-xs"
                />
              </div>
            )}

            <div className="flex items-center gap-2.5 flex-wrap">
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
                      "inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all duration-150 cursor-pointer border select-none text-left shadow-payroll-xs",
                      isActive
                        ? "bg-payroll-primary border-payroll-primary text-white shadow-payroll-sm ring-2 ring-payroll-primary/25"
                        : "bg-white border-payroll-light/80 text-payroll-navy hover:border-payroll-primary/40 hover:bg-payroll-cream/50",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-payroll-cream text-payroll-primary border border-payroll-light",
                        )}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate max-w-44">{role.name}</span>
                          {isSys && (
                            <span title="System Protected Role">
                              <Lock
                                className={cn(
                                  "h-3 w-3",
                                  isActive ? "text-emerald-200" : "text-gray-400",
                                )}
                              />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={cn(
                              "text-[10px] inline-flex items-center gap-1 font-semibold",
                              isActive ? "text-emerald-100" : "text-gray-500",
                            )}
                          >
                            <RScopeIcon className="h-3 w-3" />
                            {rScope.label}
                          </span>
                          <span
                            className={cn(
                              "text-[10px]",
                              isActive ? "text-emerald-200" : "text-gray-300",
                            )}
                          >
                            •
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              isActive ? "text-white" : "text-gray-500",
                            )}
                          >
                            {role.userCount} {role.userCount === 1 ? "user" : "users"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Active Role Control Toolbar ── */}
          {activeRole && (
            <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
              <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-payroll-navy">
                      {activeRole.name}
                    </h3>
                    <Badge variant={scope.variant} size="sm">
                      <ScopeIcon className="h-3 w-3 mr-1" />
                      <span>{scope.label} Scope</span>
                    </Badge>
                    {activeRole.isProtected ? (
                      <Badge variant="warning" size="sm">
                        System Protected
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Custom Role
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
                    {activeRole.description ||
                      "No custom description configured for this role."}
                  </p>
                </div>

                {/* Role Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneDialogOpen(true)}
                    className="text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1 text-payroll-primary" />
                    <span>Clone</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                    className="text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1 text-payroll-primary" />
                    <span>Edit</span>
                  </Button>

                  {!isProtectedRole && (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200/60"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                      <span>Delete</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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
        </>
      )}
    </div>
  );
}
