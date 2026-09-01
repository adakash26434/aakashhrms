import { auth } from '@/lib/auth';
import { getDbAsync } from '@/lib/db';
import { userRoles, rolePermissions, permissions, roles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Returns the set of permission module names the current user has VIEW access to.
 * Admin roles (system_admin, office_admin) get ALL modules.
 * Returns an empty set if the user has no permissions or is not authenticated.
 */
export async function getUserAllowedModules(): Promise<Set<string>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Set();
    }

    const db = await getDbAsync();

    // 1. Check if user has admin role (full access bypass)
    const userRolesResult = await db
      .select({ slug: roles.slug })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id));

    const isAdmin = userRolesResult.some(
      (r) => r.slug === 'system_admin' || r.slug === 'office_admin'
    );

    if (isAdmin) {
      // Return all known modules
      return new Set([
        'SYSTEM_CONTROL',
        'FISCAL_YEAR',
        'TAX_RATES',
        'PAY_HEADS',
        'HOLIDAYS',
        'EMPLOYEES',
        'SALARY_MAPPING',
        'ATTENDANCE',
        'LEAVE_APPLICATIONS',
        'LEAVE_APPROVALS',
        'OT_RULES',
        'LEAVE_RULES',
        'LEAVE_TYPES',
        'PAYROLL_GENERATE',
        'PAYROLL_REVIEW',
        'LEAVE_SALARY',
        'LOANS',
        'REPORTS_SALARY_SHEET',
        'REPORTS_PAYSLIP',
        'REPORTS_ATTENDANCE',
        'REPORTS_TAX_IRD',
        'REPORTS_LEAVE',
        'REPORTS_LOAN',
        'USERS_ROLES',
        'AUDIT_LOG',
        'ORG_STRUCTURE',
        'SELF_SERVICE',
      ]);
    }

    // 2. Query the user's specific VIEW permissions from role_permissions
    const viewPermissions = await db
      .select({ module: permissions.module })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, session.user.id),
          eq(permissions.action, 'VIEW')
        )
      );

    return new Set(viewPermissions.map((p) => p.module));
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
