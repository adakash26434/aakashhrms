export type UserStatus = "active" | "inactive";

export interface UserWithRole {
  id: string;
  name: string | null;
  email: string;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Delegation fields
  delegatedToUserId: string | null;
  delegatedToUserName: string | null;
  delegatedUntil: Date | null;

  // Multi-Branch & Multi-Department Scoping
  assignedBranchIds: string[];
  assignedDepartmentIds: string[];

  // Joined Role information
  roleId: string | null;
  roleName: string | null;
  roleSlug: string | null;
  roleScopeType: "GLOBAL" | "BRANCH" | "DEPARTMENT" | "SELF" | null;

  // Joined Employee information
  employeeCode: string | null;
  employeeName: string | null;
  employeeBranch: string | null;
  employeeBranchCode: string | null;
  employeeDepartment: string | null;
  employeeDepartmentCode: string | null;
  employeeDesignation: string | null;
}

export interface UserFormData {
  name: string;
  email: string;
  roleId: string;
  employeeId?: string | null;
  assignedBranchIds?: string[];
  assignedDepartmentIds?: string[];
}

export interface DelegationFormData {
  delegatedToUserId: string | null;
  delegatedUntil: string | null; // ISO date string YYYY-MM-DD
}

export interface UserFilter {
  search?: string;
  roleId?: string | "all";
  status?: UserStatus | "all";
}

export interface UserKPIs {
  total: number;
  active: number;
  inactive: number;
  linkedToEmployee: number;
  unlinked: number;
}

export interface UserValidationErrors {
  [key: string]: string | undefined;
  name?: string;
  email?: string;
  roleId?: string;
  employeeId?: string;
  general?: string;
}

export interface UserAuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  recordId: string | null;
  result: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}
