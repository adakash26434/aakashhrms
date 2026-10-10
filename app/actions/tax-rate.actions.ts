'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkPermission, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/tax-rate.service';

// Tax slabs (4.12, S49): a company-wide setting — Tax rates → Edit with a company-wide role, never
// platform support (checkCompanyControl). A ladder is saved whole and audited by the service.

export async function taxSlabsPageAction(fiscalYearId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'TAX_RATES');
    return { success: true as const, data: await service.taxSlabsPage(String(fiscalYearId ?? ''), await hasPermission('EDIT', 'TAX_RATES')) };
  } catch (error: unknown) {
    return toActionError(error, 'tax-rate.page');
  }
}

export async function saveTaxLadderAction(fiscalYearId: string, category: string, rows: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('EDIT', 'TAX_RATES');
    await service.saveLadder(String(fiscalYearId ?? ''), String(category ?? ''), rows, { userId: scope.userId });
    revalidatePath('/setup/tax-rates');
    return { success: true as const };
  } catch (error: unknown) {
    if (error instanceof service.TaxLadderValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'tax-rate.save');
  }
}
