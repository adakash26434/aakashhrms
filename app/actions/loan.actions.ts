'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError, UserFacingError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/loan.service';
import { commitLoanOpeningImport, previewLoanOpeningImport } from '@/lib/services/loan-opening.service';

// Loans and salary advances (4.10): every action checks LOANS with the user's scope inside the
// tenant context — ADD asks for a loan (and previews it), disburses an approved request and
// imports opening balances; EDIT records a repayment; DELETE removes an opening loan nothing has
// touched; APPROVE decides requests and writes off. Loan types (EDIT / DELETE) and the approval
// settings (APPROVE) are company policy: company-wide users only. Platform support never changes
// anything. S21 refusals are audited DENIED_SELF in the service; audit lines carry amounts and
// statuses, never the reason someone gave.

type Need = 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE';

async function ctx(need: Need): Promise<service.LoanCtx> {
  const scope = await checkPermissionWithScope(need, 'LOANS');
  const canApprove = need === 'APPROVE' || (await hasPermission('APPROVE', 'LOANS'));
  return { userId: scope.userId, scope, canApprove };
}

/** Loan types and approval settings: a company control. */
async function companyCtx(need: 'EDIT' | 'DELETE' | 'APPROVE'): Promise<service.LoanCtx> {
  const c = await ctx(need);
  if (c.scope.isImpersonation) throw new UserFacingError('Platform support cannot change this company control.');
  if (c.scope.scopeType !== 'GLOBAL') throw new UserFacingError('Loan types and loan approvals are company policy: a company-wide user changes them.');
  return c;
}

const revalidate = () => {
  revalidatePath('/loans');
  revalidatePath('/self-service/my-loans');
};

const failure = (error: unknown, context: string) =>
  error instanceof service.LoanValidationError
    ? { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors }
    : toActionError(error, context);

const audit = (c: service.LoanCtx, action: 'ADD' | 'EDIT' | 'DELETE' | 'APPROVE', recordId: string | null, values: Record<string, unknown>, old?: Record<string, unknown>) =>
  recordAuditLog({ userId: c.userId, action, module: 'LOANS', recordId, result: 'SUCCESS', newValues: values, ...(old ? { oldValues: old } : {}) });

// ---- reading ------------------------------------------------------------------------------------

export async function loanDetailAction(id: string) {
  await ensureTenantContext();
  try {
    return { success: true as const, data: await service.loanDetail(id, await ctx('VIEW')) };
  } catch (error: unknown) {
    return failure(error, 'loan.detail');
  }
}

// ---- requests -----------------------------------------------------------------------------------

/** What a request would be, worked out while the window is filled (nothing is saved). */
export async function previewLoanRequestAction(form: unknown) {
  await ensureTenantContext();
  try {
    return { success: true as const, data: await service.previewRequest(form, await ctx('ADD')) };
  } catch (error: unknown) {
    return failure(error, 'loan.preview');
  }
}

export async function requestLoanAction(form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    const row = await service.prepareRequest(form, c);
    await audit(c, 'ADD', row.id, { request: true, employeeId: row.employeeId, type: row.typeName, amount: row.amount, installments: row.installments, status: row.status });
    revalidate();
    return { success: true as const, data: { id: row.id, status: row.status, statusText: row.statusText } };
  } catch (error: unknown) {
    return failure(error, 'loan.request');
  }
}

/** Approve or reject (Loans → Approve), or withdraw one's own request (the person who asked). */
export async function decideLoanRequestAction(id: string, decision: string, note: string) {
  await ensureTenantContext();
  try {
    const c = await ctx(decision === 'withdraw' ? 'ADD' : 'APPROVE');
    const result = await service.decideRequest(id, decision, note, c);
    await audit(c, decision === 'withdraw' ? 'EDIT' : 'APPROVE', result.id, { employeeId: result.employeeId, amount: result.amount, status: result.status, ...(result.status === 'pending' ? { nextLevel: result.nextLevel } : {}) });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return failure(error, 'loan.decide');
  }
}

export async function disburseLoanAction(requestId: string, form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    const loan = await service.disburseRequest(requestId, form, c);
    await audit(c, 'ADD', loan.id, { disbursed: true, requestId, employeeId: loan.employeeId, amount: loan.amount, totalPayable: loan.totalPayable, installment: loan.installment, firstDeductionMonth: loan.firstDeductionMonth, paidVia: loan.paidVia });
    revalidate();
    return { success: true as const, data: { id: loan.id, installment: loan.installment, firstDeductionMonth: loan.firstDeductionMonth } };
  } catch (error: unknown) {
    return failure(error, 'loan.disburse');
  }
}

