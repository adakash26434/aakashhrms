'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import { OpeningRefused, removeOpening } from '@/lib/services/opening-balance.service';
import type { ScopeFilter } from '@/lib/auth/scope-filter';

// Opening balances (4.8 / F15): removing one needs Payroll run → Delete within the user's scope,
// never on one's own pay record (S21, audited DENIED_SELF). Importing is in import.actions.ts.

export async function removeOpeningBalanceAction(id: string) {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  try {
    scope = await checkPermissionWithScope('DELETE', 'PAYROLL_GENERATE');
    const { employeeId } = await removeOpening(id, { scope, userId: scope.userId });
    await recordAuditLog({ userId: scope.userId, action: 'DELETE', module: 'PAYROLL_GENERATE', recordId: employeeId, result: 'SUCCESS', oldValues: { openingBalance: true } });
    revalidatePath('/payroll/opening');
    return { success: true as const };
  } catch (error: unknown) {
    if (scope && error instanceof OpeningRefused) {
      await recordAuditLog({ userId: scope.userId, action: 'DELETE', module: 'PAYROLL_GENERATE', recordId: typeof id === 'string' ? id : null, result: error.reason === 'self' ? DENIED_SELF : 'DENIED_SCOPE' });
    }
    return toActionError(error, 'opening.remove');
  }
}
