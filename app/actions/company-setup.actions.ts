'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/company-setup.service';

// Company setup (4.12c, S53): reading needs Organization → View; saving the company's details and
// asking the platform to change the legal ones need Organization → Edit with a company-wide role,
// never platform support (checkCompanyControl). The company is always the signed-in user's own,
// resolved from the session — never from the browser.

const revalidate = () => {
  revalidatePath('/setup/company-setup');
  revalidatePath('/setup');
};

export async function companySetupPageAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'ORG_STRUCTURE');
    const canEdit = scope.scopeType === 'GLOBAL' && !scope.isImpersonation && (await hasPermission('EDIT', 'ORG_STRUCTURE'));
    return { success: true as const, data: await service.companySetupPage(await service.contextFor(scope.userId, canEdit)) };
  } catch (error: unknown) {
    return toActionError(error, 'company-setup.page');
  }
}

export async function saveCompanyProfileAction(input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('EDIT', 'ORG_STRUCTURE');
    const result = await service.saveCompanyProfile(input, { userId: scope.userId });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof service.CompanyProfileValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'company-setup.save');
  }
}

/** Asks the platform to change the company's legal details. */
export async function requestLegalChangeAction(input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('EDIT', 'ORG_STRUCTURE');
    const result = await service.requestLegalChange(input, await service.contextFor(scope.userId, true));
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof service.LegalChangeValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'company-setup.request');
  }
}

/** Withdraws the company's own waiting request. */
export async function cancelLegalChangeAction(requestId: string) {
  await ensureTenantContext();
  try {
    const scope = await checkCompanyControl('EDIT', 'ORG_STRUCTURE');
    await service.cancelLegalChange(String(requestId), await service.contextFor(scope.userId, true));
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'company-setup.cancel');
  }
}
