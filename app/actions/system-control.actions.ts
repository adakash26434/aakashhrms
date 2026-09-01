'use server';

import { ensureTenantContext } from '@/lib/db';
import * as scService from '@/lib/services/system-control.service';
import { revalidatePath } from 'next/cache';
import type { SystemControlData } from '@/lib/types/system-control';
import { checkPermission } from '@/lib/auth/check-permission';

export async function saveSystemControlAction(data: SystemControlData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SYSTEM_CONTROL');
    const result = await scService.saveSystemControlSettings(data);
    revalidatePath('/setup/system-control');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SystemControlValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}