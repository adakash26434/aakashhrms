'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as service from '@/lib/services/overtime.service';
import { POLICY_KEY } from '@/lib/repositories/overtime.repository';
import { UserFacingError, toActionError, type ActionFailure } from '@/lib/errors/action-error';

type Ok<T = undefined> = { success: true; data?: T };
type Fail = ActionFailure & { validationErrors?: Record<string, string> };

function fail(error: unknown, context: string): Fail {
  if (error instanceof service.OvertimeValidationError) return { success: false, error: 'Check the highlighted fields.', validationErrors: error.errors };
  return toActionError(error, context);
}

/**
 * The company's overtime policy (rates, rounding, approval): a company
 * administrator's control. Never below the Labour Act (checked in the service).
 */
export async function saveOvertimePolicyAction(input: unknown): Promise<Ok | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'OT_RULES');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change the overtime policy.');
    if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
    const { before, after } = await service.savePolicy(input);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'OT_RULES', recordId: POLICY_KEY, result: 'SUCCESS', oldValues: { policy: before }, newValues: { policy: after } });
    revalidatePath('/timeAndLeave/policies');
    revalidatePath('/timeAndLeave/attendance');
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'overtime.policy');
  }
}
