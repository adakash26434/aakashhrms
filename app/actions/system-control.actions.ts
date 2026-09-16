'use server';

import { ensureTenantContext } from '@/lib/db';
import * as scService from '@/lib/services/system-control.service';
import { revalidatePath } from 'next/cache';
import type { SystemControlData } from '@/lib/types/system-control';
import { checkPermission } from '@/lib/auth/check-permission';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import { verifyPlatformSession } from '@/lib/platform/auth';

export async function saveSystemControlAction(data: SystemControlData) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SYSTEM_CONTROL');

    // Handicapped relief is strictly governed by Handicapped Tax Slabs in Setup → Tax Rates.
    // Ensure secondary percentage discount is always 0% to avoid double-discounting.
    data.insuranceDiscounts.handicappedDiscountPercent = 0;
    data.statutoryDeductionLimits.handicappedDeductionPercent = 0;

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