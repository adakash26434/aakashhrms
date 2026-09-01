'use server';

import { ensureTenantContext } from '@/lib/db';
import * as desigService from '@/lib/services/designation.service';
import { revalidatePath } from 'next/cache';
import { checkPermission } from '@/lib/auth/check-permission';
import type { DesignationFormData } from '@/lib/types/designation';

export async function getDesignationDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'ORG_STRUCTURE');
    const data = await desigService.getDesignationData();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function createDesignationAction(data: DesignationFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'ORG_STRUCTURE');
    const result = await desigService.createDesignation(data);
    revalidatePath('/workforce/departments');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'DesignationValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateDesignationAction(id: string, data: DesignationFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'ORG_STRUCTURE');
    const result = await desigService.updateDesignation(id, data);
    revalidatePath('/workforce/departments');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'DesignationValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteDesignationAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'ORG_STRUCTURE');
    await desigService.deleteDesignation(id);
    revalidatePath('/workforce/departments');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}