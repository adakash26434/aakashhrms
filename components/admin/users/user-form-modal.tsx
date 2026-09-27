"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserWithRole, UserFormData, UserValidationErrors } from "@/lib/types/user";
import { RoleRow } from "@/lib/repositories/role.repository";
import { createUserAction, updateUserAction } from "@/app/actions/user.actions";
import { User, Mail, Shield, Link2, Building2, Users, AlertCircle, Lock } from "lucide-react";

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  userToEdit: UserWithRole | null;
  roles: RoleRow[];
  branches?: Array<{ id: string; name: string; code: string }>;
  departments?: Array<{ id: string; name: string; code: string }>;
  unlinkedEmployees: Array<{ id: string; employeeCode: string; name: string }>;
  onSuccess: (user: UserWithRole, tempPassword?: string) => void;
}

export function UserFormModal({
  open,
  onClose,
  userToEdit,
  roles,
  branches = [],
  departments = [],
  unlinkedEmployees,
  onSuccess,
}: UserFormModalProps) {
  const isEditing = !!userToEdit;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [assignedBranchIds, setAssignedBranchIds] = useState<string[]>([]);
  const [assignedDepartmentIds, setAssignedDepartmentIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<UserValidationErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.id === roleId);
  const showBranchScoping = selectedRole?.scopeType === "BRANCH";
  const showDeptScoping = selectedRole?.scopeType === "DEPARTMENT";

  useEffect(() => {
    if (open) {
      setErrors({});
      setGeneralError(null);
      if (userToEdit) {
        setName(userToEdit.name || "");
        setEmail(userToEdit.email || "");
        setRoleId(userToEdit.roleId || (roles[0]?.id || ""));
        setEmployeeId(userToEdit.employeeId || "");
        setAssignedBranchIds(userToEdit.assignedBranchIds || []);
        setAssignedDepartmentIds(userToEdit.assignedDepartmentIds || []);
      } else {
        setName("");
        setEmail("");
        setRoleId(roles[0]?.id || "");
        setEmployeeId("");
        setAssignedBranchIds([]);
        setAssignedDepartmentIds([]);
      }
    }
  }, [open, userToEdit, roles]);

  const toggleBranch = (bId: string) => {
    setAssignedBranchIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  const toggleDept = (dId: string) => {
    setAssignedDepartmentIds((prev) =>
      prev.includes(dId) ? prev.filter((id) => id !== dId) : [...prev, dId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setLoading(true);

    const payload: UserFormData = {
      name: name.trim(),
      email: email.trim(),
      roleId: roleId,
      employeeId: employeeId || null,
      assignedBranchIds,
      assignedDepartmentIds,
    };

    try {
      if (isEditing && userToEdit) {
        const res = await updateUserAction(userToEdit.id, payload);
        if (res.success && res.data) {
          onSuccess(res.data);
          onClose();
        } else {
          if (res.validationErrors) setErrors(res.validationErrors);
          if (res.error) setGeneralError(res.error);
        }
      } else {
        const res = await createUserAction(payload);
        if (res.success && res.data) {
          onSuccess(res.data.user, res.data.tempPassword);
          onClose();
        } else {
          if (res.validationErrors) setErrors(res.validationErrors);
          if (res.error) setGeneralError(res.error);
        }
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdminManaged = isEditing && (
    userToEdit?.roleSlug === "system_admin" ||
    userToEdit?.roleSlug === "admin" ||
    userToEdit?.roleName?.toLowerCase().includes("admin")
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit User Account" : "Create New User Account"}
      description={
        isEditing
          ? "Update account credentials, permission roles, and administrative data scopes."
          : "Provision a new staff access credential. A secure initial password will be issued."
      }
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isEditing ? `Editing: ${name || "User Account"}` : "New system operator"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="user-form"
              disabled={loading}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-none cursor-pointer px-4 py-2 text-sm"
            >
              {loading
                ? isEditing ? "Saving..." : "Creating..."
                : isEditing ? "Save Changes" : "Create Account"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
        {generalError && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Section 1: User Identity */}
        <FormSection
          title="Account Identity"
          description="Basic credentials and login identifier for the administrative user."
          isFirst
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Full Display Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ram Bahadur Shrestha"
                  className={cn(
                    "block w-full rounded-md border pl-9 pr-3 py-2 text-sm text-zinc-900 outline-none transition-colors",
                    errors.name
                      ? "border-red-500 bg-red-50/20"
                      : "border-zinc-200 bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  )}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                {isSuperAdminManaged && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70">
                    <Lock className="w-2.5 h-2.5" /> Super Admin Managed
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="email"
                  required
                  disabled={isSuperAdminManaged}
                  readOnly={isSuperAdminManaged}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@aakashhrms.com"
                  className={cn(
                    "block w-full rounded-md border pl-9 pr-3 py-2 text-sm outline-none transition-colors",
                    isSuperAdminManaged
                      ? "bg-zinc-100/80 border-zinc-200 text-zinc-600 cursor-not-allowed select-none font-medium"
                      : errors.email
                      ? "border-red-500 bg-red-50/20"
                      : "border-zinc-200 bg-white text-zinc-900 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  )}
                />
              </div>
              {isSuperAdminManaged ? (
                <p className="mt-1 text-[11px] text-zinc-500 font-medium">
                  Company Admin email is managed exclusively by the Super Admin in the Platform Control Plane.
                </p>
              ) : errors.email ? (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              ) : null}
            </div>
          </div>
        </FormSection>

        {/* Section 2: Role & Link */}
        <FormSection
          title="Role & Association"
          description="Grant authorization permissions and associate with a physical personnel file."
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Assigned System Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <select
                  required
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className={cn(
                    "block w-full rounded-md border pl-9 pr-3 py-2 text-sm text-zinc-900 outline-none transition-colors bg-white",
                    errors.roleId
                      ? "border-red-500 bg-red-50/20"
                      : "border-zinc-200 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  )}
                >
                  <option value="" disabled>
                    -- Select System Role --
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.scopeType} Scope)
                    </option>
                  ))}
                </select>
              </div>
              {errors.roleId && <p className="mt-1 text-xs text-red-600">{errors.roleId}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Link to Employee Record (Optional)
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className={cn(
                    "block w-full rounded-md border pl-9 pr-3 py-2 text-sm text-zinc-900 outline-none transition-colors bg-white",
                    errors.employeeId
                      ? "border-red-500 bg-red-50/20"
                      : "border-zinc-200 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  )}
                >
                  <option value="">-- No linked employee (e.g. IT Admin) --</option>
                  {isEditing && userToEdit?.employeeId && userToEdit.employeeName && (
                    <option value={userToEdit.employeeId}>
                      [Current] {userToEdit.employeeCode} - {userToEdit.employeeName}
                    </option>
                  )}
                  {unlinkedEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.employeeId && <p className="mt-1 text-xs text-red-600">{errors.employeeId}</p>}
            </div>
          </div>
        </FormSection>

        {/* Section 3: Data Scoping */}
        {(showBranchScoping || showDeptScoping || branches.length > 0 || departments.length > 0) && (
          <FormSection
            title="Data Scoping"
            description="Restrict visibility and operational authority to designated branches or departments."
          >
            <div className="space-y-4">
              {/* Branch Scoping */}
              {(showBranchScoping || branches.length > 0) && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-300/60">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-800" />
                      <label className="text-xs font-semibold text-zinc-900">
                        Branch Access Scope
                      </label>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {assignedBranchIds.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pt-1">
                    {branches.map((b) => {
                      const checked = assignedBranchIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={cn(
                            "flex items-center gap-2 text-xs rounded-md border p-2 cursor-pointer transition-colors",
                            checked
                              ? "border-emerald-700 bg-emerald-50/50 text-emerald-950 font-medium"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBranch(b.id)}
                            className="rounded border-zinc-300 text-emerald-700 focus:ring-emerald-700"
                          />
                          <span className="truncate">{b.code} - {b.name}</span>
                        </label>
                      );
                    })}
                    {branches.length === 0 && (
                      <p className="text-xs text-zinc-400 italic col-span-2">No branches configured.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Department Scoping */}
              {(showDeptScoping || departments.length > 0) && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-300/60">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-800" />
                      <label className="text-xs font-semibold text-zinc-900">
                        Department Access Scope
                      </label>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {assignedDepartmentIds.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pt-1">
                    {departments.map((d) => {
                      const checked = assignedDepartmentIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={cn(
                            "flex items-center gap-2 text-xs rounded-md border p-2 cursor-pointer transition-colors",
                            checked
                              ? "border-emerald-700 bg-emerald-50/50 text-emerald-950 font-medium"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDept(d.id)}
                            className="rounded border-zinc-300 text-emerald-700 focus:ring-emerald-700"
                          />
                          <span className="truncate">{d.code} - {d.name}</span>
                        </label>
                      );
                    })}
                    {departments.length === 0 && (
                      <p className="text-xs text-zinc-400 italic col-span-2">No departments configured.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </FormSection>
        )}
      </form>
    </Dialog>
  );
}

function FormSection({
  title,
  description,
  children,
  isFirst = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-3", !isFirst && "pt-5 border-t border-zinc-200")}>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h4>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
