"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createRoleAction } from "@/app/actions/role.actions";
import type { ScopeType } from "@/lib/types/role";
import {
  Globe,
  Building2,
  Users,
  User,
  Shield,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateRoleDialogProps {
  open: boolean;
  onClose: () => void;
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

const SUGGESTED_ROLES: { name: string; defaultScope: ScopeType }[] = [
  { name: "Administrator", defaultScope: "GLOBAL" },
  { name: "HR Manager", defaultScope: "GLOBAL" },
  { name: "HR Officer", defaultScope: "GLOBAL" },
  { name: "Payroll Accountant", defaultScope: "GLOBAL" },
  { name: "Finance Approver", defaultScope: "GLOBAL" },
  { name: "Branch Manager", defaultScope: "BRANCH" },
  { name: "Branch Officer", defaultScope: "BRANCH" },
  { name: "Department Head", defaultScope: "DEPARTMENT" },
  { name: "Team Lead", defaultScope: "DEPARTMENT" },
  { name: "Staff / Employee", defaultScope: "SELF" },
  { name: "Auditor (Read-Only)", defaultScope: "GLOBAL" },
];

export function CreateRoleDialog({
  open,
  onClose,
  onSuccess,
}: CreateRoleDialogProps) {
  const [name, setName] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = SUGGESTED_ROLES.filter((r) =>
    r.name.toLowerCase().includes(name.toLowerCase())
  );

  const handleSelectSuggestion = (suggestion: typeof SUGGESTED_ROLES[number]) => {
    setName(suggestion.name);
    setScopeType(suggestion.defaultScope);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createRoleAction({
        name: name.trim(),
        scopeType,
        description: description.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to create role.");
        return;
      }

      setName("");
      setDescription("");
      setScopeType("GLOBAL");
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
      title="Create Custom Role"
      description="Define a new role for your organization and configure its data access scope."
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
            <Shield className="h-4 w-4 mr-1.5" />
            <span>Create Role</span>
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

        {/* Role Name Combobox */}
        <div className="space-y-1.5 relative">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-payroll-navy">
              Role Name <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-gray-400">Type or choose a template</span>
          </div>

          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="e.g. Payroll Accountant, HR Executive, Branch Supervisor"
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all text-payroll-navy"
          />

          {/* Combobox Dropdown Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-payroll-light bg-white p-1 shadow-payroll-lg animate-[dialogIn_150ms_ease-out]">
              <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Suggested Role Templates
              </div>
              {filteredSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-payroll-navy hover:bg-payroll-cream transition-colors text-left cursor-pointer"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-[10px] text-payroll-primary bg-payroll-light/60 px-2 py-0.5 rounded-md font-semibold">
                    {s.defaultScope}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Access Scope Selection */}
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
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the duties, responsibilities, and access boundaries of this role..."
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-payroll-light bg-white focus:outline-none focus:ring-1 focus:ring-payroll-primary focus:border-payroll-primary shadow-payroll-xs transition-all text-payroll-navy resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}