// ---- loans --------------------------------------------------------------------------------------

export async function recordLoanRepaymentAction(loanId: string, form: unknown) {
  await ensureTenantContext();
  try {
    const c = await ctx('EDIT');
    const { loan, amount } = await service.recordRepayment(loanId, form, c);
    await audit(c, 'EDIT', loan.id, { repayment: amount, method: 'CASH', remaining: loan.remaining, status: loan.status });
    revalidate();
    return { success: true as const, data: { remaining: loan.remaining, closed: loan.status === 'CLOSED' } };
  } catch (error: unknown) {
    return failure(error, 'loan.repayment');
  }
}

export async function writeOffLoanAction(loanId: string, reason: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('APPROVE');
    const loan = await service.writeOffLoan(loanId, reason, c);
    await audit(c, 'APPROVE', loan.id, { writtenOff: loan.writtenOff, employeeId: loan.employeeId, status: loan.status });
    revalidate();
    return { success: true as const, data: { writtenOff: loan.writtenOff } };
  } catch (error: unknown) {
    return failure(error, 'loan.writeOff');
  }
}

export async function removeOpeningLoanAction(loanId: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('DELETE');
    const removed = await service.removeOpeningLoan(loanId, c);
    await audit(c, 'DELETE', removed.id, { opening: true, removed: true }, { employeeId: removed.employeeId, remaining: removed.remaining });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return failure(error, 'loan.removeOpening');
  }
}

export async function previewLoanOpeningImportAction(csv: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    if (c.scope.isImpersonation) throw new UserFacingError('Platform support cannot change loans.');
    return { success: true as const, data: await previewLoanOpeningImport(csv, c) };
  } catch (error: unknown) {
    return failure(error, 'loan.opening.preview');
  }
}

export async function commitLoanOpeningImportAction(csv: string) {
  await ensureTenantContext();
  try {
    const c = await ctx('ADD');
    if (c.scope.isImpersonation) throw new UserFacingError('Platform support cannot change loans.');
    const result = await commitLoanOpeningImport(csv, c);
    for (const l of result.loans) await audit(c, 'ADD', l.id, { opening: true, employeeId: l.employeeId, remaining: l.remaining });
    await audit(c, 'ADD', null, { import: 'loan-openings', saved: result.saved });
    revalidate();
    return { success: true as const, data: { saved: result.saved } };
  } catch (error: unknown) {
    return failure(error, 'loan.opening.commit');
  }
}

// ---- company controls ---------------------------------------------------------------------------

export async function saveLoanTypeAction(id: string | null, form: unknown) {
  await ensureTenantContext();
  try {
    const c = await companyCtx('EDIT');
    const row = await service.saveType(typeof id === 'string' && id ? id : null, form);
    await audit(c, id ? 'EDIT' : 'ADD', row.id, { type: row.name, kind: row.kind, maxAmount: row.maxAmount, maxSalaryMonths: row.maxSalaryMonths, maxInstallments: row.maxInstallments, interestRate: row.interestRate, selfService: row.selfService, active: row.isActive });
    revalidate();
    return { success: true as const, data: row };
  } catch (error: unknown) {
    return failure(error, 'loan.type');
  }
}

export async function deleteLoanTypeAction(id: string) {
  await ensureTenantContext();
  try {
    const c = await companyCtx('DELETE');
    const removed = await service.deleteType(id);
    await audit(c, 'DELETE', removed.id, { removed: true }, { type: removed.name });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return failure(error, 'loan.type.delete');
  }
}

export async function saveLoanApprovalSettingsAction(policy: unknown) {
  await ensureTenantContext();
  try {
    const c = await companyCtx('APPROVE');
    const result = await service.saveApprovalPolicy(policy);
    await audit(c, 'EDIT', 'loan-approval-settings', { approvalType: result.policy.type, levels: result.policy.levels.length });
    revalidate();
    return { success: true as const, data: { pendingKept: result.pendingKept } };
  } catch (error: unknown) {
    return failure(error, 'loan.approvalSettings');
  }
}
