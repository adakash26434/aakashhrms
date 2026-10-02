'use server';

import { ensureTenantContext } from '@/lib/db';
import * as leaveService from '@/lib/services/leave.service';
import { revalidatePath } from 'next/cache';
import type { LeaveApplicationFormData, LeaveStatus, LeaveFilter } from '@/lib/types/leave';
import { checkPermission, checkPermissionWithScope } from '@/lib/auth/check-permission';
import * as leaveRepository from '@/lib/repositories/leave.repository';
import { findById as findEmployeeById } from '@/lib/repositories/employee.repository';
import { recordAuditLog } from '@/lib/services/audit.service';
import { getImpersonationSession } from '@/lib/platform/impersonation';
import { UserFacingError, toActionError } from '@/lib/errors/action-error';
import {
  canTransitionLeave,
  cleanRemarks,
  employeeInScope,
  isLeaveStatus,
  isOwnRequest,
  REJECTION_REASON_MIN,
} from '@/lib/leave/decision';

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Approve, reject or cancel a leave request (S17). Used by the Approvals page,
 * the Applications page and the Home approvals queue.
 * The reviewer is always the signed-in user; the old `reviewerId` argument is
 * ignored and kept only so existing callers compile.
 */
export async function updateLeaveStatusAction(id: string, status: LeaveStatus, _reviewerId?: string, remarks?: string) {
  await ensureTenantContext();
  try {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) throw new UserFacingError('Leave request not found.');
    if (!isLeaveStatus(status) || status === 'Pending') throw new UserFacingError('That is not a valid decision.');
    if (await getImpersonationSession()) {
      throw new UserFacingError('Support view cannot approve or reject leave on behalf of the company.');
    }

    const scope = await checkPermissionWithScope('APPROVE', 'LEAVE_APPROVALS');
    const application = await leaveRepository.findLeaveApplicationById(id);
    const employee = application ? await findEmployeeById(application.employeeId) : undefined;

    // Outside the reviewer's branch / department scope looks the same as "not found".
    if (!application || !employee || !employeeInScope(scope, employee)) {
      if (application) {
        await recordAuditLog({ userId: scope.userId, action: 'APPROVE', module: 'LEAVE_APPROVALS', recordId: id, result: 'DENIED_SCOPE', newValues: { status } });
      }
      throw new UserFacingError('Leave request not found.');
    }
    if (isOwnRequest(scope.employeeId, application.employeeId)) {
      await recordAuditLog({ userId: scope.userId, action: 'APPROVE', module: 'LEAVE_APPROVALS', recordId: id, result: 'DENIED_SELF_APPROVAL', newValues: { status } });
      throw new UserFacingError("You can't approve or reject your own leave. Another approver needs to review it.");
    }
    if (!canTransitionLeave(application.status, status)) {
      throw new UserFacingError(`This request is already ${application.status.toLowerCase()}.`);
    }
    const reviewRemarks = cleanRemarks(remarks);
    if (status === 'Rejected' && (!reviewRemarks || reviewRemarks.length < REJECTION_REASON_MIN)) {
      throw new UserFacingError('Give a short reason for the rejection.');
    }

    const updated = await leaveRepository.transitionLeaveApplication({
      id,
      expectedStatus: application.status,
      status,
      reviewedById: scope.userId,
      reviewRemarks,
    });
    if (!updated) {
      throw new UserFacingError('Someone else decided this request a moment ago. Refresh to see the latest status.');
    }

    await recordAuditLog({
      userId: scope.userId,
      action: 'APPROVE',
      module: 'LEAVE_APPROVALS',
      recordId: id,
      result: 'SUCCESS',
      oldValues: { status: application.status },
      newValues: { status, remarks: reviewRemarks, employeeId: application.employeeId, days: application.noOfDays },
    });

    revalidatePath('/timeAndLeave/approvals');
    revalidatePath('/timeAndLeave/applications');
    revalidatePath('/dashboard');
    return { success: true as const, data: updated };
  } catch (error: unknown) {
    return toActionError(error, 'leave.updateStatus');
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
    const scope =
      filter.status === 'Pending'
        ? await checkPermissionWithScope('VIEW', 'LEAVE_APPROVALS')
        : await checkPermissionWithScope('VIEW', 'LEAVE_APPLICATIONS');
    const data = await leaveService.getLeaveApplications(filter, scope);
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
