"use client";

import { useState, useTransition } from "react";
import { PermissionRow } from "@/lib/repositories/role.repository";
import { updateRolePermissionsAction } from "@/app/actions/role.actions";
import { useToast } from "@/components/ui/toast";
import { MODULE_CATEGORIES, ModuleType, ActionType } from "@/lib/types/role";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Check,
  X,
  AlertCircle,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

interface RoleMatrixFormProps {
  roleId: string;
  roleName: string;
  isSystemAdmin: boolean;
  isProtectedRole: boolean;
  allPermissions: PermissionRow[];
  currentPermissionIds: string[];
}

const ACTION_COLORS: Record<
  ActionType,
  { active: string; text: string; bg: string }
> = {
  VIEW: {
    active: "bg-blue-600 border-blue-600 text-white",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  ADD: {
    active: "bg-emerald-600 border-emerald-600 text-white",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  EDIT: {
    active: "bg-amber-600 border-amber-600 text-white",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  DELETE: {
    active: "bg-rose-600 border-rose-600 text-white",
    text: "text-rose-700",
    bg: "bg-rose-50",
  },
  APPROVE: {
    active: "bg-purple-600 border-purple-600 text-white",
    text: "text-purple-700",
    bg: "bg-purple-50",
  },
  EXPORT: {
    active: "bg-teal-600 border-teal-600 text-white",
    text: "text-teal-700",
    bg: "bg-teal-50",
  },
  LOCK: {
    active: "bg-indigo-600 border-indigo-600 text-white",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
  },
};

export default function RoleMatrixForm({
  roleId,
  roleName,
  isSystemAdmin,
  isProtectedRole,
  allPermissions,
  currentPermissionIds,
}: RoleMatrixFormProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(currentPermissionIds),
  );
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fast permission lookup map: `${module}:${action}` -> PermissionRow
  const permMap = new Map<string, PermissionRow>();
  allPermissions.forEach((p) => {
    permMap.set(`${p.module}:${p.action}`, p);
  });

  const hasUnsavedChanges = (() => {
    if (selectedIds.size !== currentPermissionIds.length) return true;
    for (const id of currentPermissionIds) {
      if (!selectedIds.has(id)) return true;
    }
    return false;
  })();

  const togglePermission = (module: ModuleType, action: ActionType) => {
    if (isSystemAdmin) return; // Superadmin has immutable full access

    const perm = permMap.get(`${module}:${action}`);
    if (!perm) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(perm.id)) {
        next.delete(perm.id);
      } else {
        next.add(perm.id);
        // Automatically grant VIEW if adding mutation permissions
        if (action !== "VIEW") {
          const viewPerm = permMap.get(`${module}:VIEW`);
          if (viewPerm) next.add(viewPerm.id);
        }
      }
      return next;
    });
    setSaveSuccess(false);
    setErrorMessage(null);
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleAllInCategory = (categoryId: string, grant: boolean) => {
    if (isSystemAdmin) return;
    const cat = MODULE_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      cat.modules.forEach((mod) => {
        mod.allowedActions.forEach((act) => {
          const perm = permMap.get(`${mod.key}:${act}`);
          if (perm) {
            if (grant) next.add(perm.id);
            else next.delete(perm.id);
          }
        });
      });
      return next;
    });
    setSaveSuccess(false);
  };

  const grantAll = () => {
    if (isSystemAdmin) return;
    const all = new Set(allPermissions.map((p) => p.id));
    setSelectedIds(all);
    setSaveSuccess(false);
  };

  const revokeAll = () => {
    if (isSystemAdmin) return;
    setSelectedIds(new Set());
    setSaveSuccess(false);
  };

  const grantAllView = () => {
    if (isSystemAdmin) return;
    const viewOnly = new Set(
      allPermissions.filter((p) => p.action === "VIEW").map((p) => p.id),
    );
    setSelectedIds(viewOnly);
    setSaveSuccess(false);
  };

  const resetToOriginal = () => {
    setSelectedIds(new Set(currentPermissionIds));
    setSaveSuccess(false);
    setErrorMessage(null);
  };

  const toast = useToast();

  const handleSave = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateRolePermissionsAction(
        roleId,
        Array.from(selectedIds),
      );
      if (res.success) {
        setSaveSuccess(true);
        toast.success(`Permissions for role "${roleName}" saved successfully!`);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const msg = res.error || "Failed to update permissions.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── System Admin Full Access Notice ── */}
      {isSystemAdmin && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">System Administrator Access</p>
            <p className="text-emerald-700 mt-0.5">
              This system role has absolute administrative privileges across all
              25 modules. Permissions are automatically granted and locked.
            </p>
          </div>
        </div>
      )}

      {/* ── Master Quick Action Toolbar ── */}
      {!isSystemAdmin && (
        <Card className="border-gray-200 shadow-sm bg-[#fbfdfb]">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-payroll-primary" />
                Bulk Actions:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={grantAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer transition-all"
                >
                  Select All (Full Access)
                </button>
                <button
                  type="button"
                  onClick={grantAllView}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-blue-700 cursor-pointer transition-all"
                >
                  Select All VIEW Only
                </button>
                <button
                  type="button"
                  onClick={revokeAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-rose-50 text-rose-700 cursor-pointer transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                Active Permissions:{" "}
                <strong className="text-gray-900 font-bold">
                  {selectedIds.size}
                </strong>{" "}
                of {allPermissions.length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Categorized Permission Matrix ── */}
      <div className="space-y-4">
        {MODULE_CATEGORIES.map((category) => {
          const isCollapsed = collapsedCategories.has(category.id);

          // Calculate category permission stats
          let totalCatPerms = 0;
          let selectedCatPerms = 0;
          category.modules.forEach((mod) => {
            mod.allowedActions.forEach((act) => {
              totalCatPerms++;
              const perm = permMap.get(`${mod.key}:${act}`);
              if (perm && selectedIds.has(perm.id)) {
                selectedCatPerms++;
              }
            });
          });

          const isFullySelected =
            selectedCatPerms === totalCatPerms && totalCatPerms > 0;

          return (
            <Card
              key={category.id}
              className="border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Category Header Bar */}
              <div className="flex items-center justify-between p-4 bg-gray-50/80 border-b border-gray-100">
                <div
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-3 cursor-pointer select-none flex-1"
                >
                  <div className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-700">
                    <Layers className="h-4 w-4 text-payroll-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">
                        {category.name}
                      </h4>
                      <Badge
                        variant={selectedCatPerms > 0 ? "success" : "default"}
                        className="text-[10px] py-0 px-2"
                      >
                        {selectedCatPerms}/{totalCatPerms} Enabled
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isSystemAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleAllInCategory(category.id, !isFullySelected)
                      }
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isFullySelected
                          ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {isFullySelected
                        ? "Clear Domain"
                        : "Select All in Domain"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 cursor-pointer"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Module Table Body */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-gray-500">
                        <th className="py-3 px-4 font-semibold w-1/3">
                          Module Name
                        </th>
                        <th className="py-3 px-4 font-semibold">
                          Available Actions & Permissions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {category.modules.map((mod) => {
                        return (
                          <tr
                            key={mod.key}
                            className="hover:bg-gray-50/60 transition-colors"
                          >
                            <td className="py-3.5 px-4 align-top">
                              <span className="font-bold text-gray-900 block text-xs">
                                {mod.label}
                              </span>
                              <span className="text-[11px] text-gray-500 mt-0.5 block">
                                {mod.description}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <div className="flex items-center gap-2 flex-wrap">
                                {mod.allowedActions.map((action) => {
                                  const perm = permMap.get(
                                    `${mod.key}:${action}`,
                                  );
                                  const isSelected = perm
                                    ? selectedIds.has(perm.id) || isSystemAdmin
                                    : false;
                                  const color = ACTION_COLORS[action];

                                  return (
                                    <button
                                      key={action}
                                      type="button"
                                      disabled={isSystemAdmin || !perm}
                                      onClick={() =>
                                        togglePermission(mod.key, action)
                                      }
                                      className={`
                                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all select-none
                                        ${
                                          isSelected
                                            ? `${color.active} shadow-sm ring-1 ring-black/5`
                                            : "border-gray-200 bg-gray-50/50 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                                        }
                                        ${isSystemAdmin ? "cursor-default opacity-90" : "cursor-pointer"}
                                      `}
                                    >
                                      {isSelected ? (
                                        <Check className="h-3 w-3 stroke-3" />
                                      ) : (
                                        <X className="h-3 w-3 stroke-2 opacity-40" />
                                      )}
                                      <span>{action}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Sticky Save Bar (Triggers when unsaved changes exist) ── */}
      {!isSystemAdmin && (
        <div
          className={`
            fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300
            ${
              hasUnsavedChanges
                ? "bg-gray-900/95 border-gray-700 text-white translate-y-0 opacity-100"
                : "translate-y-12 opacity-0 pointer-events-none"
            }
          `}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <span className="text-xs font-semibold">
                Unsaved permission changes for {roleName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToOriginal}
                disabled={isPending}
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
                className="bg-payroll-primary hover:bg-[#256629] text-white font-bold text-xs"
              >
                {isPending ? "Saving..." : "Save Permission Matrix"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Banners ── */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-emerald-600 text-white shadow-lg text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4" />
          <span>Permissions saved successfully for {roleName}!</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-rose-600 text-white shadow-lg text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
