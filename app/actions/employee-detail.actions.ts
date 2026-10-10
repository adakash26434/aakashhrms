'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission, type ScopeFilter } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import * as detailService from '@/lib/services/employee-detail.service';

// Sensitive employee details (4.8 / F13, S43): deciding a waiting change to bank, PAN or tax
// status. Approve and reject need Employees → Approve, withdraw (its maker) Employees → Edit,
// each within the user's employee scope; the service and the approval engine decide the rest
// (never the employee's own record, never one's own change). Refusals are audited.

type Decision = 'approve' | 'reject' | 'withdraw';

export async function decideEmployeeDetailChangeAction(id: string, decision: Decision, note?: string) {
  await ensureTenantContext();
  let scope: ScopeFilter | null = null;
  const action = decision === 'withdraw' ? 'EDIT' : 'APPROVE';
  try {
    scope = await checkPermissionWithScope(action, 'EMPLOYEES');
    const [canApprove, canEdit] = await Promise.all([hasPermission('APPROVE', 'EMPLOYEES'), hasPermission('EDIT', 'EMPLOYEES')]);
    const result = await detailService.decide(id, decision, note, { scope, userId: scope.userId, canApprove, canEdit });
    await recordAuditLog({
      userId: scope.userId,
      action,
      module: 'EMPLOYEES',
      recordId: result.employeeId,
      result: 'SUCCESS',
      // Field names only, never the values (S18).
      newValues: { detailChange: { id: result.id, status: result.status, fields: result.fields }, draftSlips: result.draftSlips },
    });
    revalidatePath('/workforce/employees');
    revalidatePath('/workforce/employees/changes');
    revalidatePath(`/workforce/employees/${result.employeeId}`);
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (scope && error instanceof detailService.DetailDecisionRefused) {
      await recordAuditLog({
        userId: scope.userId,
        action,
        module: 'EMPLOYEES',
        recordId: error.employeeId,
        result: error.refusal === 'self' ? DENIED_SELF : error.refusal === 'scope' ? 'DENIED_SCOPE' : 'DENIED_PERMISSION',
        newValues: { detailChange: { id: typeof id === 'string' ? id.slice(0, 36) : null, decision } },
      });
    }
    return toActionError(error, 'employee.detailChange');
  }
}
