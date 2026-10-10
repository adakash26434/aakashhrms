'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';
import { TravelValidationError } from '@/lib/services/travel.service';
import { ReimbursementValidationError } from '@/lib/services/reimbursement.service';
import * as ess from '@/lib/services/ess-extras.service';
import { ESS_LANG_COOKIE, asEssLang } from '@/lib/i18n/ess';

// Self-service extras (G12): language choice (a cookie, no permission needed)
// and the employee's own travel claim. The employee is always the session's —
// never a parameter.

export async function setEssLanguageAction(lang: string) {
  const value = asEssLang(lang);
  const store = await cookies();
  store.set(ESS_LANG_COOKIE, value, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: false });
  revalidatePath('/self-service', 'layout');
  return { success: true as const, data: { lang: value } };
}

export async function submitMyClaimAction(form: unknown) {
  await ensureTenantContext();
  try {
    const row = await ess.submitMyClaim(form);
    await recordAuditLog({ action: 'ADD', module: 'TRAVEL', recordId: row.id, result: 'SUCCESS', newValues: { selfService: true, days: row.days, payable: row.payable } });
    revalidatePath('/self-service/my-claims');
    revalidatePath('/payroll/travel');
    return { success: true as const, data: row };
  } catch (error: unknown) {
    if (error instanceof TravelValidationError) return { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors };
    return toActionError(error, 'ess.claim');
  }
}

/** F16: the employee's own reimbursement claim, submitted at once (employee from the session). */
export async function submitMyReimbursementAction(form: unknown) {
  await ensureTenantContext();
  try {
    const row = await ess.submitMyReimbursement(form);
    await recordAuditLog({ action: 'ADD', module: 'REIMBURSEMENTS', recordId: row.id, result: 'SUCCESS', newValues: { selfService: true, type: row.typeCode, amount: row.amount } });
    revalidatePath('/self-service/my-reimbursements');
    revalidatePath('/payroll/reimbursements');
    return { success: true as const, data: row };
  } catch (error: unknown) {
    if (error instanceof ReimbursementValidationError) return { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors };
    return toActionError(error, 'ess.reimbursement');
  }
}
