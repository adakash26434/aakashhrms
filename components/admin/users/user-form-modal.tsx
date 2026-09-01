"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserWithRole, UserFormData, UserValidationErrors } from "@/lib/types/user";
import { RoleRow } from "@/lib/repositories/role.repository";
import { createUserAction, updateUserAction } from "@/app/actions/user.actions";
import { User, Mail, Shield, Link2, Building2, Users, AlertCircle } from "lucide-react";

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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit User Account" : "Create New User Account"}
      description={
        isEditing
          ? "Update user details, role assignment, data scoping, or employee link."
          : "Create a user login account. A secure temporary password will be generated automatically."
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={loading}>
            {loading ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save Changes" : "Create Account"}
          </Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
        {generalError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Full Name (Display Name)
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ram Bahadur Shrestha"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-all ${
                errors.name ? "border-red-500 bg-red-50/20" : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              }`}
            />
          </div>
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@aakashhrms.com"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-all ${
                errors.email ? "border-red-500 bg-red-50/20" : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              }`}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        {/* Assigned System Role */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Assigned System Role <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Shield className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <select
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none bg-white transition-all ${
                errors.roleId ? "border-red-500 bg-red-50/20" : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              }`}
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

        {/* Branch Scoping Picker (if BRANCH scope or explicitly assigning) */}
        {(showBranchScoping || branches.length > 0) && (
          <div className="rounded-lg border border-[#d7e8d0] bg-[#f6faf6]/60 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="h-4 w-4 text-[#2e7d32]" />
              <label className="text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider">
                Assigned Branch Access Scope ({assignedBranchIds.length} selected)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {branches.map((b) => {
                const checked = assignedBranchIds.includes(b.id);
                return (
                  <label key={b.id} className="flex items-center gap-2 text-xs text-gray-700 bg-white p-1.5 rounded border border-gray-200 cursor-pointer hover:bg-green-50/30">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBranch(b.id)}
                      className="rounded text-[#2e7d32] focus:ring-[#2e7d32]"
                    />
                    <span className="truncate">{b.code} - {b.name}</span>
                  </label>
                );
              })}
              {branches.length === 0 && <p className="text-xs text-gray-400 italic col-span-2">No branches configured.</p>}
            </div>
          </div>
        )}

        {/* Department Scoping Picker */}
        {(showDeptScoping || departments.length > 0) && (
          <div className="rounded-lg border border-[#d7e8d0] bg-[#f6faf6]/60 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-4 w-4 text-[#2e7d32]" />
              <label className="text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider">
                Assigned Department Access Scope ({assignedDepartmentIds.length} selected)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {departments.map((d) => {
                const checked = assignedDepartmentIds.includes(d.id);
                return (
                  <label key={d.id} className="flex items-center gap-2 text-xs text-gray-700 bg-white p-1.5 rounded border border-gray-200 cursor-pointer hover:bg-green-50/30">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDept(d.id)}
                      className="rounded text-[#2e7d32] focus:ring-[#2e7d32]"
                    />
                    <span className="truncate">{d.code} - {d.name}</span>
                  </label>
                );
              })}
              {departments.length === 0 && <p className="text-xs text-gray-400 italic col-span-2">No departments configured.</p>}
            </div>
          </div>
        )}

        {/* Link to Employee (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-[#1b3a1f] uppercase tracking-wider mb-1.5">
            Link to Employee Record (Optional)
          </label>
          <div className="relative">
            <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none bg-white transition-all ${
                errors.employeeId ? "border-red-500 bg-red-50/20" : "border-[#d7e8d0] focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
              }`}
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
      </form>
    </Dialog>
  );
}
