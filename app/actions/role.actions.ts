'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import * as roleService from '@/lib/services/role.service';
import {
  SystemRoleModificationError,
  RoleNotFoundError,
  RoleInUseError,
  DuplicateRoleNameError,
} from '@/lib/services/role.service';
import type { CreateRoleInput, UpdateRoleInput, CloneRoleInput } from '@/lib/types/role';
import { checkPermission } from '@/lib/auth/check-permission';
import { auth } from '@/lib/auth';

export type ActionResponse<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: Record<string, string>;
};

export async function createRoleAction(input: CreateRoleInput): Promise<ActionResponse<{ id: string }>> {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'USERS_ROLES');

    const session = await auth();
    const changedByUserId = session?.user?.id;
    if (!changedByUserId) throw new Error('Unauthorized: Not authenticated');

    const newRole = await roleService.createCustomRole(input, changedByUserId);
    revalidatePath('/admin/roles');
    return { success: true, data: { id: newRole.id } };
  } catch (error: unknown) {
    console.error('[CREATE_ROLE_ACTION] Failed:', error);

    if (error instanceof DuplicateRoleNameError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while creating role.' };
  }
}

export async function updateRoleAction(
  roleId: string,
  input: UpdateRoleInput
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'USERS_ROLES');

    const session = await auth();
    const changedByUserId = session?.user?.id;
    if (!changedByUserId) throw new Error('Unauthorized: Not authenticated');

    await roleService.updateCustomRole(roleId, input, changedByUserId);
    revalidatePath('/admin/roles');
    return { success: true };
  } catch (error: unknown) {
    console.error('[UPDATE_ROLE_ACTION] Failed:', error);

    if (error instanceof SystemRoleModificationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof DuplicateRoleNameError) {
      return { success: false, error: error.message };
    }
    if (error instanceof RoleNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while updating role.' };
  }
}

export async function cloneRoleAction(input: CloneRoleInput): Promise<ActionResponse<{ id: string }>> {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'USERS_ROLES');

    const session = await auth();
    const changedByUserId = session?.user?.id;
    if (!changedByUserId) throw new Error('Unauthorized: Not authenticated');

    const cloned = await roleService.cloneCustomRole(input, changedByUserId);
    revalidatePath('/admin/roles');
    return { success: true, data: { id: cloned.id } };
  } catch (error: unknown) {
    console.error('[CLONE_ROLE_ACTION] Failed:', error);

    if (error instanceof DuplicateRoleNameError) {
      return { success: false, error: error.message };
    }
    if (error instanceof RoleNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while cloning role.' };
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'USERS_ROLES');

    const session = await auth();
    const changedByUserId = session?.user?.id;
    if (!changedByUserId) throw new Error('Unauthorized: Not authenticated');

    await roleService.deleteCustomRole(roleId, changedByUserId);
    revalidatePath('/admin/roles');
    return { success: true };
  } catch (error: unknown) {
    console.error('[DELETE_ROLE_ACTION] Failed:', error);

    if (error instanceof SystemRoleModificationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof RoleInUseError) {
      return { success: false, error: error.message };
    }
    if (error instanceof RoleNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while deleting role.' };
  }
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissionIds: string[]
): Promise<ActionResponse> {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'USERS_ROLES');

    const session = await auth();
    const changedByUserId = session?.user?.id;
    if (!changedByUserId) throw new Error('Unauthorized: Not authenticated');

    await roleService.updateRolePermissions(roleId, permissionIds, changedByUserId);
    revalidatePath('/admin/roles');
    return { success: true };
  } catch (error: unknown) {
    console.error('[UPDATE_ROLE_PERMISSIONS_ACTION] Failed:', error);

    if (error instanceof SystemRoleModificationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof RoleNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while saving permissions.' };
  }
}
