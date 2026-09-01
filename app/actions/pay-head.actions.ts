'use server';

import { ensureTenantContext } from '@/lib/db';
import * as phService from '@/lib/services/pay-head.service';
import { revalidatePath } from 'next/cache';
import type { PayHeadFormData } from '@/lib/types/pay-head';
import { checkPermission } from '@/lib/auth/check-permission';

export async function getPayHeadDataAction() {
  await ensureTenantContext();
  try {
    const data = await phService.getPayHeadData();
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown error";
    return { success: false, error: msg };
  }
}

export async function createPayHeadAction(data: PayHeadFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('ADD', 'PAY_HEADS');
    const result = await phService.createPayHead(data);
    revalidatePath('/setup/pay-heads');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'PayHeadValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updatePayHeadAction(id: string, data: PayHeadFormData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'PAY_HEADS');
    const result = await phService.updatePayHead(id, data);
    revalidatePath('/setup/pay-heads');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'PayHeadValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deletePayHeadAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'PAY_HEADS');
    await phService.deletePayHead(id);
    revalidatePath('/setup/pay-heads');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}