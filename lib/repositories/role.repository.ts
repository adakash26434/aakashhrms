import { getDb } from '@/lib/db';
import { roles, permissions, rolePermissions, rolePermissionChangeLog, auditLogs, userRoles, users, employees } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ScopeType } from '@/lib/types/role';

export type RoleRow = typeof roles.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type PermissionRow = typeof permissions.$inferSelect;

export interface RoleWithStats extends RoleRow {
  userCount: number;
  permissionCount: number;
}

export async function findAllRoles(): Promise<RoleRow[]> {
  try {
    return await (await getDb()).select().from(roles).orderBy(roles.createdAt);
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to fetch roles:', error);
    return [];
  }
}

export async function findAllRolesWithStats(): Promise<RoleWithStats[]> {
  try {
    const allRoles = await (await getDb()).select().from(roles).orderBy(roles.createdAt);
    
    // Aggregate user counts
    const userCountRows = await (await getDb())
      .select({
        roleId: userRoles.roleId,
        count: sql<number>`count(*)`,
      })
      .from(userRoles)
      .groupBy(userRoles.roleId);
    
    const userCountMap = new Map(userCountRows.map((r) => [r.roleId, Number(r.count || 0)]));

    // Aggregate permission counts
    const permCountRows = await (await getDb())
      .select({
        roleId: rolePermissions.roleId,
        count: sql<number>`count(*)`,
      })
      .from(rolePermissions)
      .groupBy(rolePermissions.roleId);
    
    const permCountMap = new Map(permCountRows.map((r) => [r.roleId, Number(r.count || 0)]));

    return allRoles.map((role) => ({
      ...role,
      userCount: userCountMap.get(role.id) || 0,
      permissionCount: permCountMap.get(role.id) || 0,
    }));
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to fetch roles with stats:', error);
    return [];
  }
}

export async function findAllPermissions(): Promise<PermissionRow[]> {
  try {
    return await (await getDb()).select().from(permissions);
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to fetch permissions:', error);
    return [];
  }
}

export async function findRoleById(id: string): Promise<RoleRow | null> {
  try {
    const result = await (await getDb()).select().from(roles).where(eq(roles.id, id));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to find role by id:', error);
    return null;
  }
}

export async function findRoleBySlug(slug: string): Promise<RoleRow | null> {
  try {
    const result = await (await getDb()).select().from(roles).where(eq(roles.slug, slug));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to find role by slug:', error);
    return null;
  }
}

export async function findRoleByName(name: string): Promise<RoleRow | null> {
  try {
    const result = await (await getDb()).select().from(roles).where(eq(roles.name, name));
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to find role by name:', error);
    return null;
  }
}

export async function createRole(data: {
  name: string;
  slug: string;
  scopeType: ScopeType;
  description?: string | null;
  isSystemRole?: boolean;
  isProtected?: boolean;
}): Promise<RoleRow> {
  const [newRole] = await (await getDb())
    .insert(roles)
    .values({
      name: data.name,
      slug: data.slug,
      scopeType: data.scopeType,
      description: data.description || null,
      isSystemRole: data.isSystemRole ?? false,
      isProtected: data.isProtected ?? false,
    })
    .returning();

  return newRole;
}

export async function updateRole(
  id: string,
  data: {
    name?: string;
    scopeType?: ScopeType;
    description?: string | null;
  }
): Promise<RoleRow | null> {
  const updatePayload: Partial<typeof roles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.scopeType !== undefined) updatePayload.scopeType = data.scopeType;
  if (data.description !== undefined) updatePayload.description = data.description;

  const [updated] = await (await getDb())
    .update(roles)
    .set(updatePayload)
    .where(eq(roles.id, id))
    .returning();

  return updated || null;
}

export async function countUsersAssignedToRole(roleId: string): Promise<number> {
  try {
    const res = await (await getDb())
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return Number(res[0]?.count || 0);
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to count users for role:', error);
    return 0;
  }
}

