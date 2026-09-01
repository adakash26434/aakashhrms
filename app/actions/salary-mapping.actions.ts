'use server';

import { ensureTenantContext } from '@/lib/db';
import * as service from '@/lib/services/salary-mapping.service';
import { revalidatePath } from 'next/cache';
import type { SalaryMappingFormData } from '@/lib/types/salary-mapping';
import { checkPermission } from '@/lib/auth/check-permission';

export async function saveSalaryMappingAction(id: string | null, formData: SalaryMappingFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SALARY_MAPPING');
    const result = id 
      ? await service.updateMapping(id, formData) 
      : await service.createMapping(formData);
    revalidatePath('/workforce/salary-mapping');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SalaryMappingValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred while saving salary mapping.' };
  }
}

export async function deleteSalaryMappingAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SALARY_MAPPING');
    await service.deleteMapping(id);
    revalidatePath('/workforce/salary-mapping');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete mapping.' };
  }
}

export async function getSalaryMappingDataAction() {
  await ensureTenantContext();
  try {
    const data = await service.getSalaryMappingData();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load data.' };
  }
}


export async function bulkSaveSalaryMappingsAction(
  employeeIds: string[],
  baseData: {
    basicSalary: number;
    gradePercent: number;
    gradeAmount: number;
    fiscalYearId?: string;
    effectiveFrom?: string;
  }
) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SALARY_MAPPING');
    const result = await service.bulkCreateMappings(employeeIds, baseData);
    revalidatePath('/workforce/salary-mapping');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bulk assignment failed.' 
    };
  }
}