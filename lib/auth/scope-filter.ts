import { getDbAsync } from '@/lib/db';
import { users, roles, userRoles, employees } from '@/lib/db/schema';
import { eq, and, inArray, SQL, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScopeType = 'GLOBAL' | 'BRANCH' | 'DEPARTMENT' | 'SELF';

/**
 * Returned by `checkPermissionWithScope()` after verifying permissions.
 * Contains the user's scope constraints that must be applied to data queries.
 */
export interface ScopeFilter {
  scopeType: ScopeType;
  branchIds: string[];        // From users.assignedBranchIds (for BRANCH scope)
  departmentIds: string[];    // From users.assignedDepartmentIds (for DEPARTMENT scope)
  employeeId: string | null;  // From users.employeeId (for SELF scope)
  userId: string;             // The authenticated user's ID
}

// ---------------------------------------------------------------------------
// Scope Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the full scope filter for a given user by looking up their role's scopeType
 * and their assigned branch/department IDs.
 */
export async function resolveUserScope(userId: string): Promise<ScopeFilter> {
  const activeDb = await getDbAsync();

  // Get user's assigned scoping data
  const [userRow] = await activeDb
    .select({
      employeeId: users.employeeId,
      assignedBranchIds: users.assignedBranchIds,
      assignedDepartmentIds: users.assignedDepartmentIds,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    throw new Error('Unauthorized: User not found for scope resolution');
  }

  // Get user's role's scopeType
  const roleResult = await activeDb
    .select({ scopeType: roles.scopeType, slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .limit(1);

  // Default to SELF if no role found (safest default)
  let scopeType: ScopeType = 'SELF';
  const roleSlug = roleResult[0]?.slug;

  if (roleResult.length > 0) {
    scopeType = roleResult[0].scopeType as ScopeType;
  }

  // System admin and office admin always get GLOBAL regardless of role scopeType
  if (roleSlug === 'system_admin' || roleSlug === 'office_admin') {
    scopeType = 'GLOBAL';
  }

  return {
    scopeType,
    branchIds: userRow.assignedBranchIds || [],
    departmentIds: userRow.assignedDepartmentIds || [],
    employeeId: userRow.employeeId || null,
    userId,
  };
}

// ---------------------------------------------------------------------------
// Query Filter Builders
// ---------------------------------------------------------------------------

/**
 * Builds a WHERE clause that restricts employee queries based on scope.
 * Use this when querying the `employees` table directly.
 * 
 * @param scope - The resolved scope filter
 * @param employeeTableRef - Reference to the employees table (defaults to `employees`)
 * @returns SQL condition to add to WHERE, or undefined for GLOBAL (no filter)
 */
export function buildEmployeeScopeCondition(
  scope: ScopeFilter,
  employeeTableRef: typeof employees = employees
): SQL | undefined {
  switch (scope.scopeType) {
    case 'GLOBAL':
      // No restriction — full access
      return undefined;

    case 'BRANCH':
      if (scope.branchIds.length === 0) {
        // No branches assigned — restrict to nothing (safety)
        return sql`false`;
      }
      return inArray(employeeTableRef.branchId, scope.branchIds);

    case 'DEPARTMENT':
      if (scope.departmentIds.length === 0) {
        return sql`false`;
      }
      return inArray(employeeTableRef.departmentId, scope.departmentIds);

    case 'SELF':
      if (!scope.employeeId) {
        // User has no linked employee — they should see nothing
        return sql`false`;
      }
      return eq(employeeTableRef.id, scope.employeeId);

    default:
      // Unknown scope — deny everything (fail-safe)
      return sql`false`;
  }
}

/**
 * Builds a WHERE clause for queries that filter by employeeId column
 * (e.g., payroll_slips, leave_applications, loans, attendance_records).
 * 
 * @param scope - The resolved scope filter
 * @param employeeIdColumn - The employeeId column reference from the target table
 * @param employeeTableRef - Reference to the employees table for join-based scope
 * @returns SQL condition or undefined for GLOBAL
 */
export function buildEmployeeIdScopeCondition(
  scope: ScopeFilter,
  employeeIdColumn: ReturnType<typeof sql.raw> | any
): SQL | undefined {
  switch (scope.scopeType) {
    case 'GLOBAL':
      return undefined;

    case 'SELF':
      if (!scope.employeeId) {
        return sql`false`;
      }
      return eq(employeeIdColumn, scope.employeeId);

    case 'BRANCH':
    case 'DEPARTMENT':
      // For BRANCH/DEPARTMENT scope on tables that reference employeeId,
      // we need to join through employees table. This helper returns a
      // subquery-based condition.
      return buildSubqueryScope(scope, employeeIdColumn);

    default:
      return sql`false`;
  }
}

/**
 * Builds a subquery-based scope condition for BRANCH/DEPARTMENT.
 * Uses: `employeeId IN (SELECT id FROM employees WHERE branchId IN (...))`.
 */
function buildSubqueryScope(
  scope: ScopeFilter,
  employeeIdColumn: any
): SQL | undefined {
  if (scope.scopeType === 'BRANCH' && scope.branchIds.length > 0) {
    // Build placeholders for the IN clause
    const placeholders = scope.branchIds.map(id => `'${id}'`).join(',');
    return sql`${employeeIdColumn} IN (SELECT id FROM employees WHERE branch_id IN (${sql.raw(placeholders)}))`;
  }

  if (scope.scopeType === 'DEPARTMENT' && scope.departmentIds.length > 0) {
    const placeholders = scope.departmentIds.map(id => `'${id}'`).join(',');
    return sql`${employeeIdColumn} IN (SELECT id FROM employees WHERE department_id IN (${sql.raw(placeholders)}))`;
  }

  return sql`false`;
}

/**
 * Helper: checks if a scope allows any data access at all.
 * Useful for early-return optimization in service functions.
 */
export function isScopeValid(scope: ScopeFilter): boolean {
  switch (scope.scopeType) {
    case 'GLOBAL':
      return true;
    case 'BRANCH':
      return scope.branchIds.length > 0;
    case 'DEPARTMENT':
      return scope.departmentIds.length > 0;
    case 'SELF':
      return scope.employeeId !== null;
    default:
      return false;
  }
}
