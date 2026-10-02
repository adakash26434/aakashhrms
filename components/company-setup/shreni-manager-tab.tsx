"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Scale,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ShreniLevelItem } from "@/lib/constants/industry-types";
import type { ShreniLevelFormData } from "@/lib/types/shreni";
import {
  createShreniLevelAction,
  updateShreniLevelAction,
  deleteShreniLevelAction,
} from "@/app/actions/shreni.actions";

interface ShreniManagerTabProps {
  levels: ShreniLevelItem[];
  onLevelsChange: (levels: ShreniLevelItem[]) => void;
}

export function ShreniManagerTab({ levels, onLevelsChange }: ShreniManagerTabProps) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ShreniLevelItem | null>(null);
  const [deletingLevel, setDeletingLevel] = useState<ShreniLevelItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ShreniLevelFormData>({
    code: "",
    name: "",
    levelNumber: 1,
    labelNepali: "",
    description: "",
    minSalary: 0,
    maxSalary: 0,
    rankOrder: 1,
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter levels
  const filteredLevels = useMemo(() => {
    if (!search.trim()) return levels;
    const q = search.toLowerCase().trim();
    return levels.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        (l.labelNepali && l.labelNepali.toLowerCase().includes(q)) ||
        String(l.levelNumber) === q ||
        (l.description && l.description.toLowerCase().includes(q))
    );
  }, [levels, search]);

  function handleOpenCreate() {
    setEditingLevel(null);
    const nextLevelNum = levels.length > 0 ? Math.max(...levels.map((l) => l.levelNumber)) + 1 : 16;
    setFormData({
      code: `S${nextLevelNum}`,
      name: `Level ${nextLevelNum}`,
      levelNumber: nextLevelNum,
      labelNepali: `तह ${nextLevelNum}`,
      description: `General Grade Level ${nextLevelNum}`,
      minSalary: 0,
      maxSalary: 0,
      rankOrder: nextLevelNum,
      isActive: true,
    });
    setErrors({});
    setIsFormOpen(true);
  }

  function handleOpenEdit(level: ShreniLevelItem) {
    setEditingLevel(level);
    setFormData({
      code: level.code,
      name: level.name,
      levelNumber: level.levelNumber,
      labelNepali: level.labelNepali,
      description: level.description || "",
      minSalary: level.minSalary ?? 0,
      maxSalary: level.maxSalary ?? 0,
      rankOrder: level.levelNumber,
      isActive: true,
    });
    setErrors({});
    setIsFormOpen(true);
  }

  async function handleSaveLevel(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.code.trim()) {
      setErrors({ code: "Level code is required (e.g. S1, S16)" });
      return;
    }
    if (!formData.name.trim()) {
      setErrors({ name: "Level title is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLevel) {
        const res = await updateShreniLevelAction(editingLevel.id, formData);
        if (res.success && res.data) {
          onLevelsChange(
            levels.map((l) => (l.id === editingLevel.id ? res.data! : l))
          );
          toast.success(`Level ${res.data.code} updated successfully.`);
          setIsFormOpen(false);
        } else {
          toast.error(res.error || "Failed to update level.");
        }
      } else {
        const res = await createShreniLevelAction(formData);
        if (res.success && res.data) {
          onLevelsChange([...levels, res.data]);
          toast.success(`Level ${res.data.code} created successfully.`);
          setIsFormOpen(false);
        } else {
          toast.error(res.error || "Failed to create level.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving level";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingLevel) return;
    setIsSubmitting(true);
    try {
      const res = await deleteShreniLevelAction(deletingLevel.id);
      if (res.success) {
        onLevelsChange(levels.filter((l) => l.id !== deletingLevel.id));
        toast.success(`Level ${deletingLevel.code} deleted successfully.`);
        setDeletingLevel(null);
      } else {
        toast.error(res.error || "Failed to delete level.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting level";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_200ms_ease-out]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900 tracking-tight">
              Grade Ladder &amp; Shreni Hierarchy
            </h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-800 border border-emerald-200/70">
              {levels.length} Configured Levels
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 max-w-2xl">
            Universal organizational grade hierarchy (Level 1 to Level 15).
            You can add custom levels (e.g. S16, S17) or configure starting salary scales anytime.
            These levels reflect directly in employee onboarding and salary management.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="gap-2 bg-emerald-900 hover:bg-emerald-950 text-white cursor-pointer shadow-xs text-xs font-medium h-9 px-4 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Custom Level</span>
          </Button>
        </div>
      </div>

      {/* Grade Policy Callout */}
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Scale className="h-4 w-4 text-emerald-800 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-800">Statutory Grade Calculation Policy:</span>{" "}
            <span className="text-zinc-600">
              Grade increments compute automatically from starting/current Basic Salary using statutory daily rate (1 Grade = Basic &divide; 30) or custom company policy with promotion pay protection.
            </span>
          </div>
        </div>
        <Link
          href="/setup/company-setup?section=system_control"
          className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 shrink-0 transition-colors"
        >
          <span>Configure Policy</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by code or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-700 inline-block" />
            Showing {filteredLevels.length} of {levels.length} levels
          </span>
        </div>
      </div>

      {/* Level List / Table */}
      <div className="overflow-x-auto border border-zinc-200 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-2xs font-semibold uppercase tracking-wider text-zinc-600">
              <th className="px-4 py-3 w-16 text-center">Rank</th>
              <th className="px-4 py-3 w-24">Code</th>
              <th className="px-4 py-3">Level Title</th>
              <th className="px-4 py-3">Nepali Label</th>
              <th className="px-4 py-3 w-44">Starting Scale (Basic)</th>
              <th className="px-4 py-3">Scope &amp; Description</th>
              <th className="px-4 py-3 w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">
            {filteredLevels.map((lvl) => (
              <tr key={lvl.id} className="hover:bg-emerald-50/20 transition-colors">
                <td className="px-4 py-3.5 text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-2xs font-medium text-zinc-600 font-mono">
                    {lvl.levelNumber}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-emerald-200/80 bg-emerald-50/60 text-emerald-950 font-mono font-semibold text-xs">
                    {lvl.code}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-semibold text-zinc-900">
                  {lvl.name}
                </td>
                <td className="px-4 py-3.5 font-nepali font-medium text-zinc-800">
                  {lvl.labelNepali}
                </td>
                <td className="px-4 py-3.5">
                  {lvl.minSalary && lvl.minSalary > 0 ? (
                    <span className="inline-flex items-center font-mono font-medium text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 text-xs">
                      NPR {lvl.minSalary.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-zinc-300 italic">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-zinc-500 max-w-xs truncate">
                  {lvl.description || <span className="text-zinc-300 italic">—</span>}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(lvl)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Edit level"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingLevel(lvl)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete level"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredLevels.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-400 text-xs">
                  <Layers className="mx-auto h-8 w-8 text-zinc-300 mb-2" />
                  <p className="font-semibold text-zinc-600">No grade levels found</p>
                  <p className="text-zinc-400 mt-1">Try searching for something else or add a new level.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Level Modal */}
      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-800" />
            <span>{editingLevel ? "Edit Grade Level" : "Create New Grade Level"}</span>
          </div>
        }
        description="Configure grade level code, title, and hierarchical rank for your organization."
        size="md"
      >
        <form onSubmit={handleSaveLevel} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Level Code *
              </label>
              <input
                type="text"
                placeholder="e.g. S1, S16"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={cn(
                  "h-9 w-full rounded-lg border bg-white px-3 font-mono text-xs text-zinc-900 uppercase focus:outline-none focus:ring-1",
                  errors.code
                    ? "border-red-500 focus:ring-red-500"
                    : "border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700"
                )}
              />
              {errors.code && <p className="mt-1 text-2xs text-red-500">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Rank / Step (1-50) *
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={formData.levelNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    levelNumber: Number(e.target.value) || 1,
                    rankOrder: Number(e.target.value) || 1,
                  })
                }
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Level Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Level 16 (Senior Executive)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-1",
                errors.name
                  ? "border-red-500 focus:ring-red-500"
                  : "border-zinc-300 focus:border-emerald-700 focus:ring-emerald-700"
              )}
            />
            {errors.name && <p className="mt-1 text-2xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Local Script Label (e.g. तह १६ (वरिष्ठ कार्यकारी))
            </label>
            <input
              type="text"
              placeholder="e.g. तह १६ (वरिष्ठ कार्यकारी)"
              value={formData.labelNepali}
              onChange={(e) => setFormData({ ...formData, labelNepali: e.target.value })}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Starting Basic Scale (NPR)
              </label>
              <input
                type="number"
                min={0}
                step="100"
                placeholder="e.g. 35000"
                value={formData.minSalary || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minSalary: Number(e.target.value) || 0,
                  })
                }
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs font-mono text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <p className="mt-1 text-2xs text-zinc-500">
                Starting basic scale. Used for 1 Grade = Basic &divide; 30.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Max Scale Ceiling (NPR)
              </label>
              <input
                type="number"
                min={0}
                step="100"
                placeholder="e.g. 55000 (Optional)"
                value={formData.maxSalary || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxSalary: Number(e.target.value) || 0,
                  })
                }
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-xs font-mono text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <p className="mt-1 text-2xs text-zinc-500">
                Highest scale boundary before promotion.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of grade responsibilities or eligibility..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              {isSubmitting ? "Saving..." : editingLevel ? "Update Level" : "Create Level"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deletingLevel)}
        onClose={() => setDeletingLevel(null)}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="h-5 w-5" />
            <span>Confirm Delete Level</span>
          </div>
        }
        description={
          deletingLevel ? (
            <span>
              Are you sure you want to delete grade level{" "}
              <strong className="text-zinc-900">{deletingLevel.code} ({deletingLevel.name})</strong>?
              This action cannot be undone. If any employees are currently assigned to this level, deletion will be blocked.
            </span>
          ) : undefined
        }
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingLevel(null)}
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              {isSubmitting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-zinc-500">
          This operation will permanently remove this grade tier from the organization master database.
        </div>
      </Dialog>
    </div>
  );
}
