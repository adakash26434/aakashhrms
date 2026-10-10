'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkCompanyControl, checkPermission, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/system-control.service';

// Rules & controls (4.12b, S50): a company-wide setting — System control → Edit with a company-wide
// role, never platform support (checkCompanyControl). A grade-policy change also needs Salary
// structure → Edit and goes through salary approval; the service audits every change.

async function editor(): Promise<service.RulesCtx> {
  const scope = await checkCompanyControl('EDIT', 'SYSTEM_CONTROL');
  return { userId: scope.userId, scope, canChangeGrades: await hasPermission('EDIT', 'SALARY_MAPPING') };
}

const revalidate = () => {
  revalidatePath('/setup/system-control');
  revalidatePath('/workforce/salary-mapping');
  revalidatePath('/timeAndLeave/policies');
};

export async function rulesPageAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'SYSTEM_CONTROL');
    const [edit, grades] = await Promise.all([hasPermission('EDIT', 'SYSTEM_CONTROL'), hasPermission('EDIT', 'SALARY_MAPPING')]);
    return { success: true as const, data: await service.rulesPage({ edit, grades }) };
  } catch (error: unknown) {
    return toActionError(error, 'rules.page');
  }
}

/** What saving would do to salaries (null when the grade policy is not changed). */
export async function previewRulesAction(input: unknown) {
  await ensureTenantContext();
  try {
    return { success: true as const, data: await service.previewRules(input, await editor()) };
  } catch (error: unknown) {
    if (error instanceof service.RulesValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'rules.preview');
  }
}

export async function saveRulesAction(input: unknown) {
  await ensureTenantContext();
  try {
    const result = await service.saveRules(input, await editor());
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof service.RulesValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'rules.save');
  }
}

/** Applies the saved grade policy again (employees left out while a change of theirs was waiting). */
export async function applyGradePolicyAction() {
  await ensureTenantContext();
  try {
    const result = await service.applyGradePolicy(await editor());
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'rules.grades');
  }
}
