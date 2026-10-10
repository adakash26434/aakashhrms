'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkCompanyView, hasPermission, type ScopeFilter } from '@/lib/auth/check-permission';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import { isUuid } from '@/lib/utils/uuid';
import * as service from '@/lib/services/role.service';

// Admin → Roles (4.13, S59). Roles are a company-wide control: View with a company-wide role to
// see them (platform support may look); Users & roles → Add / Edit / Delete with a company-wide
// role, never support view, to change them. The service applies the access rules: administrator
// roles fixed, nothing given beyond your own permissions, never the role you hold.

const NOT_FOUND = 'Not found: this role no longer exists.';

const revalidate = () => {
  revalidatePath('/admin/roles');
  revalidatePath('/admin/users');
};

async function abilities(scope: ScopeFilter) {
  const office = scope.scopeType === 'GLOBAL' && !scope.isImpersonation;
  const [add, edit, del, audit] = await Promise.all([
    hasPermission('ADD', 'USERS_ROLES'),
    hasPermission('EDIT', 'USERS_ROLES'),
    hasPermission('DELETE', 'USERS_ROLES'),
    hasPermission('VIEW', 'AUDIT_LOG'),
  ]);
  return { add: office && add, edit: office && edit, delete: office && del, audit: scope.scopeType === 'GLOBAL' && audit };
}

export async function rolesPageAction() {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyView('USERS_ROLES');
    return { success: true as const, data: await service.rolesPage(scope, await abilities(scope)) };
  } catch (error: unknown) {
    return toActionError(error, 'roles.page');
  }
}

/** Adds a role (id null: empty, from a preset or a copy) or saves its name, description and scope. */
export async function saveRoleAction(id: string | null, input: unknown) {
  await ensureTenantContext();
  try {
    if (id !== null && !isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl(id ? 'EDIT' : 'ADD', 'USERS_ROLES');
    const role = await service.saveRole(id, input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: role };
  } catch (error: unknown) {
    if (error instanceof service.RoleValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'roles.save');
  }
}

/** Saves the matrix: `{ grants, baseline }` (baseline: what the screen started from). */
export async function saveRolePermissionsAction(id: string, input: unknown) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl('EDIT', 'USERS_ROLES');
    const result = await service.saveRolePermissions(id, input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'roles.permissions');
  }
}

export async function deleteRoleAction(id: string) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl('DELETE', 'USERS_ROLES');
    await service.deleteRole(id, { userId: scope.userId });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'roles.delete');
  }
}

/** Gives logins this role (Roles → People → Add). */
export async function addRoleMembersAction(id: string, loginIds: unknown) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const ids = Array.isArray(loginIds) ? loginIds.filter(isUuid) : [];
    const scope = await checkCompanyControl('EDIT', 'USERS_ROLES');
    const moved = await service.addRoleMembers(id, ids, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: { moved } };
  } catch (error: unknown) {
    return toActionError(error, 'roles.members');
  }
}

/** One role's grants and revokes, newest first. */
export async function roleHistoryAction(id: string) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    await checkCompanyView('USERS_ROLES');
    return { success: true as const, data: await service.permissionHistory({ roleId: id, limit: 300 }) };
  } catch (error: unknown) {
    return toActionError(error, 'roles.history');
  }
}
