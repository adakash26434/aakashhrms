"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { PermissionRow } from "@/lib/repositories/role.repository";
import { updateRolePermissionsAction } from "@/app/actions/role.actions";
import { useToast } from "@/components/ui/toast";
import { MODULE_CATEGORIES, ModuleType, ActionType } from "@/lib/types/role";
import { ROLE_PERMISSION_PRESETS } from "@/lib/constants/role-presets";
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

  const applyPreset = (presetId: string) => {
    if (isSystemAdmin) return;
    const preset = ROLE_PERMISSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (preset.id === "read_only") {
      const viewOnly = new Set(
        allPermissions.filter((p) => p.action === "VIEW").map((p) => p.id),
      );
      setSelectedIds(viewOnly);
      setSaveSuccess(false);
      setErrorMessage(null);
      return;
    }

    const next = new Set<string>();
    preset.grants.forEach((g) => {
      const p = permMap.get(`${g.module}:${g.action}`);
      if (p) next.add(p.id);
    });
    setSelectedIds(next);
    setSaveSuccess(false);
    setErrorMessage(null);
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
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-900">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Shield className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-zinc-900">System Administrator Full Access</p>
            <p className="text-zinc-500 mt-0.5">
              This system role possesses complete, unrestricted access across all 27 modules. Permissions are automatically granted and locked against manual changes.
            </p>
          </div>
        </div>
      )}

      {/* ── Master Toolbar with Search, Filters & Bulk Actions ── */}
      {!isSystemAdmin && (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 space-y-4">
          {/* Quick Functional Presets & Global Progress Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-zinc-200/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5 mr-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                Quick Presets:
              </span>
              {ROLE_PERMISSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  title={preset.description}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200/80 bg-zinc-50 hover:bg-emerald-50 hover:text-emerald-950 hover:border-emerald-300 text-zinc-700 cursor-pointer transition-all"
                >
                  {preset.label}
                </button>
              ))}
              <span className="text-zinc-300 mx-1">|</span>
              <button
                type="button"
                onClick={grantAll}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-all"
              >
                All (Admin)
              </button>
              <button
                type="button"
                onClick={revokeAll}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 cursor-pointer transition-all"
              >
                Clear All
              </button>
            </div>

            {/* Progress Summary Pill */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-medium">
                Allocated:{" "}
                <strong className="text-zinc-900 font-bold">
                  {activePermissionCount}
                </strong>{" "}
                / {totalPossiblePermissions} ({overallPercentage}%)
              </span>
              <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/60">
                <div
                  className="h-full bg-emerald-700 rounded-full transition-all duration-300"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Search, Filter, and Accordion Controls Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
            {/* Search Box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                placeholder="Search modules by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-zinc-200/80 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 transition-all"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="inline-flex items-center p-0.5 rounded-lg border border-zinc-200/70 bg-zinc-50">
              <button
                type="button"
                onClick={() => setFilterView("all")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer select-none",
                  filterView === "all"
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                All Modules
              </button>
              <button
                type="button"
                onClick={() => setFilterView("granted")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer select-none",
                  filterView === "granted"
                    ? "bg-white text-emerald-950 shadow-2xs font-semibold"
                    : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                Granted Only
              </button>
              <button
                type="button"
                onClick={() => setFilterView("unassigned")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer select-none",
                  filterView === "unassigned"
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                Unassigned
              </button>
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Expand all categories"
              >
                <FolderOpen className="h-3.5 w-3.5 text-zinc-500" />
                <span>Expand All</span>
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Collapse all categories"
              >
                <FolderClosed className="h-3.5 w-3.5 text-zinc-500" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Categorized Permission Matrix Accordions ── */}
      <div className="space-y-3.5">
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-zinc-200/80 bg-white">
            <p className="text-xs text-zinc-500">
              No permission modules match your search query or filter.
            </p>
          </div>
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
              <div
                key={category.id}
                className="rounded-xl border border-zinc-200/80 overflow-hidden bg-white transition-all duration-150"
              >
                {/* Category Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-zinc-50/70 border-b border-zinc-200/60 gap-3">
                  <div
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-200/80 text-emerald-800">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-900 truncate">
                          {category.name}
                        </h4>
                        <span
                          className={cn(
                            "text-2xs font-semibold px-2 py-0.5 rounded-full border",
                            selectedCatPerms > 0
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                              : "bg-zinc-100 text-zinc-500 border-zinc-200",
                          )}
                        >
                          {selectedCatPerms}/{totalCatPerms} Enabled ({catPercentage}%)
                        </span>
                      </div>
                      <p className="text-2xs text-zinc-500 mt-0.5 truncate max-w-xl">
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
                            "text-2xs font-semibold px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                            isFullySelected
                              ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                              : "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
                          )}
                        >
                          {isFullySelected ? "Clear Domain" : "Select All in Domain"}
                        </button>
                        <button
                          type="button"
                          onClick={() => grantAllCategoryView(category.id)}
                          className="text-2xs font-semibold px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer"
                          title="Set entire domain to View Only"
                        >
                          View Only
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
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
                  <div className="divide-y divide-zinc-100">
                    {category.modules.map((mod) => {
                      const modPermCount = mod.allowedActions.length;
                      const modGrantedCount = mod.allowedActions.filter((act) => {
                        const perm = permMap.get(`${mod.key}:${act}`);
                        return perm && (selectedIds.has(perm.id) || isSystemAdmin);
                      }).length;

                      const isModFull = modGrantedCount === modPermCount;

                      return (
                        <div
                          key={mod.key}
                          className="p-3.5 sm:p-4 hover:bg-zinc-50/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          {/* Module Name & Details */}
                          <div className="space-y-0.5 md:w-5/12 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-900">
                                {mod.label}
                              </span>
                              <span className="text-2xs text-zinc-400 font-mono">
                                ({modGrantedCount}/{modPermCount})
                              </span>
                            </div>
                            <p className="text-2xs text-zinc-500 leading-relaxed">
                              {mod.description}
                            </p>
                          </div>

                          {/* Action Permission Toggle Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap md:flex-1">
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
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all select-none cursor-pointer",
                                    isSelected
                                      ? "bg-emerald-950 border-emerald-950 text-white shadow-2xs font-semibold"
                                      : "border-zinc-200/80 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
                                    isSystemAdmin && "cursor-default opacity-90",
                                  )}
                                >
                                  {isSelected ? (
                                    <Check className="h-3 w-3 stroke-2.5 text-emerald-300" />
                                  ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                                  )}
                                  <span>{meta.label}</span>
                                </button>
                              );
                            })}

                            {/* Quick Module Shortcuts */}
                            {!isSystemAdmin && modPermCount > 1 && (
                              <div className="flex items-center gap-1 ml-auto shrink-0 pl-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isModFull
                                      ? clearAllInModule(mod.key, mod.allowedActions)
                                      : grantAllInModule(mod.key, mod.allowedActions)
                                  }
                                  className="text-2xs text-zinc-400 hover:text-emerald-900 font-medium underline underline-offset-2 cursor-pointer"
                                >
                                  {isModFull ? "Clear" : "All"}
                                </button>
                                <span className="text-zinc-300 text-2xs">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    grantViewOnlyInModule(mod.key, mod.allowedActions)
                                  }
                                  className="text-2xs text-zinc-400 hover:text-emerald-900 font-medium underline underline-offset-2 cursor-pointer"
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
              </div>
            );
          })
        )}
      </div>

      {/* ── Sticky Save Bar (Enhanced with exact Diff Counter & Save Shortcut) ── */}
      {!isSystemAdmin && (
        <div
          className={cn(
            "fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] p-3.5 sm:p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300",
            hasUnsavedChanges
              ? "bg-zinc-950/95 border-zinc-800 text-white translate-y-0 opacity-100"
              : "translate-y-16 opacity-0 pointer-events-none",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  Unsaved changes for &ldquo;{roleName}&rdquo;
                </p>
                <p className="text-2xs text-zinc-400">
                  {addedCount > 0 && <span className="text-emerald-400 font-semibold">+{addedCount} granted </span>}
                  {removedCount > 0 && <span className="text-rose-400 font-semibold">-{removedCount} revoked </span>}
                  <span className="text-zinc-500">(Press Ctrl+S to save)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToOriginal}
                disabled={isPending}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={isPending}
                disabled={isPending}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs"
              >
                Save Permissions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Toast Banners ── */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-emerald-900 text-white shadow-lg text-xs font-semibold animate-[slideInUp_150ms_ease-out]">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span>Permissions saved successfully for &ldquo;{roleName}&rdquo;!</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3.5 rounded-xl bg-rose-600 text-white shadow-lg text-xs font-semibold animate-[slideInUp_150ms_ease-out]">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
