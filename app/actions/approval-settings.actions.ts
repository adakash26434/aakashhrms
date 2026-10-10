'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/approval-settings.service';

// Setup → Approvals (4.12d): reading needs Salary structure or Loans → View; changing a module's
// approval setting or the salary rules needs that module's Approve with a company-wide role, never
// platform support (checkCompanyControl). The service audits every change in words.

const revalidate = () => {
  revalidatePath('/setup/approvals');
  revalidatePath('/workforce/salary-mapping');
  revalidatePath('/loans');
};

const failed = (error: unknown, context: string) =>
  error instanceof service.ApprovalSettingsValidationError ? { success: false as const, error: error.message, validationErrors: error.errors } : toActionError(error, context);

const asStep = (v: unknown): -1 | 1 => (v === -1 ? -1 : 1);

export async function approvalSettingsPageAction() {
  await ensureTenantContext();
  try {
    return { success: true as const, data: await service.approvalSettingsPage(await service.contextFor()) };
  } catch (error: unknown) {
    return toActionError(error, 'approvals.page');
  }
}

export async function saveSalaryApprovalPolicyAction(input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('APPROVE', 'SALARY_MAPPING');
    const result = await service.saveSalaryPolicy(input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return failed(error, 'approvals.salary-policy');
  }
}

/** Adds (no id) or saves a custom rule for salary changes; `version` is the list as the user saw it. */
export async function saveSalaryApprovalRuleAction(input: unknown, version: string) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('APPROVE', 'SALARY_MAPPING');
    const result = await service.saveSalaryRule(input, String(version), { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return failed(error, 'approvals.salary-rule');
  }
}

export async function deleteSalaryApprovalRuleAction(id: string, version: string) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('APPROVE', 'SALARY_MAPPING');
    const result = await service.deleteSalaryRule(String(id), String(version), { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'approvals.salary-rule-delete');
  }
}

export async function moveSalaryApprovalRuleAction(id: string, step: number, version: string) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('APPROVE', 'SALARY_MAPPING');
    await service.moveSalaryRule(String(id), asStep(step), String(version), { userId: scope.userId });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'approvals.salary-rule-move');
  }
}

export async function saveLoanApprovalPolicyAction(input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('APPROVE', 'LOANS');
    const result = await service.saveLoanPolicy(input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return failed(error, 'approvals.loan-policy');
  }
}
