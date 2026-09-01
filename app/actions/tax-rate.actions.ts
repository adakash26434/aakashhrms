'use server';

import { ensureTenantContext } from '@/lib/db';
import * as service from '@/lib/services/tax-rate.service';
import { revalidatePath } from 'next/cache';
import type { TaxSlabFormData, TaxCategory } from '@/lib/types/tax-rate';
import { checkPermission } from '@/lib/auth/check-permission';

export async function getTaxRateDataAction() {
  await ensureTenantContext();
  try {
    const data = await service.getTaxRateData();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function createTaxSlabAction(payload: { fiscalYearId: string; category: TaxCategory; data: TaxSlabFormData }) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'TAX_RATES');
    const result = await service.createSlab(payload);
    revalidatePath('/setup/tax-rates');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SlabValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateTaxSlabAction(id: string, payload: TaxSlabFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'TAX_RATES');
    const result = await service.updateSlab(id, payload);
    revalidatePath('/setup/tax-rates');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SlabValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteTaxSlabAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'TAX_RATES');
    await service.deleteSlab(id);
    revalidatePath('/setup/tax-rates');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}