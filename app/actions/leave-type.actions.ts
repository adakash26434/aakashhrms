'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveTypeService from '@/lib/services/leave-type.service';
import { revalidatePath } from 'next/cache';
import type { LeaveTypeSaveOptions } from '@/lib/types/leave-type';
import { checkPermission, checkPermissionWithScope } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';

// Company leave types (4.6e): company-wide settings, so a company-wide role is needed (S24).

async function typeCtx(action: 'ADD' | 'EDIT' | 'DELETE'): Promise<leaveTypeService.LeaveTypeCtx> {
  const scope = await checkPermissionWithScope(action, 'LEAVE_TYPES');
  return { userId: scope.userId, companyWide: scope.scopeType === 'GLOBAL' };
}

function revalidate() {
  revalidatePath('/timeAndLeave/policies');
  revalidatePath('/timeAndLeave/leaves');
  revalidatePath('/payroll/leave-salary');
}

export async function saveLeaveTypeAction(id: string | null, formData: unknown, options: LeaveTypeSaveOptions & { version?: string } = {}) {
  await ensureTenantContext();
  try {
    const ctx = await typeCtx(id ? 'EDIT' : 'ADD');
    const result = await leaveTypeService.saveLeaveType(id, formData, { thisYear: options.thisYear === true, note: typeof options.note === 'string' ? options.note : undefined, version: typeof options.version === 'string' ? options.version : undefined }, ctx);
    await recordAuditLog({
      action: id ? 'EDIT' : 'ADD',
      module: 'LEAVE_TYPES',
      recordId: result.id,
      result: 'SUCCESS',
      newValues: { name: result.name, code: result.code, kind: result.kind, days: result.noOfDays, pay: result.leaveType, active: result.isActive, thisYear: options.thisYear === true },
    });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof leaveTypeService.LeaveTypeValidationError) {
      return { success: false as const, error: 'Check the highlighted fields.', validationErrors: error.errors as Record<string, string> };
    }
    return toActionError(error, 'leave-type.save');
  }
}

/** What "also this year" would credit (nothing is saved). */
export async function previewLeaveTypeThisYearAction(id: string | null, formData: unknown) {
  await ensureTenantContext();
  try {
    const ctx = await typeCtx(id ? 'EDIT' : 'ADD');
    return { success: true as const, data: await leaveTypeService.previewThisYear(id, formData, ctx) };
  } catch (error: unknown) {
    return toActionError(error, 'leave-type.preview');
  }
}

export async function deleteLeaveTypeAction(id: string) {
  await ensureTenantContext();
  try {
    const ctx = await typeCtx('DELETE');
    await leaveTypeService.deleteLeaveType(id, ctx);
    await recordAuditLog({ action: 'DELETE', module: 'LEAVE_TYPES', recordId: id, result: 'SUCCESS' });
    revalidate();
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'leave-type.delete');
  }
}

export async function toggleLeaveTypeStatusAction(id: string, isActive: boolean) {
  await ensureTenantContext();
  try {
    const ctx = await typeCtx('EDIT');
    const result = await leaveTypeService.toggleLeaveTypeStatus(id, isActive === true, ctx);
    await recordAuditLog({ action: 'EDIT', module: 'LEAVE_TYPES', recordId: id, result: 'SUCCESS', newValues: { active: isActive === true } });
    revalidate();
    return { success: true as const, data: result };
  } catch (error: unknown) {
    return toActionError(error, 'leave-type.toggle');
  }
}

export async function getLeaveTypesWithKPIsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_TYPES');
    const data = await leaveTypeService.getLeaveTypesWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return toActionError(error, 'leave-type.list');
  }
}
