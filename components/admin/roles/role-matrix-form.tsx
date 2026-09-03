"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { PermissionRow } from "@/lib/repositories/role.repository";
import { updateRolePermissionsAction } from "@/app/actions/role.actions";
import { useToast } from "@/components/ui/toast";
import { MODULE_CATEGORIES, ModuleType, ActionType } from "@/lib/types/role";
import { Card, CardContent } from "@/components/ui/card";
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
  Search,
  CheckCheck,
  Eye,
  SlidersHorizontal,
  FolderOpen,
  FolderClosed,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleMatrixFormProps {
  roleId: string;
  roleName: string;
  isSystemAdmin: boolean;
  isProtectedRole: boolean;
  allPermissions: PermissionRow[];
  currentPermissionIds: string[];
}

const ACTION_LABELS: Record<ActionType, { label: string; description: string }> = {
  VIEW: { label: "View", description: "View records, summaries, and details" },
  ADD: { label: "Create", description: "Create new master records or entries" },
  EDIT: { label: "Edit", description: "Modify existing records and values" },
  DELETE: { label: "Delete", description: "Delete or terminate records" },
  APPROVE: { label: "Approve", description: "Approve or reject workflow requests" },
  EXPORT: { label: "Export", description: "Export PDF, Excel, CSV, or IRD files" },
  LOCK: { label: "Lock", description: "Lock fiscal periods or finalized payroll" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterView, setFilterView] = useState<"all" | "granted" | "unassigned">("all");
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if initial currentPermissionIds changes (e.g. switching active role)
  useEffect(() => {
    setSelectedIds(new Set(currentPermissionIds));
    setSaveSuccess(false);
    setErrorMessage(null);
  }, [roleId, currentPermissionIds]);

  // Fast permission lookup map: `${module}:${action}` -> PermissionRow
  const permMap = useMemo(() => {
    const map = new Map<string, PermissionRow>();
    allPermissions.forEach((p) => {
      map.set(`${p.module}:${p.action}`, p);
    });
    return map;
  }, [allPermissions]);

  // Calculate diffs against current server-side permissions
  const initialSet = useMemo(() => new Set(currentPermissionIds), [currentPermissionIds]);
  const addedCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach((id) => {
      if (!initialSet.has(id)) count++;
    });
    return count;
  }, [selectedIds, initialSet]);

  const removedCount = useMemo(() => {
    let count = 0;
    initialSet.forEach((id) => {
      if (!selectedIds.has(id)) count++;
    });
    return count;
  }, [selectedIds, initialSet]);

  const hasUnsavedChanges = addedCount > 0 || removedCount > 0;

  const togglePermission = (module: ModuleType, action: ActionType) => {
    if (isSystemAdmin) return;

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

  // Module-level quick actions
  const grantAllInModule = (moduleKey: ModuleType, allowedActions: ActionType[]) => {
    if (isSystemAdmin) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allowedActions.forEach((act) => {
        const p = permMap.get(`${moduleKey}:${act}`);
        if (p) next.add(p.id);
      });
      return next;
    });
    setSaveSuccess(false);
  };

  const grantViewOnlyInModule = (moduleKey: ModuleType, allowedActions: ActionType[]) => {
    if (isSystemAdmin) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allowedActions.forEach((act) => {
        const p = permMap.get(`${moduleKey}:${act}`);
        if (p) {
          if (act === "VIEW") next.add(p.id);
          else next.delete(p.id);
        }
      });
      return next;
    });
    setSaveSuccess(false);
  };

  const clearAllInModule = (moduleKey: ModuleType, allowedActions: ActionType[]) => {
    if (isSystemAdmin) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allowedActions.forEach((act) => {
        const p = permMap.get(`${moduleKey}:${act}`);
        if (p) next.delete(p.id);
      });
      return next;
    });
    setSaveSuccess(false);
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const expandAll = () => setCollapsedCategories(new Set());
  const collapseAll = () =>
    setCollapsedCategories(new Set(MODULE_CATEGORIES.map((c) => c.id)));

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

  const grantAllCategoryView = (categoryId: string) => {
    if (isSystemAdmin) return;
    const cat = MODULE_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      cat.modules.forEach((mod) => {
        mod.allowedActions.forEach((act) => {
          const perm = permMap.get(`${mod.key}:${act}`);
          if (perm) {
            if (act === "VIEW") next.add(perm.id);
            else next.delete(perm.id);
          }
        });
      });
      return next;
    });
    setSaveSuccess(false);
  };

  // Bulk Master Actions
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

  const handleSave = useCallback(() => {
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
  }, [roleId, roleName, selectedIds, toast]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && !isPending && !isSystemAdmin) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, isPending, isSystemAdmin, handleSave]);

  // Filter modules based on search query & view filter
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return MODULE_CATEGORIES.map((cat) => {
      const matchedModules = cat.modules.filter((mod) => {
        // Query match
        const matchesQuery =
          !query ||
          mod.label.toLowerCase().includes(query) ||
          mod.description.toLowerCase().includes(query) ||
          cat.name.toLowerCase().includes(query);

        if (!matchesQuery) return false;

        // View filter match
        if (filterView === "all") return true;

        const hasAnyGranted = mod.allowedActions.some((act) => {
          const perm = permMap.get(`${mod.key}:${act}`);
          return perm && selectedIds.has(perm.id);
        });

        if (filterView === "granted") return hasAnyGranted;
        if (filterView === "unassigned") return !hasAnyGranted;

        return true;
      });

      return {
        ...cat,
        modules: matchedModules,
      };
    }).filter((cat) => cat.modules.length > 0);
  }, [searchQuery, filterView, permMap, selectedIds]);

  const totalPossiblePermissions = allPermissions.length;
  const activePermissionCount = selectedIds.size;
  const overallPercentage = Math.round(
    (activePermissionCount / (totalPossiblePermissions || 1)) * 100,
  );

  return (
    <div className="space-y-5 pb-24">
      {/* ── System Admin Full Access Notice ── */}
      {isSystemAdmin && (
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-payroll-light/40 border border-payroll-light text-payroll-navy shadow-payroll-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-payroll-primary text-white shadow-payroll-xs">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-payroll-navy">System Administrator Full Access</p>
            <p className="text-gray-600 mt-0.5">
              This system role possesses complete, unrestricted access across all 27 modules. Permissions are automatically granted and locked against manual tampering.
            </p>
          </div>
        </div>
      )}

      {/* ── Master Toolbar with Search, Filters & Bulk Actions ── */}
      {!isSystemAdmin && (
        <Card className="border-payroll-light/80 bg-white shadow-payroll-xs overflow-hidden">
          <CardContent className="p-4 space-y-4">
            {/* Top Toolbar Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search permissions by module name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-500 mr-1 flex items-center gap-1">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-payroll-primary" />
                  Filter:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterView("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                    filterView === "all"
                      ? "bg-payroll-primary text-white shadow-payroll-xs"
                      : "bg-payroll-cream text-gray-700 hover:bg-payroll-light/60",
                  )}
                >
                  All Modules
                </button>
                <button
                  type="button"
                  onClick={() => setFilterView("granted")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                    filterView === "granted"
                      ? "bg-payroll-primary text-white shadow-payroll-xs"
                      : "bg-payroll-cream text-gray-700 hover:bg-payroll-light/60",
                  )}
                >
                  Granted Only
                </button>
                <button
                  type="button"
                  onClick={() => setFilterView("unassigned")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                    filterView === "unassigned"
                      ? "bg-payroll-primary text-white shadow-payroll-xs"
                      : "bg-payroll-cream text-gray-700 hover:bg-payroll-light/60",
                  )}
                >
                  Unassigned
                </button>
              </div>

              {/* Expand / Collapse All */}
              <div className="flex items-center gap-1.5 border-l border-payroll-light/80 pl-3">
                <button
                  type="button"
                  onClick={expandAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-gray-600 hover:bg-payroll-cream transition-colors cursor-pointer"
                  title="Expand all categories"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-payroll-primary" />
                  <span>Expand All</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-gray-600 hover:bg-payroll-cream transition-colors cursor-pointer"
                  title="Collapse all categories"
                >
                  <FolderClosed className="h-3.5 w-3.5 text-gray-500" />
                  <span>Collapse All</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Quick Bulk Presets & Global Progress Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-payroll-light/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-payroll-navy flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-payroll-primary" />
                  Global Presets:
                </span>
                <button
                  type="button"
                  onClick={grantAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-navy cursor-pointer transition-all shadow-payroll-xs"
                >
                  Grant All (Full Access)
                </button>
                <button
                  type="button"
                  onClick={grantAllView}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-primary cursor-pointer transition-all shadow-payroll-xs"
                >
                  Read-Only (View All)
                </button>
                <button
                  type="button"
                  onClick={revokeAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 cursor-pointer transition-all shadow-payroll-xs"
                >
                  Clear All
                </button>
              </div>

              {/* Progress Summary Pill */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-gray-500 font-medium">
                    Allocated:{" "}
                    <strong className="text-payroll-navy font-bold">
                      {activePermissionCount}
                    </strong>{" "}
                    / {totalPossiblePermissions} ({overallPercentage}%)
                  </span>
                </div>
                <div className="w-24 h-2 bg-payroll-light/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-payroll-primary rounded-full transition-all duration-300"
                    style={{ width: `${overallPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Categorized Permission Matrix Accordions ── */}
      <div className="space-y-3.5">
        {filteredCategories.length === 0 ? (
          <Card className="p-8 text-center border-payroll-light bg-white">
            <p className="text-xs text-gray-500">
              No permission modules match your search query or filter.
            </p>
          </Card>
        ) : (
          filteredCategories.map((category) => {
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
            const catPercentage =
              totalCatPerms > 0
                ? Math.round((selectedCatPerms / totalCatPerms) * 100)
                : 0;

            return (
              <Card
                key={category.id}
                className="border-payroll-light/80 shadow-payroll-xs overflow-hidden bg-white transition-all duration-150"
              >
                {/* Category Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-payroll-cream/50 border-b border-payroll-light/60 gap-3">
                  <div
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
                  >
                    <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-white border border-payroll-light/80 text-payroll-primary shadow-payroll-xs">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-payroll-navy truncate">
                          {category.name}
                        </h4>
                        <Badge
                          variant={selectedCatPerms > 0 ? "success" : "neutral"}
                          size="sm"
                        >
                          {selectedCatPerms}/{totalCatPerms} Enabled ({catPercentage}%)
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-xl">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Category Action Controls */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {!isSystemAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleAllInCategory(category.id, !isFullySelected)}
                          className={cn(
                            "text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-payroll-xs",
                            isFullySelected
                              ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100",
                          )}
                        >
                          {isFullySelected ? "Clear Domain" : "Select All in Domain"}
                        </button>
                        <button
                          type="button"
                          onClick={() => grantAllCategoryView(category.id)}
                          className="text-[11px] font-bold px-2 py-1 rounded-lg border border-payroll-light bg-white hover:bg-payroll-cream text-payroll-navy transition-colors cursor-pointer shadow-payroll-xs"
                          title="Set entire domain to View Only"
                        >
                          View Only
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-payroll-navy hover:bg-payroll-light/60 transition-colors cursor-pointer"
                      aria-label="Toggle Category"
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
                  <div className="divide-y divide-payroll-light/40">
                    {category.modules.map((mod) => {
                      const modPermCount = mod.allowedActions.length;
                      const modGrantedCount = mod.allowedActions.filter((act) => {
                        const perm = permMap.get(`${mod.key}:${act}`);
                        return perm && (selectedIds.has(perm.id) || isSystemAdmin);
                      }).length;

                      const isModFull = modGrantedCount === modPermCount;
                      const isModViewOnly =
                        modGrantedCount === 1 &&
                        mod.allowedActions.includes("VIEW") &&
                        selectedIds.has(permMap.get(`${mod.key}:VIEW`)?.id || "");

                      return (
                        <div
                          key={mod.key}
                          className="p-3.5 sm:p-4 hover:bg-payroll-cream/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          {/* Module Name & Details */}
                          <div className="space-y-0.5 md:w-5/12 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-payroll-navy">
                                {mod.label}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                ({modGrantedCount}/{modPermCount})
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                              {mod.description}
                            </p>
                          </div>

                          {/* Action Permission Toggle Chips */}
                          <div className="flex items-center gap-2 flex-wrap md:flex-1">
                            {mod.allowedActions.map((action) => {
                              const perm = permMap.get(`${mod.key}:${action}`);
                              const isSelected = perm
                                ? selectedIds.has(perm.id) || isSystemAdmin
                                : false;
                              const meta = ACTION_LABELS[action];

                              return (
                                <button
                                  key={action}
                                  type="button"
                                  disabled={isSystemAdmin || !perm}
                                  onClick={() => togglePermission(mod.key, action)}
                                  title={`${meta.label}: ${meta.description}`}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] border transition-all select-none cursor-pointer active:scale-[0.97]",
                                    isSelected
                                      ? "bg-payroll-primary border-payroll-primary text-white shadow-payroll-xs"
                                      : "border-payroll-light/80 bg-white text-gray-600 hover:border-payroll-primary/40 hover:bg-payroll-cream/50",
                                    isSystemAdmin && "cursor-default opacity-90",
                                  )}
                                >
                                  {isSelected ? (
                                    <Check className="h-3 w-3 stroke-3 text-white" />
                                  ) : (
                                    <X className="h-3 w-3 stroke-2 text-gray-300" />
                                  )}
                                  <span>{meta.label}</span>
                                </button>
                              );
                            })}

                            {/* Quick Module Shortcuts */}
                            {!isSystemAdmin && modPermCount > 1 && (
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isModFull
                                      ? clearAllInModule(mod.key, mod.allowedActions)
                                      : grantAllInModule(mod.key, mod.allowedActions)
                                  }
                                  className="text-[10px] text-gray-400 hover:text-payroll-primary font-semibold underline underline-offset-2 cursor-pointer"
                                >
                                  {isModFull ? "Clear" : "All"}
                                </button>
                                <span className="text-gray-300 text-[10px]">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    grantViewOnlyInModule(mod.key, mod.allowedActions)
                                  }
                                  className="text-[10px] text-gray-400 hover:text-payroll-primary font-semibold underline underline-offset-2 cursor-pointer"
                                >
                                  View
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* ── Sticky Save Bar (Enhanced with exact Diff Counter & Save Shortcut) ── */}
      {!isSystemAdmin && (
        <div
          className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] p-3.5 sm:p-4 rounded-2xl border shadow-payroll-lg backdrop-blur-md transition-all duration-300",
            hasUnsavedChanges
              ? "bg-payroll-navy/95 border-payroll-light/40 text-white translate-y-0 opacity-100"
              : "translate-y-16 opacity-0 pointer-events-none",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  Unsaved changes for &ldquo;{roleName}&rdquo;
                </p>
                <p className="text-[11px] text-gray-300">
                  {addedCount > 0 && <span className="text-emerald-400 font-bold">+{addedCount} added </span>}
                  {removedCount > 0 && <span className="text-rose-400 font-bold">-{removedCount} removed </span>}
                  <span className="text-gray-400">(Press Ctrl+S to save)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="subtle"
                size="sm"
                onClick={resetToOriginal}
                disabled={isPending}
                className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={isPending}
                disabled={isPending}
                className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold text-xs shadow-payroll-sm"
              >
                Save Matrix
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Toast Banners ── */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-payroll-primary text-white shadow-payroll-lg text-xs font-bold animate-[slideInUp_150ms_ease-out]">
          <CheckCircle2 className="h-4 w-4" />
          <span>Permissions saved successfully for &ldquo;{roleName}&rdquo;!</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-rose-600 text-white shadow-payroll-lg text-xs font-bold animate-[slideInUp_150ms_ease-out]">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
