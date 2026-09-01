'use server';

import { ensureTenantContext } from '@/lib/db';
import * as fyService from '@/lib/services/fiscal-year.service';
import { revalidatePath } from 'next/cache';
import type { FiscalYearFormData } from '@/lib/types/fiscal-year';
import { checkPermission } from '@/lib/auth/check-permission';

export async function createFiscalYearAction(data: FiscalYearFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'FISCAL_YEAR');
    const result = await fyService.createFiscalYear(data);
    revalidatePath('/setup/fiscal-year');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'FiscalYearValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateFiscalYearAction(id: string, data: FiscalYearFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'FISCAL_YEAR');
    const result = await fyService.updateFiscalYear(id, data);
    revalidatePath('/setup/fiscal-year');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'FiscalYearValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteFiscalYearAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'FISCAL_YEAR');
    await fyService.deleteFiscalYear(id);
    revalidatePath('/setup/fiscal-year');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function lockFiscalYearAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('LOCK', 'FISCAL_YEAR');
    const result = await fyService.lockFiscalYear(id);
    revalidatePath('/setup/fiscal-year');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}