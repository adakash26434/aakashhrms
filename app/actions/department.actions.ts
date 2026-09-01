'use server';

import { ensureTenantContext } from '@/lib/db';
import * as deptService from '@/lib/services/department.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type { DepartmentFormData } from '@/lib/types/department';

export async function getDepartmentDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const data = await deptService.getDepartmentData();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function createDepartmentAction(data: DepartmentFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ORG_STRUCTURE');
    const result = await deptService.createDepartment(data);
    revalidatePath('/workforce/departments');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'DepartmentValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateDepartmentAction(id: string, data: DepartmentFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    const result = await deptService.updateDepartment(id, data);
    revalidatePath('/workforce/departments');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'DepartmentValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteDepartmentAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ORG_STRUCTURE');
    await deptService.deleteDepartment(id);
    revalidatePath('/workforce/departments');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}