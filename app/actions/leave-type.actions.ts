'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveTypeService from '@/lib/services/leave-type.service';
import { revalidatePath } from 'next/cache';
import type { LeaveTypeFormData } from '@/lib/types/leave-type';
import { checkPermission } from '@/lib/auth/check-permission';

export async function saveLeaveTypeAction(id: string | null, formData: LeaveTypeFormData) {
  await ensureTenantContext();
  try {
    await checkPermission(id ? 'EDIT' : 'ADD', 'LEAVE_TYPES');
    const result = await leaveTypeService.saveLeaveType(id, formData);
    revalidatePath('/timeAndLeave/leave-types');
    revalidatePath('/timeAndLeave/applications'); // Revalidate applications/approvals dropdowns
    revalidatePath('/timeAndLeave/approvals');
    revalidatePath('/payroll/leave-salary');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error && 'errors' in error) {
      return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save Leave type.' };
  }
}

export async function deleteLeaveTypeAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LEAVE_TYPES');
    await leaveTypeService.deleteLeaveType(id);
    revalidatePath('/timeAndLeave/leave-types');
    revalidatePath('/timeAndLeave/applications');
    revalidatePath('/timeAndLeave/approvals');
    revalidatePath('/payroll/leave-salary');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete Leave type.' };
  }
}

export async function toggleLeaveTypeStatusAction(id: string, isActive: boolean) {
  await ensureTenantContext();
  try {
    await checkPermission('EDIT', 'LEAVE_TYPES');
    const result = await leaveTypeService.toggleLeaveTypeStatus(id, isActive);
    revalidatePath('/timeAndLeave/leave-types');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle Leave type.' };
  }
}

export async function getLeaveTypesWithKPIsAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_TYPES');
    const data = await leaveTypeService.getLeaveTypesWithKPIs();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Leave types.' };
  }
}

