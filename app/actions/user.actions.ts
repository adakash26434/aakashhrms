'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import * as userService from '@/lib/services/user.service';
import {
  UserExistsError,
  RoleNotFoundError,
  UserNotFoundError,
  SelfDeactivationError,
  SystemAdminProtectionError,
  UserValidationError,
} from '@/lib/services/user.service';
import { UserFormData, UserFilter, UserWithRole, UserKPIs } from '@/lib/types/user';
import { checkPermission } from '@/lib/auth/check-permission';
import { auth } from '@/lib/auth';

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: Record<string, string>;
};

export async function getUsersAction(filter?: UserFilter): Promise<ActionResponse<{
  users: UserWithRole[];
  kpis: UserKPIs;
}>> {
  try {
    await ensureTenantContext();
    await checkPermission('VIEW', 'USERS_ROLES');
    const result = await userService.getAllUsersWithKPIs(filter);
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Failed to fetch users:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch users';
    return { success: false, error: msg };
  }
}

export async function createUserAction(formData: UserFormData): Promise<ActionResponse<{
  user: UserWithRole;
  tempPassword: string;
}>> {
  try {
    await ensureTenantContext();
    await checkPermission('ADD', 'USERS_ROLES');
    const result = await userService.createUser(formData);
    revalidatePath('/admin/users');
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Failed to create user:', error);
    if (error instanceof UserValidationError) {
      return { success: false, validationErrors: error.errors as Record<string, string> };
    }
    if (
      error instanceof UserExistsError ||
      error instanceof RoleNotFoundError
    ) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while creating the user.' };
  }
}

export async function updateUserAction(id: string, formData: UserFormData): Promise<ActionResponse<UserWithRole>> {
  try {
    await ensureTenantContext();
    await checkPermission('EDIT', 'USERS_ROLES');
    const updatedUser = await userService.updateUser(id, formData);
    revalidatePath('/admin/users');
    return { success: true, data: updatedUser };
  } catch (error: unknown) {
    console.error('Failed to update user:', error);
    if (error instanceof UserValidationError) {
      return { success: false, validationErrors: error.errors as Record<string, string> };
    }
    if (
      error instanceof UserExistsError ||
      error instanceof RoleNotFoundError ||
      error instanceof UserNotFoundError
    ) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while updating the user.' };
  }
}

export async function deactivateUserAction(id: string): Promise<ActionResponse<UserWithRole>> {
  try {
    await ensureTenantContext();
    await checkPermission('DELETE', 'USERS_ROLES');
    const session = await auth();
    const currentUserId = session?.user?.id;

    const deactivatedUser = await userService.deactivateUser(id, currentUserId);
    revalidatePath('/admin/users');
    return { success: true, data: deactivatedUser };
  } catch (error: unknown) {
    console.error('Failed to deactivate user:', error);
    if (
      error instanceof SelfDeactivationError ||
      error instanceof SystemAdminProtectionError ||
      error instanceof UserNotFoundError
    ) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while deactivating the user.' };
  }
}

export async function reactivateUserAction(id: string): Promise<ActionResponse<UserWithRole>> {
  try {
    await ensureTenantContext();
    await checkPermission('EDIT', 'USERS_ROLES');
    const reactivatedUser = await userService.reactivateUser(id);
    revalidatePath('/admin/users');
    return { success: true, data: reactivatedUser };
  } catch (error: unknown) {
    console.error('Failed to reactivate user:', error);
    if (error instanceof UserNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while reactivating the user.' };
  }
}

export async function resetPasswordAction(id: string): Promise<ActionResponse<{
  user: UserWithRole;
  tempPassword: string;
}>> {
  try {
    await ensureTenantContext();
    await checkPermission('EDIT', 'USERS_ROLES');
    const result = await userService.resetUserPassword(id);
    revalidatePath('/admin/users');
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Failed to reset user password:', error);
    if (error instanceof UserNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while resetting password.' };
  }
}

export async function getUnlinkedEmployeesAction(): Promise<ActionResponse<Array<{ id: string; employeeCode: string; name: string }>>> {
  try {
    await ensureTenantContext();
    const data = await userService.getUnlinkedEmployeesForUserLink();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch unlinked employees';
    return { success: false, error: msg };
  }
}

export async function updateUserDelegationAction(
  userId: string,
  formData: import('@/lib/types/user').DelegationFormData
): Promise<ActionResponse<UserWithRole>> {
  try {
    await ensureTenantContext();
    await checkPermission('EDIT', 'USERS_ROLES');
    const updatedUser = await userService.updateUserDelegation(userId, formData);
    revalidatePath('/admin/users');
    return { success: true, data: updatedUser };
  } catch (error: unknown) {
    console.error('Failed to update delegation:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update delegation';
    return { success: false, error: msg };
  }
}

export async function getUserAuditLogsAction(
  userId: string
): Promise<ActionResponse<import('@/lib/types/user').UserAuditLogEntry[]>> {
  try {
    await ensureTenantContext();
    await checkPermission('VIEW', 'USERS_ROLES');
    const logs = await userService.getUserAuditLogs(userId);
    return { success: true, data: logs };
  } catch (error: unknown) {
    console.error('Failed to fetch user audit logs:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch user audit logs';
    return { success: false, error: msg };
  }
}

