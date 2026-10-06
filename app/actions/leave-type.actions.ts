'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveTypeService from '@/lib/services/leave-type.service';
import { revalidatePath } from 'next/cache';
import type { LeaveTypeFormData } from '@/lib/types/leave-type';
import { checkPermission } from '@/lib/auth/check-permission';
import { recordAuditLog } from '@/lib/services/audit.service';
import { toActionError } from '@/lib/errors/action-error';

export async function saveLeaveTypeAction(id: string | null, formData: LeaveTypeFormData) {
  await ensureTenantContext();
  try {
    await checkPermission(id ? 'EDIT' : 'ADD', 'LEAVE_TYPES');
    const result = await leaveTypeService.saveLeaveType(id, formData);
    await recordAuditLog({ action: id ? 'EDIT' : 'ADD', module: 'LEAVE_TYPES', recordId: result.id, result: 'SUCCESS', newValues: { name: result.name, code: result.code, days: result.noOfDays, pay: result.leaveType, active: result.isActive } });
    revalidatePath('/timeAndLeave/policies');
    revalidatePath('/timeAndLeave/leave-types');
    revalidatePath('/timeAndLeave/applications'); // Revalidate applications/approvals dropdowns
    revalidatePath('/timeAndLeave/approvals');
    revalidatePath('/payroll/leave-salary');
    return { success: true as const, data: result };
  } catch (error: unknown) {
    if (error instanceof Error && 'errors' in error) {
      return { success: false as const, error: 'Check the highlighted fields.', validationErrors: (error as { errors: Record<string, string> }).errors };
    }
    return toActionError(error, 'leave-type.save');
  }
}

export async function deleteLeaveTypeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LEAVE_TYPES');
    await leaveTypeService.deleteLeaveType(id);
    await recordAuditLog({ action: 'DELETE', module: 'LEAVE_TYPES', recordId: id, result: 'SUCCESS' });
    revalidatePath('/timeAndLeave/policies');
    revalidatePath('/timeAndLeave/leave-types');
    revalidatePath('/timeAndLeave/applications');
    revalidatePath('/timeAndLeave/approvals');
    revalidatePath('/payroll/leave-salary');
    return { success: true as const };
  } catch (error: unknown) {
    return toActionError(error, 'leave-type.delete');
  }
}

export async function toggleLeaveTypeStatusAction(id: string, isActive: boolean) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'LEAVE_TYPES');
    const result = await leaveTypeService.toggleLeaveTypeStatus(id, isActive);
    await recordAuditLog({ action: 'EDIT', module: 'LEAVE_TYPES', recordId: id, result: 'SUCCESS', newValues: { active: isActive } });
    revalidatePath('/timeAndLeave/policies');
    revalidatePath('/timeAndLeave/leave-types');
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

