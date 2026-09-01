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
  Loader2,
} from "lucide-react";

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
      description="Define a new role for your organization and configure its access scope."
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
                <span>Creating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Create Role</span>
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

        {/* Role Name Combobox (E6) */}
        <div className="space-y-1.5 relative">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">
              Role Name <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-gray-400">Type or choose a recommended template</span>
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
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent"
          />

          {/* Combobox Dropdown Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Suggested Templates
              </div>
              {filteredSuggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                    Scope: {s.defaultScope}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Access Scope Selection */}
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
            Description (Optional)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the duties, responsibilities, and access boundaries of this role..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-payroll-primary focus:border-transparent resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}
