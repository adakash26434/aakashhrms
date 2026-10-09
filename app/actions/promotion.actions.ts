'use server';

import { ensureTenantContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { checkPermission, requireAuthenticatedUser } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as promotionService from '@/lib/services/promotion.service';

// Promotion score: the ranking is read under PERFORMANCE VIEW (page); the
// weights change under PERFORMANCE LOCK (the same level that closes a cycle),
// audited. Nothing here changes an employee — the बढुवा is a lifecycle event.

export async function savePromotionWeightsAction(form: unknown) {
  await ensureTenantContext();
  try {
    await checkPermission('LOCK', 'PERFORMANCE');
    const { userId } = await requireAuthenticatedUser();
    const weights = await promotionService.saveWeights(form);
    await recordAuditLog({ userId, action: 'LOCK', module: 'PERFORMANCE', recordId: 'promotion.weights', result: 'SUCCESS', newValues: { ...weights } });
    revalidatePath('/workforce/promotion');
    return { success: true as const, data: weights };
  } catch (error: unknown) {
    if (error instanceof promotionService.PromotionValidationError) return { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors };
    return toActionError(error, 'promotion.weights');
  }
}
