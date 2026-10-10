'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkPermission, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/fiscal-year.service';

// Fiscal years (4.12, S49): a company-wide setting — Fiscal year → Add (a new year), Edit (make
// current, delete an unused year) or Lock (close, reopen) with a company-wide role, never platform
// support (checkCompanyControl). Every change is audited by the service.

const revalidate = () => {
  revalidatePath('/setup/fiscal-year');
  revalidatePath('/setup/tax-rates');
};

async function editor(action: 'ADD' | 'EDIT' | 'LOCK'): Promise<service.FiscalYearCtx> {
  const scope = await checkCompanyControl(action, 'FISCAL_YEAR');
  return { userId: scope.userId };
}

export async function fiscalYearsPageAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'FISCAL_YEAR');
    const [add, edit, lock] = await Promise.all([hasPermission('ADD', 'FISCAL_YEAR'), hasPermission('EDIT', 'FISCAL_YEAR'), hasPermission('LOCK', 'FISCAL_YEAR')]);
    return { success: true as const, data: await service.fiscalYearsPage({ add, edit, lock }) };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.page');
  }
}

export async function createFiscalYearAction(input: unknown) {
  await ensureTenantContext();
  try {
    const year = await service.createFiscalYear(input, await editor('ADD'));
    revalidate();
    return { success: true as const, data: { id: year.id, label: year.label } };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.create');
  }
}

export async function makeFiscalYearCurrentAction(id: string) {
  await ensureTenantContext();
  try {
    await service.makeCurrent(String(id), await editor('EDIT'));
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.current');
  }
}

export async function closeFiscalYearAction(id: string) {
  await ensureTenantContext();
  try {
    await service.closeYear(String(id), await editor('LOCK'));
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.close');
  }
}

export async function reopenFiscalYearAction(id: string, reason: string) {
  await ensureTenantContext();
  try {
    await service.reopenYear(String(id), String(reason ?? ''), await editor('LOCK'));
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.reopen');
  }
}

export async function deleteFiscalYearAction(id: string) {
  await ensureTenantContext();
  try {
    await service.deleteYear(String(id), await editor('EDIT'));
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'fiscal-year.delete');
  }
}
