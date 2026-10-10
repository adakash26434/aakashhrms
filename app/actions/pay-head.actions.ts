'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkPermission, checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/pay-head.service';

// Pay heads (4.12b, S51): a company-wide list — Pay heads → Add / Edit / Delete with a
// company-wide role, never platform support (checkCompanyControl); View to read. The service
// checks every head and audits every change.

const revalidate = () => {
  revalidatePath('/setup/pay-heads');
  revalidatePath('/workforce/salary-mapping');
};

export async function payHeadsPageAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'PAY_HEADS');
    const [add, edit, del, salaryView] = await Promise.all([hasPermission('ADD', 'PAY_HEADS'), hasPermission('EDIT', 'PAY_HEADS'), hasPermission('DELETE', 'PAY_HEADS'), hasPermission('VIEW', 'SALARY_MAPPING')]);
    // 4.12e: who still holds an amount on a label head is salary data — Salary structure → View, within its scope.
    const salaryScope = salaryView ? await checkPermissionWithScope('VIEW', 'SALARY_MAPPING') : null;
    return { success: true as const, data: await service.payHeadsPage({ add, edit, delete: del }, salaryScope) };
  } catch (error: unknown) {
    return toActionError(error, 'pay-head.page');
  }
}

/** Adds a pay head (id null) or saves one. */
export async function savePayHeadAction(id: string | null, input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl(id ? 'EDIT' : 'ADD', 'PAY_HEADS');
    const head = await service.savePayHead(id ? String(id) : null, input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: { id: head.id, name: head.name, code: head.code } };
  } catch (error: unknown) {
    if (error instanceof service.PayHeadValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'pay-head.save');
  }
}

export async function deletePayHeadAction(id: string) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('DELETE', 'PAY_HEADS');
    await service.deletePayHead(String(id), { userId: scope.userId });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'pay-head.delete');
  }
}
