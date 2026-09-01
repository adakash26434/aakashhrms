'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveService from '@/lib/services/leave.service';
import { revalidatePath } from 'next/cache';
import type { LeaveApplicationFormData, LeaveStatus, LeaveFilter } from '@/lib/types/leave';
import { auth } from '@/lib/auth';
import { checkPermission } from '@/lib/auth/check-permission';

export async function saveLeaveApplicationAction(id: string | null, formData: LeaveApplicationFormData) {
  await ensureTenantContext();
  try {
    if (id) {
      await checkPermission('EDIT', 'LEAVE_APPLICATIONS');
    } else {
      await checkPermission('ADD', 'LEAVE_APPLICATIONS');
    }
    const result = await leaveService.saveLeaveApplication(id, formData);
    revalidatePath('/timeAndLeave/applications');
    revalidatePath('/timeAndLeave/approvals');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'LeaveValidationError' && 'errors' in error) {
        return { success: false, validationErrors: (error as { errors: Record<string, string> }).errors };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Failed to save application.' };
  }
}

export async function updateLeaveStatusAction(id: string, status: LeaveStatus, reviewerId: string, remarks?: string) {
  await ensureTenantContext();
  try {
    await checkPermission('APPROVE', 'LEAVE_APPROVALS');
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const result = await leaveService.updateLeaveApplicationStatus(id, status, session.user.id, remarks);
    revalidatePath('/timeAndLeave/approvals');
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update status.' };
  }
}

export async function deleteLeaveApplicationAction(id: string) {
  await ensureTenantContext();
  try {
    await checkPermission('DELETE', 'LEAVE_APPLICATIONS');
    await leaveService.deleteLeaveApplication(id);
    revalidatePath('/timeAndLeave/applications');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete application.' };
  }
}

export async function getLeaveApplicationsAction(filter: LeaveFilter) {
  await ensureTenantContext();
  try {
    if (filter.status === 'Pending') {
      await checkPermission('VIEW', 'LEAVE_APPROVALS');
    } else {
      await checkPermission('VIEW', 'LEAVE_APPLICATIONS');
    }
    const data = await leaveService.getLeaveApplications(filter);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch applications.' };
  }
}

export async function getLeaveLookupDataAction() {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_APPLICATIONS');
    const data = await leaveService.getLeaveLookupData();
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch lookup data.' };
  }
}

export async function getEmployeeLeaveBalancesAction(employeeId: string) {
  await ensureTenantContext();
  try {
    await checkPermission('VIEW', 'LEAVE_APPLICATIONS');
    const data = await leaveService.getEmployeeLeaveBalances(employeeId);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch balances.' };
  }
}