export async function getRolePermissions(roleId: string) {
  try {
    return await (await getDb())
      .select({
        id: permissions.id,
        action: permissions.action,
        module: permissions.module,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
  } catch (error) {
    console.error('[ROLE_REPOSITORY] Failed to get role permissions:', error);
    return [];
  }
}

export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[],
  changedByUserId: string
) {
  return await (await getDb()).transaction(async (tx) => {
    // Get existing permissions for diffing
    const oldPermissions = await tx
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    const oldIds = oldPermissions.map((p) => p.permissionId);

    // Get role name for snapshot
    const roleRows = await tx.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId));
    const roleName = roleRows[0]?.name || 'Unknown Role';

    const grantedIds = permissionIds.filter((id) => !oldIds.includes(id));
    const revokedIds = oldIds.filter((id) => !permissionIds.includes(id));

    // Clear existing
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Insert new
    if (permissionIds.length > 0) {
      const values = permissionIds.map((pId) => ({
        roleId,
        permissionId: pId,
      }));
      await tx.insert(rolePermissions).values(values);
    }

    // Insert change log entries into rolePermissionChangeLog
    const logEntries = [
      ...grantedIds.map((pId) => ({
        changedByUserId,
        roleId,
        permissionId: pId,
        changeType: 'GRANTED' as const,
        affectedRoleName: roleName,
      })),
      ...revokedIds.map((pId) => ({
        changedByUserId,
        roleId,
        permissionId: pId,
        changeType: 'REVOKED' as const,
        affectedRoleName: roleName,
      })),
    ];

    if (logEntries.length > 0) {
      await tx.insert(rolePermissionChangeLog).values(logEntries);

      // Also record system audit log entry
      await tx.insert(auditLogs).values({
        userId: changedByUserId,
        action: 'EDIT',
        module: 'USERS_ROLES',
        recordId: `${roleName} Permissions`,
        result: 'SUCCESS',
        newValues: {
          roleName,
          grantedPermissionsCount: grantedIds.length,
          revokedPermissionsCount: revokedIds.length,
        },
        ipAddress: '127.0.0.1',
      });
    }
  });
}

export async function cloneRole(
  sourceRoleId: string,
  newRoleData: {
    name: string;
    slug: string;
    scopeType: ScopeType;
    description?: string | null;
  },
  changedByUserId: string
): Promise<RoleRow> {
  return await (await getDb()).transaction(async (tx) => {
    // 1. Fetch source role permissions
    const sourcePerms = await tx
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, sourceRoleId));

    // 2. Create new role
    const [newRole] = await tx
      .insert(roles)
      .values({
        name: newRoleData.name,
        slug: newRoleData.slug,
        scopeType: newRoleData.scopeType,
        description: newRoleData.description || null,
        isSystemRole: false,
        isProtected: false,
      })
      .returning();

    // 3. Copy permissions
    if (sourcePerms.length > 0) {
      const permsToInsert = sourcePerms.map((p) => ({
        roleId: newRole.id,
        permissionId: p.permissionId,
      }));
      await tx.insert(rolePermissions).values(permsToInsert);
    }

    // 4. Audit Log
    await tx.insert(auditLogs).values({
      userId: changedByUserId,
      action: 'ADD',
      module: 'USERS_ROLES',
      recordId: newRole.id,
      result: 'SUCCESS',
      newValues: {
        clonedFromRoleId: sourceRoleId,
        newRoleName: newRole.name,
        newRoleSlug: newRole.slug,
        copiedPermissionsCount: sourcePerms.length,
      },
      ipAddress: '127.0.0.1',
    });

    return newRole;
  });
}

export async function deleteRole(id: string): Promise<boolean> {
  const res = await (await getDb()).delete(roles).where(eq(roles.id, id)).returning({ id: roles.id });
  return res.length > 0;
}

export async function findUsersByRoleId(roleId: string) {
  return await (await getDb())
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      employeeId: users.employeeId,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(eq(userRoles.roleId, roleId));
}

export async function assignUsersToRole(
  roleId: string,
  userIdsToAdd: string[],
  userIdsToRemove: string[],
  changedByUserId: string
) {
  return await (await getDb()).transaction(async (tx) => {
    // 1. Resolve fallback employee role for users being removed from this role
    let fallbackRoleId: string | null = null;
    if (userIdsToRemove.length > 0) {
      const [empRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.slug, 'employee'))
        .limit(1);
      fallbackRoleId = empRole?.id || null;
    }

    // 2. Add users to this role (replaces user_roles row)
    for (const userId of userIdsToAdd) {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      await tx.insert(userRoles).values({
        userId,
        roleId,
      });
    }

    // 3. Remove users from this role (reassigns to fallback employee role if available)
    for (const userId of userIdsToRemove) {
      await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
      if (fallbackRoleId && fallbackRoleId !== roleId) {
        await tx.insert(userRoles).values({
          userId,
          roleId: fallbackRoleId,
        });
      }
    }

    // 4. Record audit log
    await tx.insert(auditLogs).values({
      userId: changedByUserId,
      action: 'EDIT',
      module: 'USERS_ROLES',
      recordId: roleId,
      result: 'SUCCESS',
      newValues: {
        assignedUserIds: userIdsToAdd,
        removedUserIds: userIdsToRemove,
      },
      ipAddress: '127.0.0.1',
    });
  });
}

