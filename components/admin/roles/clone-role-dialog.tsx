"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cloneRoleAction } from "@/app/actions/role.actions";
import type { ScopeType } from "@/lib/types/role";
import {
  Globe,
  Building2,
  Users,
  User,
  Copy,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CloneRoleDialogProps {
  open: boolean;
  onClose: () => void;
  sourceRoleId: string;
  sourceRoleName: string;
  sourceScope: ScopeType;
  onSuccess: (newRoleId: string) => void;
}

const SCOPES: {
  value: ScopeType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "GLOBAL",
    label: "Global Access",
    description: "Can view and manage records across the entire company.",
    icon: Globe,
  },
  {
    value: "BRANCH",
    label: "Branch Restricted",
    description:
      "Access is strictly confined to the user's assigned branch(es).",
    icon: Building2,
  },
  {
    value: "DEPARTMENT",
    label: "Department Restricted",
    description: "Access is limited to the user's assigned department(s).",
    icon: Users,
  },
  {
    value: "SELF",
    label: "Self-Service Only",
    description:
      "Personal access only (view own profile, payslips, submit leaves).",
    icon: User,
  },
];

export function CloneRoleDialog({
  open,
  onClose,
  sourceRoleId,
  sourceRoleName,
  sourceScope,
  onSuccess,
}: CloneRoleDialogProps) {
  const [name, setName] = useState(`${sourceRoleName} (Copy)`);
  const [scopeType, setScopeType] = useState<ScopeType>(sourceScope);
  const [description, setDescription] = useState(
    `Cloned from ${sourceRoleName}`,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("New role name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await cloneRoleAction({
        sourceRoleId,
        newRoleName: name.trim(),
        scopeType,
        description: description.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to clone role.");
        return;
      }

      onClose();
      if (res.data?.id) {
        onSuccess(res.data.id);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Clone Role"
      description={`Duplicate all permissions from "${sourceRoleName}" into a new custom role.`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={loading}
            disabled={loading || !name.trim()}
            className="bg-payroll-primary hover:bg-payroll-primary-hover text-white font-bold shadow-payroll-sm"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            <span>Clone Role</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Source info */}
        <div className="p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-xs text-gray-600">
          Cloning all existing permission assignments from{" "}
          <strong className="text-payroll-navy font-bold">{sourceRoleName}</strong>.
        </div>

        {/* New Role Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-payroll-navy">
            New Role Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all text-payroll-navy"
          />
        </div>

        {/* Scope Type */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-payroll-navy">
            Data Access Scope
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SCOPES.map((s) => {
              const Icon = s.icon;
              const isSelected = scopeType === s.value;
              return (
                <div
                  key={s.value}
                  onClick={() => setScopeType(s.value)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between select-none shadow-payroll-xs",
                    isSelected
                      ? "border-payroll-primary bg-payroll-cream text-payroll-navy ring-1 ring-payroll-primary"
                      : "border-payroll-light/80 hover:border-payroll-primary/40 bg-white text-gray-700",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "p-1 rounded-lg",
                      isSelected ? "bg-payroll-primary text-white" : "bg-payroll-cream text-payroll-primary",
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-payroll-navy">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-payroll-navy">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all text-payroll-navy resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}
