"use client";

import React, { useState } from "react";
import {
  FileBadge2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { EmploymentType, EmploymentTypeFormData } from "@/lib/types/company-setup";
import {
  createEmploymentTypeAction,
  updateEmploymentTypeAction,
  deleteEmploymentTypeAction,
} from "@/app/actions/company-setup.actions";

interface EmploymentTypesTabProps {
  types: EmploymentType[];
  onTypesChange: (types: EmploymentType[]) => void;
}

export function EmploymentTypesTab({ types, onTypesChange }: EmploymentTypesTabProps) {
  const toast = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<EmploymentType | null>(null);
  const [deletingType, setDeletingType] = useState<EmploymentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<EmploymentTypeFormData>({
    code: "",
    name: "",
    nameNepali: "",
    isPfEligible: true,
    isSsfEligible: true,
    isFestivalEligible: true,
    isLeaveEligible: true,
    isOtEligible: true,
    noticePeriodDays: 30,
    probationMonths: 6,
    rankOrder: types.length + 1,
  });

  function handleOpenCreate() {
    setEditingType(null);
    setFormData({
      code: "",
      name: "",
      nameNepali: "",
      isPfEligible: true,
      isSsfEligible: true,
      isFestivalEligible: true,
      isLeaveEligible: true,
      isOtEligible: true,
      noticePeriodDays: 30,
      probationMonths: 6,
      rankOrder: types.length + 1,
    });
    setIsFormOpen(true);
  }

  function handleOpenEdit(t: EmploymentType) {
    setEditingType(t);
    setFormData({
      code: t.code,
      name: t.name,
      nameNepali: t.nameNepali || "",
      isPfEligible: t.isPfEligible,
      isSsfEligible: t.isSsfEligible,
      isFestivalEligible: t.isFestivalEligible,
      isLeaveEligible: t.isLeaveEligible,
      isOtEligible: t.isOtEligible,
      noticePeriodDays: t.noticePeriodDays,
      probationMonths: t.probationMonths,
      rankOrder: t.rankOrder,
    });
    setIsFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    const payload = {
      ...formData,
      code: formData.code?.trim() ? formData.code.trim().toUpperCase() : formData.name.trim().toUpperCase().replace(/\s+/g, '_'),
    };

    setIsSubmitting(true);
    try {
      if (editingType) {
        const res = await updateEmploymentTypeAction(editingType.id, payload);
        if (res.success && res.data) {
          onTypesChange(types.map((t) => (t.id === editingType.id ? res.data! : t)));
          toast.success(`Category ${res.data.name} updated successfully.`);
          setIsFormOpen(false);
        } else {
          toast.error(res.error || "Failed to update category.");
        }
      } else {
        const res = await createEmploymentTypeAction(payload);
        if (res.success && res.data) {
          onTypesChange([...types, res.data]);
          toast.success(`Category ${res.data.name} created successfully.`);
          setIsFormOpen(false);
        } else {
          toast.error(res.error || "Failed to create category.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving category";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingType) return;
    setIsSubmitting(true);
    try {
      const res = await deleteEmploymentTypeAction(deletingType.id);
      if (res.success) {
        onTypesChange(types.filter((t) => t.id !== deletingType.id));
        toast.success(`Category ${deletingType.name} deleted successfully.`);
        setDeletingType(null);
      } else {
        toast.error(res.error || "Failed to delete category.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting category";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_200ms_ease-out]">
      {/* ── Top Clean Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              Employment Types &amp; Classifications
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {types.length} Categories
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Define employment terms, probation rules, and statutory benefit eligibility for SSF, PF, and Festival Allowances.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenCreate}
          className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs text-xs font-medium h-9 px-4 rounded-lg self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          <span>Add Classification</span>
        </Button>
      </div>

      {/* Categories Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="border-b border-zinc-300 bg-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-900">
            <tr className="border-b border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Classification Title</th>
              <th className="px-4 py-3">Local Title</th>
              <th className="px-3 py-3 text-center">SSF Eligible</th>
              <th className="px-3 py-3 text-center">PF Eligible</th>
              <th className="px-3 py-3 text-center">Festival Bonus</th>
              <th className="px-3 py-3 text-center">Leave Accrual</th>
              <th className="px-3 py-3 text-center">Notice (Days)</th>
              <th className="px-4 py-3 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-700">
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-4 py-3.5 font-medium text-zinc-900">
                  <div className="flex items-center gap-2">
                    <span>{t.name}</span>
                    <span className="font-mono text-[11px] text-zinc-400">({t.code})</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-nepali text-zinc-700">
                  {t.nameNepali || <span className="text-zinc-300 italic">—</span>}
                </td>
                <td className="px-3 py-3.5 text-center">
                  {t.isSsfEligible ? (
                    <span className="inline-flex items-center text-xs font-medium text-emerald-800">
                      <Check className="h-3.5 w-3.5 mr-0.5 text-emerald-700" /> Yes
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-xs">No</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-center">
                  {t.isPfEligible ? (
                    <span className="inline-flex items-center text-xs font-medium text-emerald-800">
                      <Check className="h-3.5 w-3.5 mr-0.5 text-emerald-700" /> Yes
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-xs">No</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-center">
                  {t.isFestivalEligible ? (
                    <span className="inline-flex items-center text-xs font-medium text-emerald-800">
                      <Check className="h-3.5 w-3.5 mr-0.5 text-emerald-700" /> Yes
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-xs">No</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-center">
                  {t.isLeaveEligible ? (
                    <span className="inline-flex items-center text-xs font-medium text-emerald-800">
                      <Check className="h-3.5 w-3.5 mr-0.5 text-emerald-700" /> Yes
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-xs">No</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-center font-mono font-medium text-zinc-700">
                  {t.noticePeriodDays}d
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Edit category"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                      <button
                        type="button"
                        onClick={() => setDeletingType(t)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Add / Edit Category Modal */}
      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <FileBadge2 className="h-5 w-5 text-sky-600" />
            <span>{editingType ? "Edit Classification" : "New Employment Classification"}</span>
          </div>
        }
        description="Configure classification title, statutory eligibility, and notice period."
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Permanent, Contract"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Code (Short)
              </label>
              <input
                type="text"
                placeholder="e.g. PERM, CONT"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 uppercase focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Local Script Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Regular Permanent Staff"
              value={formData.nameNepali || ""}
              onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Eligibility Toggles */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
            <p className="text-xs font-bold text-slate-700">Statutory Benefits Eligibility</p>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isSsfEligible}
                  onChange={(e) => setFormData({ ...formData, isSsfEligible: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="font-medium text-slate-800">SSF Eligible</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isPfEligible}
                  onChange={(e) => setFormData({ ...formData, isPfEligible: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="font-medium text-slate-800">PF Eligible</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isFestivalEligible}
                  onChange={(e) => setFormData({ ...formData, isFestivalEligible: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="font-medium text-slate-800">Festival Bonus</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isLeaveEligible}
                  onChange={(e) => setFormData({ ...formData, isLeaveEligible: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="font-medium text-slate-800">Paid Leave</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notice Period (Days)
              </label>
              <input
                type="number"
                min={0}
                max={180}
                value={formData.noticePeriodDays}
                onChange={(e) => setFormData({ ...formData, noticePeriodDays: Number(e.target.value) || 0 })}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Probation (Months)
              </label>
              <input
                type="number"
                min={0}
                max={24}
                value={formData.probationMonths}
                onChange={(e) => setFormData({ ...formData, probationMonths: Number(e.target.value) || 0 })}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm"
            >
              {isSubmitting ? "Saving..." : editingType ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deletingType)}
        onClose={() => setDeletingType(null)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Confirm Delete Classification</span>
          </div>
        }
        description={
          deletingType ? (
            <span>
              Are you sure you want to delete employment classification{" "}
              <strong className="text-slate-900">{deletingType.name}</strong>?
              If any active employees have this category assigned, deletion will be safely rejected.
            </span>
          ) : undefined
        }
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingType(null)}
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm"
            >
              {isSubmitting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-slate-500">
          This operation will remove this employment classification from the company master records.
        </div>
      </Dialog>
    </div>
  );
}
