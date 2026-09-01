'use server';

import { ensureTenantContext } from '@/lib/db';
import * as empService from '@/lib/services/employee.service';
import { revalidatePath } from 'next/cache';
import type { EmployeeFormData, EmployeeFilter } from '@/lib/types/employee';
import { checkPermission, checkPermissionWithScope } from '@/lib/auth/check-permission';

export async function saveEmployeeAction(id: string | null, formData: EmployeeFormData) {
  await ensureTenantContext();
  try {
    if (id) {
      await checkPermission('EDIT', 'EMPLOYEES');
    } else {
      await checkPermission('ADD', 'EMPLOYEES');
    }
    const result = await empService.saveEmployee(id, formData);
    revalidatePath('/workforce/employees');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'EmployeeValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteEmployeeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'EMPLOYEES');
    await empService.deleteEmployee(id);
    revalidatePath('/workforce/employees');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'EmployeeInUseError') {
        return { success: false, error: error.message };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getEmployeesAction(filter: EmployeeFilter) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployees(filter, scope);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getEmployeeLookupDataAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeLookupData(scope);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function getEmployeeByIdAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'EMPLOYEES');
    const data = await empService.getEmployeeById(id);
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}