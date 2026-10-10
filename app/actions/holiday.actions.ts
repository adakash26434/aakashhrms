'use server';

import { revalidatePath } from 'next/cache';
import { ensureTenantContext } from '@/lib/db';
import { checkPermissionWithScope, hasPermission } from '@/lib/auth/check-permission';
import { toActionError } from '@/lib/errors/action-error';
import * as service from '@/lib/services/holiday.service';

// Holiday calendar (4.12c, S52): Holidays → Add / Edit / Delete with the user's scope — a
// company-wide role for every branch, a branch role for its own branches, never platform support.
// The service checks the scope, closed attendance months and the form, and audits every change.

export async function holidaysPageAction() {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('VIEW', 'HOLIDAYS');
    const [add, edit, del] = await Promise.all([hasPermission('ADD', 'HOLIDAYS'), hasPermission('EDIT', 'HOLIDAYS'), hasPermission('DELETE', 'HOLIDAYS')]);
    return { success: true as const, data: await service.holidaysPage(scope, { add, edit, delete: del }) };
  } catch (error: unknown) {
    return toActionError(error, 'holiday.page');
  }
}

/** Adds a holiday (id null) or saves one. */
export async function saveHolidayAction(id: string | null, input: unknown) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope(id ? 'EDIT' : 'ADD', 'HOLIDAYS');
    const result = await service.saveHoliday(id ? String(id) : null, input, { scope, userId: scope.userId });
    revalidatePath('/setup/holidays');
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof service.HolidayValidationError) return { success: false as const, error: error.message, validationErrors: error.errors };
    return toActionError(error, 'holiday.save');
  }
}

export async function deleteHolidayAction(id: string) {
  await ensureTenantContext();
  try {
    const scope = await checkPermissionWithScope('DELETE', 'HOLIDAYS');
    const result = await service.deleteHoliday(String(id), { scope, userId: scope.userId });
    revalidatePath('/setup/holidays');
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'holiday.delete');
  }
}
