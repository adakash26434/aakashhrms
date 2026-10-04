'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as structureService from '@/lib/services/salary-structure.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';

// Security plan S20: salary data needs the Salary mapping permission and
// follows the user's employee scope; every change is a dated revision in a
// batch (never an edit or delete of an approved one); approval needs Approve
// and never the preparer; every submit / decision is audited (ids, counts and
// the total change; the revision table itself is the salary history).

type Fail = { success: false; error: string; ref?: string; validationErrors?: Record<string, Record<string, string>> };

/** Out-of-scope employees in a request: audited as DENIED_SCOPE (ids counted, not listed). */
async function auditOutOfScope(error: unknown, userId: string | null, action: 'EDIT' | 'APPROVE', recordId: string) {
  if (!(error instanceof structureService.OutOfScopeError) || !userId) return;
  await recordAuditLog({ userId, action, module: 'SALARY_MAPPING', recordId, result: 'DENIED_SCOPE', newValues: { employees: error.employeeIds.length } });
}

function refresh() {
  revalidatePath('/workforce/salary-mapping');
  revalidatePath('/workforce/employees');
  revalidatePath('/dashboard');
}

/** Saves a change batch (one employee, a bulk edit or an import). Pending when approval is on. */
export async function submitSalaryChangeAction(input: unknown): Promise<{ success: true; data: structureService.SubmitResult } | Fail> {
  await ensureTenantContext();
  let userId: string | null = null;
  try {
    const scope = await checkPermissionWithScope('EDIT', 'SALARY_MAPPING');
    userId = scope.userId;
    const result = await structureService.submitBatch(input, { scope, userId: scope.userId });
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'SALARY_MAPPING',
      recordId: result.batchId,
      result: 'SUCCESS',
      newValues: { batch: result.batchId, employees: result.employeeCount, monthlyChange: result.monthlyChange, status: result.approved ? 'approved' : 'pending' },
    });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof structureService.StructureValidationError) {
      return { success: false, error: 'Some cells need attention.', validationErrors: error.errors };
    }
    await auditOutOfScope(error, userId, 'EDIT', 'salary-batch');
    return toActionError(error, 'salary-structure.submit');
  }
}

/** Approve or reject a pending batch (Approve permission, not the preparer), or withdraw your own. */
export async function decideSalaryChangeAction(
  batchId: string,
  decision: 'approved' | 'rejected' | 'withdrawn',
  note?: string
): Promise<{ success: true } | Fail> {
  await ensureTenantContext();
  let userId: string | null = null;
  const action = decision === 'withdrawn' ? 'EDIT' : 'APPROVE';
  try {
    if (!['approved', 'rejected', 'withdrawn'].includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const scope = await checkPermissionWithScope(action, 'SALARY_MAPPING');
    userId = scope.userId;
    const canApprove = decision === 'withdrawn' ? false : true;
    const result = await structureService.decideBatch(String(batchId), decision, typeof note === 'string' ? note.slice(0, 500) : null, { scope, userId: scope.userId, canApprove });
    if (result.ownBatch) {
      await recordAuditLog({ userId: scope.userId, action: 'APPROVE', module: 'SALARY_MAPPING', recordId: String(batchId), result: 'DENIED_SELF', newValues: { decision } });
      throw new UserFacingError('You prepared this change, so someone else has to approve or reject it.');
    }
    await recordAuditLog({
      userId: scope.userId,
      action,
      module: 'SALARY_MAPPING',
      recordId: String(batchId),
      result: 'SUCCESS',
      newValues: { decision, employees: result.employeeCount },
    });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    await auditOutOfScope(error, userId, action, String(batchId));
    return toActionError(error, 'salary-structure.decide');
  }
}

export async function saveSalaryTemplateAction(id: string | null, input: unknown): Promise<{ success: true } | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'SALARY_MAPPING');
    const row = await structureService.saveTemplate(id ? String(id) : null, input);
    await recordAuditLog({ userId: scope.userId, action: id ? 'EDIT' : 'ADD', module: 'SALARY_MAPPING', recordId: row.id, result: 'SUCCESS', newValues: { template: row.code } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof structureService.StructureValidationError) {
      return { success: false, error: 'Some fields need attention.', validationErrors: error.errors };
    }
    return toActionError(error, 'salary-structure.template');
  }
}

export async function setSalaryTemplateActiveAction(id: string, active: boolean): Promise<{ success: true } | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('EDIT', 'SALARY_MAPPING');
    await structureService.setTemplateActive(String(id), active === true);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'SALARY_MAPPING', recordId: String(id), result: 'SUCCESS', newValues: { templateActive: active === true } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return toActionError(error, 'salary-structure.template-status');
  }
}

/** "Salary changes need a second person's approval": changed by someone who can approve. */
export async function setSalaryApprovalAction(on: boolean): Promise<{ success: true } | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('APPROVE', 'SALARY_MAPPING');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change this setting.');
    await structureService.setApprovalRequired(on === true);
    await recordAuditLog({ userId: scope.userId, action: 'EDIT', module: 'SALARY_MAPPING', recordId: 'salary-approval-setting', result: 'SUCCESS', newValues: { requireApproval: on === true } });
    refresh();
    return { success: true };
  } catch (error: unknown) {
    return toActionError(error, 'salary-structure.approval-setting');
  }
}
