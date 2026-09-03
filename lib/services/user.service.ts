import * as repository from "@/lib/repositories/user.repository";
import * as roleRepository from "@/lib/repositories/role.repository";
import { validateUserFormData, generateTemporaryPassword } from "../engines/user.engine";
import { UserFormData, DelegationFormData, UserFilter, UserWithRole, UserKPIs, UserValidationErrors, UserAuditLogEntry } from "../types/user";
import { recordAuditLog } from "@/lib/services/audit.service";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class UserExistsError extends Error {
  constructor(public email: string) {
    super(`User with email '${email}' already exists.`);
    this.name = "UserExistsError";
  }
}

export class RoleNotFoundError extends Error {
  constructor(public idOrSlug: string) {
    super(`Role '${idOrSlug}' was not found.`);
    this.name = "RoleNotFoundError";
  }
}

export class UserNotFoundError extends Error {
  constructor(public id: string) {
    super(`User record '${id}' was not found.`);
    this.name = "UserNotFoundError";
  }
}

export class SelfDeactivationError extends Error {
  constructor() {
    super("You cannot deactivate your own active user account.");
    this.name = "SelfDeactivationError";
  }
}

export class SystemAdminProtectionError extends Error {
  constructor() {
    super("The core System Administrator account cannot be deactivated.");
    this.name = "SystemAdminProtectionError";
  }
}

