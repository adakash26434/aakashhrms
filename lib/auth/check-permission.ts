import { auth } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { setRequestScopeTenantDb } from '@/lib/db/tenant-context';
import { userRoles, rolePermissions, permissions, roles, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveUserScope, type ScopeFilter } from './scope-filter';
import { getImpersonationSession } from '@/lib/platform/impersonation';

// Re-export for convenience
export type { ScopeFilter } from './scope-filter';

// Union type for all permission modules
type PermissionModule =
  | 'SYSTEM_CONTROL'
  | 'FISCAL_YEAR'
  | 'TAX_RATES'
  | 'PAY_HEADS'
  | 'HOLIDAYS'
  | 'EMPLOYEES'
  | 'SALARY_MAPPING'
  | 'ATTENDANCE'
  | 'LEAVE_APPLICATIONS'
  | 'LEAVE_APPROVALS'
  | 'OT_RULES'
  | 'LEAVE_RULES'
  | 'LEAVE_TYPES'
  | 'PAYROLL_GENERATE'
  | 'PAYROLL_REVIEW'
  | 'LEAVE_SALARY'
  | 'LOANS'
  | 'REPORTS_SALARY_SHEET'
  | 'REPORTS_PAYSLIP'
  | 'REPORTS_ATTENDANCE'
  | 'REPORTS_TAX_IRD'
  | 'REPORTS_LEAVE'
  | 'REPORTS_LOAN'
  | 'USERS_ROLES'
  | 'AUDIT_LOG'
  | 'ORG_STRUCTURE'
  | 'SELF_SERVICE';

type PermissionAction = 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'LOCK';

/**
 * Core permission verification logic shared by both `checkPermission()` and `checkPermissionWithScope()`.
 * Returns the authenticated user's ID if permission is granted.
 * @throws Error if not authenticated, inactive, or lacking the required permission.
 */
async function verifyPermission(
  action: PermissionAction,
  module: PermissionModule
): Promise<string> {
  // Check if a Super Admin is viewing via Impersonation mode (full access)
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return impersonation.actorId;
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not authenticated');
  }

  // Pass session.user.tenantSlug so tenant database is directly resolved
  const activeDb = await getDbAsync(session.user.tenantSlug);
  if (session.user.tenantSlug) {
    setRequestScopeTenantDb(session.user.tenantSlug, activeDb);
  }

  // 1. Re-verify active user status from database on every check (protects against deactivated active JWTs)
  const userRows = await activeDb
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (userRows.length === 0 || !userRows[0].isActive) {
    throw new Error('Unauthorized: User account is inactive or disabled');
  }

  // 2. Check if user has system_admin or office_admin role (bypasses module permission checks)
  const userRolesResult = await activeDb
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id));

  const isAdmin = userRolesResult.some((r: { slug: string }) => r.slug === 'system_admin' || r.slug === 'office_admin');
  if (isAdmin) {
    return session.user.id; // System Administrator / Office Administrator has full access
  }

  // 3. SELF_SERVICE module: allow access if user has a SELF-scoped role (no explicit permission row needed)
  if (module === 'SELF_SERVICE') {
    const scopeResult = await activeDb
      .select({ scopeType: roles.scopeType })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    // Any authenticated user can access self-service for VIEW actions
    if (action === 'VIEW' || action === 'ADD') {
      return session.user.id;
    }
  }

  // 4. Query database dynamically by joining userRoles, rolePermissions, and permissions
  const allowed = await activeDb
    .select({ id: permissions.id })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, session.user.id),
        eq(permissions.action, action),
        eq(permissions.module, module)
      )
    )
    .limit(1);

  if (allowed.length === 0) {
    throw new Error(`Unauthorized: Required permission [${action} ${module}] is missing.`);
  }

  return session.user.id;
}

/**
 * Checks if the currently authenticated user has permission to perform a specific action on a module.
 * Performs a fresh database lookup rather than relying on stale JWT tokens, and verifies user isActive status.
 * 
 * @param action - The action type (e.g., 'VIEW', 'ADD', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'LOCK')
 * @param module - The module name (e.g., 'USERS_ROLES', 'EMPLOYEES', etc.)
 * @throws Error if the user is not authenticated, deactivated, has no role assigned, or lacks permissions.
 */
export async function checkPermission(
  action: PermissionAction,
  module: PermissionModule
): Promise<void> {
  await verifyPermission(action, module);
}

/**
 * Checks permission AND returns the user's scope filter for data-level enforcement.
 * Use this instead of `checkPermission()` when building queries that must respect
 * BRANCH/DEPARTMENT/SELF scope restrictions.
 * 
 * @param action - The action type
 * @param module - The module name
 * @returns ScopeFilter containing the user's scope constraints for query filtering
 * @throws Error if the user is not authenticated, deactivated, or lacks permissions.
 */
export async function checkPermissionWithScope(
  action: PermissionAction,
  module: PermissionModule
): Promise<ScopeFilter> {
  const session = await auth();
  const userId = await verifyPermission(action, module);
  return resolveUserScope(userId, session?.user?.tenantSlug);
}
