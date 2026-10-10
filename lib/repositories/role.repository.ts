import { getDb } from '@/lib/db';
import { roles, permissions, rolePermissions, rolePermissionChangeLog, userRoles, users, employees } from '@/lib/db/schema';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { ActionType, ModuleType, ScopeType } from '@/lib/types/role';
import { grantKey, splitGrant } from '@/lib/engines/role.engine';
import type { Tx } from './user.repository';

// Roles and their permissions (4.13). Changes run inside the service's `administrationTx` (one
// company-wide lock); every grant and revoke also lands in role_permission_change_log.

export type RoleRow = typeof roles.$inferSelect;
export type PermissionRow = typeof permissions.$inferSelect;
type Q = Awaited<ReturnType<typeof getDb>> | Tx;

export interface RoleRecord extends RoleRow {
  /** "ACTION:MODULE" keys stored for the role. */
  grants: string[];
  logins: number;
  activeLogins: number;
}

/** Every role with its stored permissions and how many logins hold it. */
export async function findRoleRecords(q?: Q): Promise<RoleRecord[]> {
  const db = q ?? (await getDb());
  const [roleRows, grantRows, loginRows] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.createdAt), asc(roles.name)),
    db
      .select({ roleId: rolePermissions.roleId, action: permissions.action, module: permissions.module })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)),
    db
      .select({ roleId: userRoles.roleId, logins: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${users.isActive})::int` })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .groupBy(userRoles.roleId),
  ]);
  const grants = new Map<string, string[]>();
  for (const g of grantRows) grants.set(g.roleId, [...(grants.get(g.roleId) ?? []), grantKey(g.action, g.module)]);
  const counts = new Map(loginRows.map((r) => [r.roleId, r]));
  return roleRows.map((r) => ({ ...r, grants: grants.get(r.id) ?? [], logins: counts.get(r.id)?.logins ?? 0, activeLogins: counts.get(r.id)?.active ?? 0 }));
}

/** One role with its permissions and holders (null when it doesn't exist). */
export async function findRoleRecord(id: string, q?: Q): Promise<RoleRecord | null> {
  const all = await findRoleRecords(q);
  return all.find((r) => r.id === id) ?? null;
}

/** Permission rows for these keys, created when a company's matrix lacks one (ids by key). */
async function permissionIds(tx: Tx, keys: readonly string[]): Promise<Map<string, string>> {
  if (!keys.length) return new Map();
  const pairs = keys.map(splitGrant);
  await tx
    .insert(permissions)
    .values(pairs.map((p) => ({ action: p.action as ActionType, module: p.module as ModuleType })))
    .onConflictDoNothing();
  const rows = await tx
    .select({ id: permissions.id, action: permissions.action, module: permissions.module })
    .from(permissions)
    .where(inArray(sql`${permissions.action}::text || ':' || ${permissions.module}::text`, [...keys]));
  return new Map(rows.map((r) => [grantKey(r.action, r.module), r.id]));
}

export async function createRoleTx(tx: Tx, values: { name: string; slug: string; scopeType: ScopeType; description: string | null }): Promise<RoleRow> {
  const [row] = await tx.insert(roles).values({ ...values, isSystemRole: false, isProtected: false }).returning();
  return row;
}

export async function updateRoleTx(tx: Tx, id: string, values: { name: string; scopeType: ScopeType; description: string | null }): Promise<void> {
  await tx.update(roles).set({ ...values, updatedAt: new Date() }).where(eq(roles.id, id));
}

/**
 * Replaces a role's permissions with `next` and logs each grant and revoke (who, when, the role's
 * name at the time). Returns what changed.
 */
export async function setRoleGrantsTx(tx: Tx, role: { id: string; name: string }, before: readonly string[], next: readonly string[], actorId: string): Promise<{ added: string[]; removed: string[] }> {
  const was = new Set(before);
  const now = new Set(next);
  const added = next.filter((k) => !was.has(k));
  const removed = before.filter((k) => !now.has(k));
  if (!added.length && !removed.length) return { added, removed };
  const ids = await permissionIds(tx, [...added, ...removed]);
  const removedIds = removed.map((k) => ids.get(k)).filter((x): x is string => !!x);
  if (removedIds.length) await tx.delete(rolePermissions).where(and(eq(rolePermissions.roleId, role.id), inArray(rolePermissions.permissionId, removedIds)));
  const addedIds = added.map((k) => ids.get(k)).filter((x): x is string => !!x);
  if (addedIds.length) await tx.insert(rolePermissions).values(addedIds.map((permissionId) => ({ roleId: role.id, permissionId }))).onConflictDoNothing();
  const log = [
    ...added.map((k) => ({ key: k, changeType: 'GRANTED' as const })),
    ...removed.map((k) => ({ key: k, changeType: 'REVOKED' as const })),
  ].filter((e) => ids.has(e.key));
  if (log.length) {
    await tx.insert(rolePermissionChangeLog).values(
      log.map((e) => ({ changedByUserId: actorId, roleId: role.id, permissionId: ids.get(e.key)!, changeType: e.changeType, affectedRoleName: role.name }))
    );
  }
  await tx.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, role.id));
  return { added, removed };
}

export async function deleteRoleTx(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.delete(roles).where(eq(roles.id, id)).returning({ id: roles.id });
  return rows.length > 0;
}

export interface PermissionChangeRecord {
  id: string;
  at: Date;
  roleId: string | null;
  roleName: string;
  byUserId: string;
  byName: string | null;
  byEmail: string | null;
  grant: string | null;
  change: 'GRANTED' | 'REVOKED';
}

/** Grants and revokes, newest first: one role's, or every role's. */
export async function findPermissionChanges(opts: { roleId?: string; since?: Date | null; limit?: number } = {}): Promise<PermissionChangeRecord[]> {
  const rows = await (await getDb())
    .select({
      id: rolePermissionChangeLog.id,
      at: rolePermissionChangeLog.createdAt,
      roleId: rolePermissionChangeLog.roleId,
      roleName: rolePermissionChangeLog.affectedRoleName,
      byUserId: rolePermissionChangeLog.changedByUserId,
      byName: users.name,
      byEmail: users.email,
      action: permissions.action,
      module: permissions.module,
      change: rolePermissionChangeLog.changeType,
    })
    .from(rolePermissionChangeLog)
    .leftJoin(users, eq(users.id, rolePermissionChangeLog.changedByUserId))
    .leftJoin(permissions, eq(permissions.id, rolePermissionChangeLog.permissionId))
    .where(
      and(
        opts.roleId ? eq(rolePermissionChangeLog.roleId, opts.roleId) : undefined,
        opts.since ? gte(rolePermissionChangeLog.createdAt, opts.since) : undefined
      )
    )
    .orderBy(desc(rolePermissionChangeLog.createdAt), asc(rolePermissionChangeLog.id))
    .limit(Math.min(opts.limit ?? 300, 1000));
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    roleId: r.roleId,
    roleName: r.roleName,
    byUserId: r.byUserId,
    byName: r.byName,
    byEmail: r.byEmail,
    grant: r.action && r.module ? grantKey(r.action, r.module) : null,
    change: r.change === 'REVOKED' ? 'REVOKED' : 'GRANTED',
  }));
}

// ---------------------------------------------------------------------------
// Used by the employee record (S44), payroll and scripts
// ---------------------------------------------------------------------------

export async function findAllRoles(): Promise<RoleRow[]> {
  return (await getDb()).select().from(roles).orderBy(asc(roles.createdAt));
}

export async function findRoleById(id: string): Promise<RoleRow | null> {
  const result = await (await getDb()).select().from(roles).where(eq(roles.id, id));
  return result[0] ?? null;
}

export async function findRoleBySlug(slug: string): Promise<RoleRow | null> {
  const result = await (await getDb()).select().from(roles).where(eq(roles.slug, slug));
  return result[0] ?? null;
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
