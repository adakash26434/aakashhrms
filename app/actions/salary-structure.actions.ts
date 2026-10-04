'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { DENIED_SELF } from '@/lib/auth/self-action';
import { recordAuditLog } from '@/lib/services/audit.service';
import * as structureService from '@/lib/services/salary-structure.service';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';

// Security plan S20: salary data needs the Salary mapping permission and
// follows the user's employee scope; every change is a dated revision in a
// batch (never an edit or delete of an approved one); approval needs Approve;
// every submit / decision is audited (ids, counts, the total change and how it
// was approved; the revision table itself is the salary history).
// Approvals (Zoho style): the company setting decides the flow (none, simple,
// multi-level); a company administrator may Final approve; S21: nobody
// approves a change to their own salary, and a preparer never approves their
// own change except by an administrator's Final approve. Who may act is
// decided by the approval engine on the server, never by the browser.

const DECISIONS = ['approve', 'final_approve', 'reject', 'withdraw'] as const;
type DecisionInput = (typeof DECISIONS)[number];
const MAX_BULK = 200;

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

/**
 * Saves a change batch (one employee, a bulk edit or an import). It counts at
 * once (approval off), waits for its approvers, or, with approveNow, a company
 * administrator Final approves it in the same step (never their own salary).
 */
export async function submitSalaryChangeAction(input: unknown, options?: { approveNow?: boolean }): Promise<{ success: true; data: structureService.SubmitResult } | Fail> {
  await ensureTenantContext();
  let userId: string | null = null;
  try {
    const scope = await checkPermissionWithScope('EDIT', 'SALARY_MAPPING');
    userId = scope.userId;
    const canApprove = await hasPermission('APPROVE', 'SALARY_MAPPING');
    const result = await structureService.submitBatch(input, { scope, userId: scope.userId, canApprove, approveNow: options?.approveNow === true });
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'SALARY_MAPPING',
      recordId: result.batchId,
      result: 'SUCCESS',
      newValues: {
        batch: result.batchId,
        employees: result.employeeCount,
        monthlyChange: result.monthlyChange,
        status: result.approved ? 'approved' : 'pending',
        // "final_approve": saved and approved by an administrator (reviewable in Approvals).
        approvalRoute: result.route,
        ownSalary: result.ownSalary,
      },
    });
    refresh();
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof structureService.StructureValidationError) {
      return { success: false, error: 'Some cells need attention.', validationErrors: error.errors };
    }
    await auditOutOfScope(error, userId, 'EDIT', 'salary-batch');
    if (error instanceof structureService.SelfDecisionError && userId) {
      await recordAuditLog({ userId, action: 'APPROVE', module: 'SALARY_MAPPING', recordId: 'salary-batch', result: DENIED_SELF, newValues: { decision: 'final_approve', reason: error.code } });
    }
    return toActionError(error, 'salary-structure.submit');
  }
}

/**
 * Approve (the current level, or as a delegate), Final approve (company
 * administrator), reject (reason required) or withdraw (preparer) one or more
 * pending changes. Each is checked on its own and audited; refusals for the
 * user's own salary or own change are audited DENIED_SELF.
 */
export async function decideSalaryChangesAction(
  batchIds: string[],
  decision: DecisionInput,
  note?: string
): Promise<{ success: true; data: { done: number; failed: { id: string; error: string }[] } } | Fail> {
  await ensureTenantContext();
  try {
    if (!DECISIONS.includes(decision)) throw new UserFacingError('That is not a valid decision.');
    const ids = Array.isArray(batchIds) ? [...new Set(batchIds.map(String))].slice(0, MAX_BULK) : [];
    if (!ids.length) throw new UserFacingError('Choose at least one change.');
    // Withdrawing changes your own request (Edit); deciding needs at least View, and the
    // approval engine then requires Approve, a delegation or company administrator.
    const scope = await checkPermissionWithScope(decision === 'withdraw' ? 'EDIT' : 'VIEW', 'SALARY_MAPPING');
    const canApprove = await hasPermission('APPROVE', 'SALARY_MAPPING');
    const auditAction = decision === 'withdraw' ? 'EDIT' : 'APPROVE';
    const results = await structureService.decideMany(ids, decision, typeof note === 'string' ? note.slice(0, 500) : null, { scope, userId: scope.userId, canApprove });
    for (const r of results) {
      if (r.ok && r.result) {
        await recordAuditLog({
          userId: scope.userId,
          action: auditAction,
          module: 'SALARY_MAPPING',
          recordId: r.id,
          result: 'SUCCESS',
          newValues: { decision, level: r.result.level, status: r.result.status, approvalRoute: r.result.route, employees: r.result.employeeCount },
        });
      } else if (r.refusal) {
        await recordAuditLog({
          userId: scope.userId,
          action: auditAction,
          module: 'SALARY_MAPPING',
          recordId: r.id,
          result: r.refusal === 'scope' ? 'DENIED_SCOPE' : DENIED_SELF,
          newValues: { decision, reason: r.refusal },
        });
      }
    }
    const done = results.filter((r) => r.ok).length;
    if (done) refresh();
    const failed = results.filter((r) => !r.ok).map((r) => ({ id: r.id, error: r.error ?? 'Not changed.' }));
    if (!done && failed.length === 1) return { success: false, error: failed[0].error };
    return { success: true, data: { done, failed } };
  } catch (error: unknown) {
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

/** Approval settings for salary changes (none / simple / multi-level): a company administrator's control. */
export async function saveSalaryApprovalSettingsAction(input: unknown): Promise<{ success: true; data: { pendingKept: number } } | Fail> {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('APPROVE', 'SALARY_MAPPING');
    if (scope.scopeType !== 'GLOBAL') throw new UserFacingError('Only a company-wide administrator can change approval settings.');
    // A company control: platform support viewing the company does not change it.
    if (scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
    const { policy, pendingKept } = await structureService.saveApprovalPolicy(input);
    await recordAuditLog({
      userId: scope.userId,
      action: 'EDIT',
      module: 'SALARY_MAPPING',
      recordId: 'salary-approval-settings',
      result: 'SUCCESS',
      newValues: { approvalType: policy.type, levels: policy.levels.length },
    });
    refresh();
    return { success: true, data: { pendingKept } };
  } catch (error: unknown) {
    if (error instanceof structureService.StructureValidationError) {
      return { success: false, error: 'Check the approval settings.', validationErrors: error.errors };
    }
    return toActionError(error, 'salary-structure.approval-settings');
  }
}
