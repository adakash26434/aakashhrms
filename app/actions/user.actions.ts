'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkCompanyView, hasPermission, type ScopeFilter } from '@/lib/auth/check-permission';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import { isUuid } from '@/lib/utils/uuid';
import * as service from '@/lib/services/user.service';

// Admin → Users (4.13, S59). Logins are a company-wide control: View with a company-wide role to
// see them (platform support may look); Users & roles → Add / Edit / Delete with a company-wide
// role, never support view, to change them (checkCompanyControl). The service then applies the
// access rules — nothing beyond your own permissions, never your own login, administrators only by
// administrators, one administrator always — and audits every change and refusal.

const NOT_FOUND = 'Not found: this login no longer exists.';

const revalidate = () => {
  revalidatePath('/admin/users');
  revalidatePath('/admin/roles');
};

/** What the viewer may do here (the buttons; every action checks again). */
async function abilities(scope: ScopeFilter) {
  const office = scope.scopeType === 'GLOBAL' && !scope.isImpersonation;
  const [add, edit, del, audit] = await Promise.all([
    hasPermission('ADD', 'USERS_ROLES'),
    hasPermission('EDIT', 'USERS_ROLES'),
    hasPermission('DELETE', 'USERS_ROLES'),
    hasPermission('VIEW', 'AUDIT_LOG'),
  ]);
  return { add: office && add, edit: office && edit, deactivate: office && del, audit: scope.scopeType === 'GLOBAL' && audit };
}

export async function usersPageAction() {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyView('USERS_ROLES');
    return { success: true as const, data: await service.usersPage(scope, await abilities(scope)) };
  } catch (error: unknown) {
    return toActionError(error, 'users.page');
  }
}

/** Adds a login (id null) or saves one; a new login's temporary password comes back once. */
export async function saveLoginAction(id: string | null, input: unknown) {
  await ensureTenantContext();
  try {
    if (id !== null && !isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl(id ? 'EDIT' : 'ADD', 'USERS_ROLES');
    const result = await service.saveLogin(id, input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof service.LoginValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'users.save');
  }
}

/** Make inactive needs Delete (a login is never deleted), make active Edit. */
export async function setLoginActiveAction(id: string, active: boolean) {
  await ensureTenantContext();
  try {
    if (!isUuid(id) || typeof active !== 'boolean') throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl(active ? 'EDIT' : 'DELETE', 'USERS_ROLES');
    await service.setLoginActive(id, active, { userId: scope.userId });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'users.status');
  }
}

/** A new temporary password for someone else's login, shown once (S2). */
export async function issuePasswordAction(id: string) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl('EDIT', 'USERS_ROLES');
    const issued = await service.issueTemporaryPassword(id, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: issued };
  } catch (error: unknown) {
    return toActionError(error, 'users.password');
  }
}

export async function saveDelegationAction(id: string, input: unknown) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    const scope = await checkCompanyControl('EDIT', 'USERS_ROLES');
    await service.saveDelegation(id, input, { userId: scope.userId });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'users.delegation');
  }
}

/** What a login did lately: audit entries, so Audit log → View (company-wide) as well. */
export async function loginActivityAction(id: string) {
  await ensureTenantContext();
  try {
    if (!isUuid(id)) throw new UserFacingError(NOT_FOUND);
    await checkCompanyView('USERS_ROLES');
    await checkCompanyView('AUDIT_LOG');
    return { success: true as const, data: await service.loginActivity(id) };
  } catch (error: unknown) {
    return toActionError(error, 'users.activity');
  }
}
