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
  Loader2,
} from "lucide-react";

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
            disabled={loading || !name.trim()}
            className="bg-payroll-primary hover:bg-[#256629] text-white"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                <span>Save Changes</span>
              </div>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={isNameLocked}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent ${
              isNameLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
            }`}
          />
          {isNameLocked && (
            <p className="text-[11px] text-amber-600">
              System-protected role names cannot be modified to ensure platform
              stability.
            </p>
          )}
        </div>

        {/* Scope Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700">
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
                  className={`
                    p-3 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between
                    ${
                      isSelected
                        ? "border-payroll-primary bg-[#f4f9f4] shadow-sm ring-1 ring-payroll-primary"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={`h-4 w-4 ${isSelected ? "text-payroll-primary" : "text-gray-500"}`}
                    />
                    <span
                      className={`text-xs font-bold ${isSelected ? "text-payroll-navy" : "text-gray-800"}`}
                    >
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
          <label className="text-xs font-semibold text-gray-700">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}
