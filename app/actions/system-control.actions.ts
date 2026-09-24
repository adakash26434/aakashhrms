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

    // Handicapped relief is strictly governed by Handicapped Tax Slabs in Setup → Tax Rates.
    // Ensure secondary percentage discount is always 0% to avoid double-discounting.
    data.insuranceDiscounts.handicappedDiscountPercent = 0;
    data.statutoryDeductionLimits.handicappedDeductionPercent = 0;

    const result = await scService.saveSystemControlSettings(data);

    // Automatically recalculate and synchronize grade amounts across all active employees
    if (data.gradePolicy) {
      await scService.syncAllEmployeeGradesWithPolicy(data.gradePolicy);
    }

    revalidatePath('/setup/system-control');
    revalidatePath('/setup/payroll-rules');
    revalidatePath('/workforce/employees');
    revalidatePath('/workforce/employees/[id]/edit');
    revalidatePath('/workforce/employees/new');
    revalidatePath('/workforce/salary-mapping');
    revalidatePath('/payroll/process');

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

export async function syncAllEmployeeGradesAction() {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'SYSTEM_CONTROL');
    const result = await scService.syncAllEmployeeGradesWithPolicy();

    revalidatePath('/setup/system-control');
    revalidatePath('/setup/payroll-rules');
    revalidatePath('/workforce/employees');
    revalidatePath('/workforce/employees/[id]/edit');
    revalidatePath('/workforce/employees/new');
    revalidatePath('/workforce/salary-mapping');
    revalidatePath('/payroll/process');

    return { success: true, data: result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to sync employee grades';
    return { success: false, error: msg };
  }
}