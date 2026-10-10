import { cache } from 'react';
import { auth } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { userRoles, rolePermissions, permissions, roles, users, moduleEnum } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { ActionType, ModuleType } from '@/lib/types/role';

/** Role slugs that hold every permission (the bypass in `verifyPermission`). */
export const ADMIN_ROLE_SLUGS: readonly string[] = ['system_admin', 'office_admin'];

/**
 * Everything a user's roles grant, read in one query. It follows `verifyPermission`: company
 * administrators hold every permission and a SELF-scoped role adds self-service view / add / edit;
 * an inactive user holds nothing. It answers "what could this person see or act on" for the
 * navigation and the notification centre (F17). It is never access control on its own: pages and
 * actions keep checking with `checkPermission` / `hasPermission`.
 */
export interface PermissionSet {
  isAdmin: boolean;
  /** `ACTION:MODULE` pairs the user's roles grant. */
  grants: ReadonlySet<string>;
}

export const NO_PERMISSIONS: PermissionSet = { isAdmin: false, grants: new Set() };

const grantKey = (action: string, module: string) => `${action}:${module}`;

export function can(set: PermissionSet, action: ActionType, module: ModuleType): boolean {
  return set.isAdmin || set.grants.has(grantKey(action, module));
}

/**
 * The permission set of one user, without a session (the request's own user, or a user a
 * scheduled job writes to). Pass the tenant slug when the request has none of its own.
 */
export async function permissionSetFor(userId: string, tenantSlug?: string | null): Promise<PermissionSet> {
  const db = await getDbAsync(tenantSlug);
  const rows = await db
    .select({ slug: roles.slug, scopeType: roles.scopeType, action: permissions.action, module: permissions.module })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(users.id, userId), eq(users.isActive, true)));

  const grants = new Set<string>();
  for (const r of rows) if (r.action && r.module) grants.add(grantKey(r.action, r.module));
  if (rows.some((r) => r.scopeType === 'SELF')) {
    for (const action of ['VIEW', 'ADD', 'EDIT'] as const) grants.add(grantKey(action, 'SELF_SERVICE'));
  }
  return { isAdmin: rows.some((r) => ADMIN_ROLE_SLUGS.includes(r.slug)), grants };
}

/** The signed-in user's permission set, read once per request (layout, frame and pages share it). */
export const getUserPermissionSet = cache(async (): Promise<PermissionSet> => {
  const session = await auth();
  if (!session?.user?.id) return NO_PERMISSIONS;
  return permissionSetFor(session.user.id, session.user.tenantSlug);
});

/**
 * Returns the set of permission module names the current user has VIEW access to.
 * Admin roles (system_admin, office_admin) get ALL modules.
 * Returns an empty set if the user has no permissions or is not authenticated.
 */
export async function getUserAllowedModules(): Promise<Set<string>> {
  try {
    const set = await getUserPermissionSet();
    // Every module there is: the schema's enum, never a hand-kept list (one went stale and hid
    // the newer modules — welfare funds, travel, assets… — from administrators' navigation).
    if (set.isAdmin) return new Set(moduleEnum.enumValues);
    return new Set(moduleEnum.enumValues.filter((module) => set.grants.has(grantKey('VIEW', module))));
  } catch (error) {
    console.error('[GET_USER_ALLOWED_MODULES] Error:', error);
    return new Set();
  }
}

/**
 * Returns the allowed modules as a plain string array (for serialization to client components).
 */
export async function getUserAllowedModulesArray(): Promise<string[]> {
  const modules = await getUserAllowedModules();
  return Array.from(modules);
}
