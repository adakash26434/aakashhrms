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
    variant: "info" | "success" | "warning" | "default";
  }
> = {
  GLOBAL: { label: "Global", icon: Globe, variant: "info" },
  BRANCH: { label: "Branch", icon: Building2, variant: "success" },
  DEPARTMENT: { label: "Department", icon: Users, variant: "warning" },
  SELF: { label: "Self Only", icon: User, variant: "default" },
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
        // Switch to first role
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
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium">No roles found</p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="mt-4 bg-payroll-primary hover:bg-[#256629] text-white"
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
        <div className="flex items-center gap-2 bg-payroll-cream p-1.5 rounded-xl border border-payroll-light w-fit">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "matrix"
                ? "bg-payroll-primary text-white shadow-sm"
                : "text-gray-600 hover:text-payroll-navy"
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Permission Matrix</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-payroll-primary text-white shadow-sm"
                : "text-gray-600 hover:text-payroll-navy"
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>
                Permission Change History ({permissionChangeLogs.length})
              </span>
            </div>
          </button>
        </div>

        {/* Create Role Trigger */}
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-payroll-primary hover:bg-[#256629] text-white font-semibold text-xs shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Custom Role
        </Button>
      </div>

      {activeTab === "matrix" ? (
        <div className="space-y-6">
          {/* ── Role Selector Bar with Search & Badges ── */}
          <div className="space-y-3">
            {roles.length > 5 && (
              <div className="relative max-w-xs">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-payroll-primary"
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
                    className={`
                      inline-flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-150 cursor-pointer border select-none
                      ${
                        isActive
                          ? "bg-payroll-primary border-payroll-primary text-white shadow-md shadow-payroll-primary/10 ring-2 ring-payroll-primary/20"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50/80"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Shield
                        className={`h-4 w-4 ${isActive ? "text-white" : "text-payroll-primary"}`}
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">{role.name}</span>
                          {isSys && (
                            <span title="System Role">
                              <Lock
                                className={`h-3 w-3 ${isActive ? "text-emerald-200" : "text-gray-400"}`}
                              />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] inline-flex items-center gap-1 font-medium ${
                              isActive ? "text-emerald-100" : "text-gray-500"
                            }`}
                          >
                            <RScopeIcon className="h-3 w-3" />
                            {rScope.label}
                          </span>
                          <span
                            className={`text-[10px] ${isActive ? "text-emerald-200" : "text-gray-400"}`}
                          >
                            •
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${isActive ? "text-white" : "text-gray-600"}`}
                          >
                            {role.userCount}{" "}
                            {role.userCount === 1 ? "user" : "users"}
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
            <Card className="border-gray-200 shadow-sm bg-white">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900">
                      {activeRole.name}
                    </h3>
                    <Badge
                      variant={scope.variant}
                      className="text-[11px] py-0.5 px-2.5 flex items-center gap-1"
                    >
                      <ScopeIcon className="h-3 w-3" />
                      <span>{scope.label} Scope</span>
                    </Badge>
                    {activeRole.isProtected ? (
                      <Badge
                        variant="warning"
                        className="text-[10px] py-0.5 px-2"
                      >
                        System Protected
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-[10px] py-0.5 px-2"
                      >
                        Custom Role
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 max-w-2xl">
                    {activeRole.description ||
                      "No description provided for this role."}
                  </p>
                </div>

                {/* Role Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneDialogOpen(true)}
                    className="text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    Clone Role
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditDialogOpen(true)}
                    className="text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    Edit Role
                  </Button>

                  {!isProtectedRole && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete Role
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
                  disabled={isDeleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Role</span>
                    </div>
                  )}
                </Button>
              </div>
            }
          >
            <div className="space-y-3 py-2">
              {deleteError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <p className="text-xs text-gray-600 leading-relaxed">
                This action cannot be undone. All assigned permissions will be
                permanently removed.
              </p>
              {activeRole.userCount > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> {activeRole.userCount} active
                    user(s) are assigned to this role. You must reassign these
                    users before this role can be deleted.
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
