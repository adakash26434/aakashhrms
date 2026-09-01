import { getDb } from "@/lib/db";
import { users, userRoles, roles, employees, departments, designations, branches, auditLogs } from "@/lib/db/schema";
import { eq, and, or, ilike, sql, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { UserFilter, UserWithRole, UserKPIs, UserAuditLogEntry } from "../types/user";

export type UserRow = typeof users.$inferSelect;

const delegatedUsers = alias(users, "delegated_users");

export async function findAllUsers() {
  return await getDb().select().from(users);
}

export async function findUserByEmail(email: string) {
  const result = await getDb().select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  return result.length > 0 ? result[0] : null;
}

export async function findUserByEmployeeId(employeeId: string) {
  const result = await getDb().select().from(users).where(eq(users.employeeId, employeeId));
  return result.length > 0 ? result[0] : null;
}

/**
 * Finds all users joined with primary role details, employee details, delegation details,
 * and scoping assignments.
 */
export async function findAllUsersWithRoles(filter?: UserFilter): Promise<UserWithRole[]> {
  const conditions = [];

  if (filter?.search && filter.search.trim()) {
    const searchPattern = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, searchPattern),
        ilike(users.name, searchPattern),
        ilike(employees.firstName, searchPattern),
        ilike(employees.lastName, searchPattern),
        ilike(employees.employeeCode, searchPattern)
      )
    );
  }

  if (filter?.roleId && filter.roleId !== "all") {
    conditions.push(eq(userRoles.roleId, filter.roleId));
  }

  if (filter?.status && filter.status !== "all") {
    const isActive = filter.status === "active";
    conditions.push(eq(users.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      employeeId: users.employeeId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      delegatedToUserId: users.delegatedToUserId,
      delegatedToUserName: delegatedUsers.name,
      delegatedToUserEmail: delegatedUsers.email,
      delegatedUntil: users.delegatedUntil,
      assignedBranchIds: users.assignedBranchIds,
      assignedDepartmentIds: users.assignedDepartmentIds,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleId: roles.id,
      roleName: roles.name,
      roleSlug: roles.slug,
      roleScopeType: roles.scopeType,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      branchName: branches.name,
      branchCode: branches.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      designationName: designations.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(delegatedUsers, eq(users.delegatedToUserId, delegatedUsers.id))
    .where(whereClause)
    .orderBy(sql`${users.createdAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    employeeId: r.employeeId,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    delegatedToUserId: r.delegatedToUserId ?? null,
    delegatedToUserName: r.delegatedToUserName || r.delegatedToUserEmail || null,
    delegatedUntil: r.delegatedUntil ?? null,
    assignedBranchIds: r.assignedBranchIds || [],
    assignedDepartmentIds: r.assignedDepartmentIds || [],
    roleId: r.roleId ?? null,
    roleName: r.roleName ?? null,
    roleSlug: r.roleSlug ?? null,
    roleScopeType: (r.roleScopeType as "GLOBAL" | "BRANCH" | "DEPARTMENT" | "SELF") ?? null,
    employeeCode: r.employeeCode ?? null,
    employeeName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.firstName || null,
    employeeBranch: r.branchName ?? null,
    employeeBranchCode: r.branchCode ?? null,
    employeeDepartment: r.departmentName ?? null,
    employeeDepartmentCode: r.departmentCode ?? null,
    employeeDesignation: r.designationName ?? null,
  }));
}

/**
 * Finds a single user with joined role, employee, delegation, and scoping details.
 */
export async function findUserWithRoleById(id: string): Promise<UserWithRole | null> {
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      employeeId: users.employeeId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      delegatedToUserId: users.delegatedToUserId,
      delegatedToUserName: delegatedUsers.name,
      delegatedToUserEmail: delegatedUsers.email,
      delegatedUntil: users.delegatedUntil,
      assignedBranchIds: users.assignedBranchIds,
      assignedDepartmentIds: users.assignedDepartmentIds,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleId: roles.id,
      roleName: roles.name,
      roleSlug: roles.slug,
      roleScopeType: roles.scopeType,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      branchName: branches.name,
      branchCode: branches.code,
      departmentName: departments.name,
      departmentCode: departments.code,
      designationName: designations.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .leftJoin(branches, eq(employees.branchId, branches.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(delegatedUsers, eq(users.delegatedToUserId, delegatedUsers.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!rows.length) return null;

  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    employeeId: r.employeeId,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    delegatedToUserId: r.delegatedToUserId ?? null,
    delegatedToUserName: r.delegatedToUserName || r.delegatedToUserEmail || null,
    delegatedUntil: r.delegatedUntil ?? null,
    assignedBranchIds: r.assignedBranchIds || [],
    assignedDepartmentIds: r.assignedDepartmentIds || [],
    roleId: r.roleId ?? null,
    roleName: r.roleName ?? null,
    roleSlug: r.roleSlug ?? null,
    roleScopeType: (r.roleScopeType as "GLOBAL" | "BRANCH" | "DEPARTMENT" | "SELF") ?? null,
    employeeCode: r.employeeCode ?? null,
    employeeName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.firstName || null,
    employeeBranch: r.branchName ?? null,
    employeeBranchCode: r.branchCode ?? null,
    employeeDepartment: r.departmentName ?? null,
    employeeDepartmentCode: r.departmentCode ?? null,
    employeeDesignation: r.designationName ?? null,
  };
}

/**
 * Creates a new user record and assigns the given roleId in a single transaction.
 */
export async function createUser(data: typeof users.$inferInsert, roleId?: string) {
  return await getDb().transaction(async (tx) => {
    const newUsers = await tx.insert(users).values({
      ...data,
      email: data.email.trim().toLowerCase(),
    }).returning();
    const user = newUsers[0];

    if (roleId) {
      await tx.insert(userRoles).values({
        userId: user.id,
        roleId: roleId,
      });
    }

    return user;
  });
}

/**
 * Updates user basic details, role, and scoping assignments.
 */
export async function updateUser(id: string, data: Partial<typeof users.$inferInsert>, roleId?: string) {
  return await getDb().transaction(async (tx) => {
    const updatePayload: Partial<typeof users.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.email) {
      updatePayload.email = data.email.trim().toLowerCase();
    }

    const result = await tx.update(users)
      .set(updatePayload)
      .where(eq(users.id, id))
      .returning();

    if (roleId) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx.insert(userRoles).values({
        userId: id,
        roleId: roleId,
      });
    }

    return result[0];
  });
}

/**
 * Updates a user's delegation configuration (proxy user & expiration date).
 */
export async function updateUserDelegation(
  userId: string,
  delegatedToUserId: string | null,
  delegatedUntil: Date | null
) {
  const result = await getDb().update(users)
    .set({
      delegatedToUserId,
      delegatedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return result[0];
}

/**
 * Retrieves audit logs for a specific user.
 */
export async function findAuditLogsByUserId(userId: string, limit: number = 50): Promise<UserAuditLogEntry[]> {
  const rows = await getDb()
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      module: auditLogs.module,
      recordId: auditLogs.recordId,
      result: auditLogs.result,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      ipAddress: auditLogs.ipAddress,
      createdAtFormatted: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(sql`${auditLogs.createdAt} DESC`)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    module: r.module,
    recordId: r.recordId,
    result: r.result,
    oldValues: (r.oldValues as Record<string, unknown>) ?? null,
    newValues: (r.newValues as Record<string, unknown>) ?? null,
    ipAddress: r.ipAddress,
    createdAt: r.createdAtFormatted ? new Date(r.createdAtFormatted) : new Date(),
  }));
}

/**
 * Updates a user's password hash.
 */
export async function updateUserPassword(id: string, passwordHash: string) {
  const result = await getDb().update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

/**
 * Soft-deactivates a user.
 */
export async function deactivateUser(id: string) {
  const result = await getDb().update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

/**
 * Reactivates a user account.
 */
export async function reactivateUser(id: string) {
  const result = await getDb().update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

/**
 * Hard deletes a user (internal use only).
 */
export async function deleteUser(id: string) {
  await getDb().delete(users).where(eq(users.id, id));
}

/**
 * Computes User KPIs for summary metrics.
 */
export async function countUsersKPIs(): Promise<UserKPIs> {
  const all = await getDb().select({
    id: users.id,
    isActive: users.isActive,
    employeeId: users.employeeId,
  }).from(users);

  const total = all.length;
  const active = all.filter((u) => u.isActive).length;
  const inactive = total - active;
  const linkedToEmployee = all.filter((u) => u.employeeId !== null).length;
  const unlinked = total - linkedToEmployee;

  return { total, active, inactive, linkedToEmployee, unlinked };
}

/**
 * Returns employees who are not yet linked to any user account.
 */
export async function getUnlinkedEmployees() {
  const rows = await getDb()
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employees)
    .where(
      and(
        eq(employees.status, "Active"),
        sql`${employees.id} NOT IN (SELECT employee_id FROM users WHERE employee_id IS NOT NULL)`
      )
    )
    .orderBy(employees.firstName);

  return rows.map((e: { id: string; employeeCode: string; firstName: string; lastName: string }) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    name: `${e.firstName} ${e.lastName}`,
  }));
}