export class UserValidationError extends Error {
  constructor(public errors: UserValidationErrors) {
    super("User validation failed.");
    this.name = "UserValidationError";
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAllUsersWithKPIs(filter?: UserFilter): Promise<{
  users: UserWithRole[];
  kpis: UserKPIs;
}> {
  const [usersList, kpisData] = await Promise.all([
    repository.findAllUsersWithRoles(filter),
    repository.countUsersKPIs(),
  ]);
  return { users: usersList, kpis: kpisData };
}

export async function getUserById(id: string): Promise<UserWithRole> {
  const user = await repository.findUserWithRoleById(id);
  if (!user) throw new UserNotFoundError(id);
  return user;
}

export async function getUnlinkedEmployeesForUserLink() {
  return repository.getUnlinkedEmployees();
}

export async function getUserAuditLogs(userId: string): Promise<UserAuditLogEntry[]> {
  const user = await repository.findUserWithRoleById(userId);
  if (!user) throw new UserNotFoundError(userId);
  return repository.findAuditLogsByUserId(userId);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Creates a new user account with assigned role, branch/dept scoping, and auto-generated password.
 */
export async function createUser(formData: UserFormData): Promise<{
  user: UserWithRole;
  tempPassword: string;
}> {
  // 1. Validate form fields
  const validationErrors = validateUserFormData(formData);
  if (validationErrors) {
    throw new UserValidationError(validationErrors);
  }

  const cleanEmail = formData.email.trim().toLowerCase();

  // 2. Uniqueness check
  const existing = await repository.findUserByEmail(cleanEmail);
  if (existing) {
    throw new UserExistsError(cleanEmail);
  }

  // 3. Role check
  const role = await roleRepository.findRoleById(formData.roleId);
  if (!role) {
    throw new RoleNotFoundError(formData.roleId);
  }

  // 4. Check if employee already linked
  if (formData.employeeId) {
    const existingEmployeeUser = await repository.findUserByEmployeeId(formData.employeeId);
    if (existingEmployeeUser) {
      throw new UserValidationError({
        employeeId: "This employee is already linked to another user account.",
      });
    }
  }

  // 5. Generate secure temporary password & hash with cost factor 12
  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // 6. Insert user
  const newUser = await repository.createUser(
    {
      name: formData.name?.trim() || null,
      email: cleanEmail,
      passwordHash,
      employeeId: formData.employeeId || null,
      assignedBranchIds: formData.assignedBranchIds || [],
      assignedDepartmentIds: formData.assignedDepartmentIds || [],
      isActive: true,
      mustChangePassword: true,
    },
    role.id
  );

  const fullUser = await repository.findUserWithRoleById(newUser.id);
  if (!fullUser) throw new UserNotFoundError(newUser.id);

  await recordAuditLog({
    action: "ADD",
    module: "USERS_ROLES",
    recordId: fullUser.name ? `${fullUser.name} (${fullUser.email})` : fullUser.email,
    newValues: {
      name: fullUser.name,
      email: fullUser.email,
      roleName: fullUser.roleName,
      isActive: fullUser.isActive,
    },
  });

  // Temp password returned to caller — do NOT log it in production

  return { user: fullUser, tempPassword };
}

/**
 * Updates user basic profile (name, email, role, employee link, and branch/dept scoping).
 */
export async function updateUser(id: string, formData: UserFormData): Promise<UserWithRole> {
  const existingUser = await repository.findUserWithRoleById(id);
  if (!existingUser) throw new UserNotFoundError(id);

  const validationErrors = validateUserFormData(formData);
  if (validationErrors) {
    throw new UserValidationError(validationErrors);
  }

  const cleanEmail = formData.email.trim().toLowerCase();

  // Company Admin email protection: Company Admin email cannot be changed from the tenant workspace
  const isCompanyAdmin =
    existingUser.roleSlug === "system_admin" ||
    existingUser.roleSlug === "admin" ||
    Boolean(existingUser.roleName?.toLowerCase().includes("admin"));

  if (isCompanyAdmin && cleanEmail !== existingUser.email.toLowerCase()) {
    throw new UserValidationError({
      email: "The Company Admin email cannot be modified from the tenant workspace. It can only be changed by the Super Admin in the Platform Control Plane.",
    });
  }

  // Email conflict check if changed
  if (cleanEmail !== existingUser.email.toLowerCase()) {
    const emailConflict = await repository.findUserByEmail(cleanEmail);
    if (emailConflict && emailConflict.id !== id) {
      throw new UserExistsError(cleanEmail);
    }
  }

  // Role check
  const role = await roleRepository.findRoleById(formData.roleId);
  if (!role) {
    throw new RoleNotFoundError(formData.roleId);
  }

  // Employee conflict check if changed
  if (formData.employeeId && formData.employeeId !== existingUser.employeeId) {
    const existingEmployeeUser = await repository.findUserByEmployeeId(formData.employeeId);
    if (existingEmployeeUser && existingEmployeeUser.id !== id) {
      throw new UserValidationError({
        employeeId: "This employee is already linked to another user account.",
      });
    }
  }

  await repository.updateUser(
    id,
    {
      name: formData.name?.trim() || null,
      email: cleanEmail,
      employeeId: formData.employeeId || null,
      assignedBranchIds: formData.assignedBranchIds || [],
      assignedDepartmentIds: formData.assignedDepartmentIds || [],
    },
    role.id
  );

  const updatedUser = await repository.findUserWithRoleById(id);
  if (!updatedUser) throw new UserNotFoundError(id);

  await recordAuditLog({
    action: "EDIT",
    module: "USERS_ROLES",
    recordId: updatedUser.name ? `${updatedUser.name} (${updatedUser.email})` : updatedUser.email,
    oldValues: {
      name: existingUser.name,
      email: existingUser.email,
      roleName: existingUser.roleName,
    },
    newValues: {
      name: updatedUser.name,
      email: updatedUser.email,
      roleName: updatedUser.roleName,
    },
  });

  return updatedUser;
}

/**
 * Updates temporary delegation of authority for a user.
 */
export async function updateUserDelegation(
  userId: string,
  formData: DelegationFormData
): Promise<UserWithRole> {
  const user = await repository.findUserWithRoleById(userId);
  if (!user) throw new UserNotFoundError(userId);

  if (formData.delegatedToUserId && formData.delegatedToUserId === userId) {
    throw new Error("Cannot delegate authority to oneself.");
  }

  let delegatedUntilDate: Date | null = null;
  if (formData.delegatedUntil) {
    delegatedUntilDate = new Date(formData.delegatedUntil);
  }

  await repository.updateUserDelegation(
    userId,
    formData.delegatedToUserId || null,
    delegatedUntilDate
  );

  const updatedUser = await repository.findUserWithRoleById(userId);
  if (!updatedUser) throw new UserNotFoundError(userId);

  await recordAuditLog({
    action: "EDIT",
    module: "USERS_ROLES",
    recordId: updatedUser.name ? `${updatedUser.name} (${updatedUser.email})` : updatedUser.email,
    newValues: {
      delegatedToUserName: updatedUser.delegatedToUserName,
      delegatedUntil: updatedUser.delegatedUntil,
    },
  });

  return updatedUser;
}

/**
 * Deactivates a user account with safety checks.
 */
export async function deactivateUser(id: string, currentUserId?: string): Promise<UserWithRole> {
  const user = await repository.findUserWithRoleById(id);
  if (!user) throw new UserNotFoundError(id);

  if (currentUserId && currentUserId === id) {
    throw new SelfDeactivationError();
  }

  if (user.roleSlug === "system_admin") {
    throw new SystemAdminProtectionError();
  }

  await repository.deactivateUser(id);

  const updatedUser = await repository.findUserWithRoleById(id);
  if (!updatedUser) throw new UserNotFoundError(id);

  await recordAuditLog({
    action: "EDIT",
    module: "USERS_ROLES",
    recordId: user.name ? `${user.name} (${user.email})` : user.email,
    oldValues: { isActive: true },
    newValues: { isActive: false },
  });

  return updatedUser;
}

/**
 * Reactivates a user account.
 */
export async function reactivateUser(id: string): Promise<UserWithRole> {
  const user = await repository.findUserWithRoleById(id);
  if (!user) throw new UserNotFoundError(id);

  await repository.reactivateUser(id);

  const updatedUser = await repository.findUserWithRoleById(id);
  if (!updatedUser) throw new UserNotFoundError(id);

  await recordAuditLog({
    action: "EDIT",
    module: "USERS_ROLES",
    recordId: user.name ? `${user.name} (${user.email})` : user.email,
    oldValues: { isActive: false },
    newValues: { isActive: true },
  });

  return updatedUser;
}

/**
 * Resets a user's password to a newly generated temporary password.
 */
export async function resetUserPassword(id: string): Promise<{
  user: UserWithRole;
  tempPassword: string;
}> {
  const user = await repository.findUserWithRoleById(id);
  if (!user) throw new UserNotFoundError(id);

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await repository.updateUserPassword(id, passwordHash);

  await recordAuditLog({
    action: "EDIT",
    module: "USERS_ROLES",
    recordId: user.name ? `${user.name} (${user.email})` : user.email,
    newValues: { passwordStatus: "Temporary Password Reset Issued" },
  });

  // Temp password returned to caller — do NOT log it in production

  return { user, tempPassword };
}

/**
 * Helper method for system automatic user creation (kept for backward compatibility with employee.service.ts).
 */
export async function createSecureUserAccount(
  employeeId: string, 
  email: string, 
  roleSlug: string = "standard_staff"
) {
  const existing = await repository.findUserByEmail(email);
  if (existing) {
    throw new UserExistsError(email);
  }

  const role = await roleRepository.findRoleBySlug(roleSlug);
  if (!role) {
    throw new RoleNotFoundError(roleSlug);
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await repository.createUser({
    employeeId,
    email,
    passwordHash,
    isActive: true,
    mustChangePassword: true,
  }, role.id);

  return { user, tempPassword };
}
