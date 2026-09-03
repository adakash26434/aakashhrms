"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateRoleAction } from "@/app/actions/role.actions";
import type { ScopeType } from "@/lib/types/role";
import {
  Globe,
  Building2,
  Users,
  User,
  Edit3,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditRoleDialogProps {
  open: boolean;
  onClose: () => void;
  roleId: string;
  roleName: string;
  roleScope: ScopeType;
  roleDescription: string | null;
  isSystemRole: boolean;
  isProtected: boolean;
  onSuccess: () => void;
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

export function EditRoleDialog({
  open,
  onClose,
  roleId,
  roleName,
  roleScope,
  roleDescription,
  isSystemRole,
  isProtected,
  onSuccess,
}: EditRoleDialogProps) {
  const [name, setName] = useState(roleName);
  const [scopeType, setScopeType] = useState<ScopeType>(roleScope);
  const [description, setDescription] = useState(roleDescription || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameLocked = isSystemRole || isProtected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await updateRoleAction(roleId, {
        name: name.trim(),
        scopeType,
        description: description.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to update role.");
        return;
      }

      onClose();
      onSuccess();
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
      title="Edit Role Configuration"
      description="Update role name, data access scope, and operational description."
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
            <Edit3 className="h-4 w-4 mr-1.5" />
            <span>Save Changes</span>
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

        {/* Role Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-payroll-navy">
            Role Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={isNameLocked}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              "w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all text-payroll-navy",
              isNameLocked && "bg-gray-100/80 text-gray-500 cursor-not-allowed",
            )}
          />
          {isNameLocked && (
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              System-protected role names cannot be renamed to ensure platform stability.
            </p>
          )}
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
