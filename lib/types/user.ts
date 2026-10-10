import type { ScopeType } from "./role";

// Logins (4.13). A login is a user account: an email, a role and — for branch and department
// roles — the branches or departments it covers; it may be linked to the employee it belongs to.

export type UserStatus = "active" | "inactive";

/** One login with its role and employee (the employee record's access card, scripts). */
export interface UserWithRole {
  id: string;
  name: string | null;
  email: string;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  mustChangePassword?: boolean;
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

/** The login window's fields. */
export interface LoginForm {
  name: string;
  email: string;
  roleId: string;
  employeeId: string | null;
  branchIds: string[];
  departmentIds: string[];
}

export type LoginFormErrors = Partial<Record<keyof LoginForm, string>>;

/** The delegation window: who approves in this login's place, and until when (YYYY-MM-DD). */
export interface DelegationForm {
  delegateId: string | null;
  until: string | null;
}

/** The employee a login belongs to. */
export interface LoginEmployee {
  id: string;
  code: string;
  name: string;
  /** The employee's status ("Active", "Inactive" …): a login of someone who left is flagged. */
  status: string;
  branch: string | null;
  designation: string | null;
}

/** One row of Admin → Users. */
export interface LoginRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  /** Waiting for the first sign-in with a temporary password. */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Set while sign-in is locked after failed attempts (ISO). */
  lockedUntil: string | null;
  createdAt: string;
  roleId: string | null;
  roleName: string | null;
  roleScope: ScopeType | null;
  isAdministrator: boolean;
  branchIds: string[];
  departmentIds: string[];
  /** What the login covers, in words: "Company-wide", "Lekhnath, Pokhara", "Own records". */
  access: string;
  employee: LoginEmployee | null;
  delegation: { toId: string; toName: string; until: string; active: boolean } | null;
  /** Why the viewer can't change this login (null: they can); "own" logins say so. */
  cannotChange: string | null;
  /** Why the viewer can't set this login's delegation (null: they can). */
  cannotDelegate: string | null;
}

/** A role the login window offers, and why the viewer can't give it (null: they can). */
export interface RoleChoice {
  id: string;
  name: string;
  scopeType: ScopeType;
  isAdministrator: boolean;
  cannotGive: string | null;
}

export interface LinkableEmployee {
  id: string;
  code: string;
  name: string;
}

export interface UsersPage {
  logins: LoginRow[];
  roles: RoleChoice[];
  branches: { id: string; name: string; code: string }[];
  departments: { id: string; name: string; code: string }[];
  /** Active employees with no login yet (offered only to someone who may add or change logins). */
  linkable: LinkableEmployee[];
  viewerId: string;
  can: { add: boolean; edit: boolean; deactivate: boolean; audit: boolean };
}

/** A recent audit entry by a login (the Users pane; needs Audit log → View). */
export interface LoginActivity {
  id: string;
  at: string;
  action: string;
  module: string;
  record: string;
  result: string;
}

/** What a create or reset hands back once: the temporary password is never stored (S2). */
export interface IssuedPassword {
  loginId: string;
  email: string;
  name: string;
  tempPassword: string;
}
